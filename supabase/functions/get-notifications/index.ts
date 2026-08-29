import { serve } from "https://deno.land/std@0.192.0/http/server.ts"
import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { verifyAuth } from '../_shared/auth-verifier.ts'
import { getAdminClient } from '../_shared/supabase-admin.ts'
import { isValidUUID, isValidISODate } from '../_shared/validation.ts'
import { decryptNotification, DecryptionError } from '../_shared/notification-crypto.ts'
import { logger, mapError } from '../_shared/logger.ts'

serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    const authHeader = req.headers.get('Authorization')
    const user = await verifyAuth(authHeader)

    const adminClient = getAdminClient()
    const body = await req.json()

    const {
      limit = 50,
      before,
      before_id,
      since,
      ids,
      child_user_id,
      child_user_ids,
      // Backward compatibility: older mobile builds still send these.
      pair_id,
      pair_ids,
    } = body as Record<string, unknown>

    // Resolve the caller's own pairs once so we can validate ownership
    // and translate legacy `pair_id` / `pair_ids` requests to
    // `child_user_id` queries.
    const { data: userPairs } = await adminClient
      .from('pairs')
      .select('id, parent_user_id, child_user_id, status')
      .or(`parent_user_id.eq.${user.id},child_user_id.eq.${user.id}`)
      .in('status', ['active', 'pending', 'revoked'])
      .limit(50)

    const userPairIds = new Set((userPairs ?? []).map((p) => (p as { id: string }).id))
    void userPairIds

    // Collect the child_user_ids we will query for. Prefer the new
    // relationship-based params; fall back to legacy pair-based params.
    let requestedChildUserIds: string[] = []

    if (child_user_ids && Array.isArray(child_user_ids)) {
      requestedChildUserIds = (child_user_ids as unknown[]).filter(
        (v): v is string => typeof v === 'string' && isValidUUID(v),
      )
    } else if (child_user_id && isValidUUID(child_user_id)) {
      requestedChildUserIds = [child_user_id as string]
    } else if (pair_ids && Array.isArray(pair_ids)) {
      const requestedPairs = (pair_ids as unknown[]).filter(
        (v): v is string => typeof v === 'string' && isValidUUID(v),
      )
      requestedChildUserIds = (userPairs ?? [])
        .filter((p) => {
          const pid = (p as { id: string }).id
          const cuid = (p as { child_user_id: string }).child_user_id
          return requestedPairs.includes(pid) && !!cuid
        })
        .map((p) => (p as { child_user_id: string }).child_user_id)
    } else if (pair_id && isValidUUID(pair_id)) {
      const targetPair = (userPairs ?? []).find((p) => (p as { id: string }).id === pair_id)
      if (targetPair) {
        // Include all pairs (active, pending, revoked) for the same
        // parent-child relationship so history survives reconnect cycles.
        const tp = targetPair as { parent_user_id: string; child_user_id: string }
        requestedChildUserIds = (userPairs ?? [])
          .filter((p) => {
            const pp = p as { parent_user_id: string; child_user_id: string }
            return pp.parent_user_id === tp.parent_user_id && pp.child_user_id === tp.child_user_id
          })
          .map((p) => (p as { child_user_id: string }).child_user_id)
      } else {
        // Fallback: pair row may have been hard-deleted (see migration
        // 20260831010000_delete_revoked_pairs.sql). Resolve the
        // parent/child ids directly from the mirrored_notifications row,
        // gated by RLS so the caller can only access their own history.
        const { data: probeRows } = await adminClient
          .from('mirrored_notifications')
          .select('parent_user_id, child_user_id')
          .eq('pair_id', pair_id)
          .limit(1)
        const probe = (probeRows ?? [])[0] as
          | { parent_user_id: string; child_user_id: string }
          | undefined
        if (probe && (probe.parent_user_id === user.id || probe.child_user_id === user.id)) {
          requestedChildUserIds = [probe.child_user_id]
        }
      }
    }

    if (requestedChildUserIds.length === 0) {
      return new Response(
        JSON.stringify({ data: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
      )
    }

    const queryLimit = Math.min(typeof limit === 'number' ? limit : 50, 100)

    // Authorize access: the caller must either be the parent of every
    // requested child_user_id, or be that child_user_id themselves
    // (RLS allows both, so the function must too). Validate against
    // the user's actual pair set rather than trusting client input.
    const ownedChildUserIds = (userPairs ?? [])
      .filter((p) => {
        const pp = p as { parent_user_id: string; child_user_id: string }
        return pp.parent_user_id === user.id || pp.child_user_id === user.id
      })
      .map((p) => (p as { child_user_id: string }).child_user_id)

    const authorizedChildUserIds = requestedChildUserIds.filter(
      (id) => ownedChildUserIds.includes(id),
    )

    if (authorizedChildUserIds.length === 0) {
      return new Response(
        JSON.stringify({ data: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
      )
    }

    // Scope the result by either parent_user_id (caller is parent) or
    // child_user_id (caller is the child themselves). This keeps a
    // child user from seeing notifications for a different child even
    // if they guess the UUID.
    const callerIsChild = authorizedChildUserIds.includes(user.id)
    const scopeParentUserId = callerIsChild ? null : user.id
    const scopeChildUserIds = callerIsChild ? [user.id] : authorizedChildUserIds

    let query = adminClient
      .from('mirrored_notifications')
      .select('*')
      .in('child_user_id', scopeChildUserIds)

    if (scopeParentUserId) {
      query = query.eq('parent_user_id', scopeParentUserId)
    }

    if (ids && Array.isArray(ids)) {
      query = query
        .in('id', ids.filter(isValidUUID))
        .in('child_user_id', scopeChildUserIds)
      if (scopeParentUserId) {
        query = query.eq('parent_user_id', scopeParentUserId)
      }
    } else {
      if (since && isValidISODate(since)) {
        query = query.gte('notification_posted_at', since)
      }
      if (before && isValidISODate(before)) {
        // Composite cursor: rows strictly before (before, before_id) in the
        // (notification_posted_at DESC, id DESC) ordering. This prevents
        // rows that share the same timestamp as `before` from being skipped
        // or duplicated when paginating.
        if (before_id && isValidUUID(before_id)) {
          query = query.or(
            `notification_posted_at.lt.${before},and(notification_posted_at.eq.${before},id.lt.${before_id})`,
          )
        } else {
          query = query.lt('notification_posted_at', before)
        }
      }
      query = query
        .order('notification_posted_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(queryLimit)
    }

    const { data: rows, error } = await query

    if (error) throw error
    if (!rows || rows.length === 0) {
      return new Response(
        JSON.stringify({ data: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
      )
    }

    // Decrypt each row using the parent/child relationship key from
    // the row itself so history survives disconnect/reconnect cycles.
    // If a row fails to decrypt (corrupted ciphertext, master key
    // rotation, etc.) we skip it rather than leak the raw "nv1:" blob
    // to the parent UI or fail the whole batch.
    const decrypted = (
      await Promise.all(
        rows.map(async (row: Record<string, unknown>) => {
          try {
            return await decryptNotification(
              row,
              row.parent_user_id as string,
              row.child_user_id as string,
            )
          } catch (err) {
            if (err instanceof DecryptionError) {
              logger.warn('get-notifications', 'skipping undecryptable row', {
                id: row.id,
                reason: err.message,
              })
              return null
            }
            throw err
          }
        }),
      )
    ).filter((r): r is Record<string, unknown> => r !== null)

    return new Response(
      JSON.stringify({ data: decrypted }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
    )
  } catch (error) {
    const { status, error: safeMsg } = mapError(error)
    logger.error('get-notifications', safeMsg, error instanceof Error ? error.message : error)
    return new Response(
      JSON.stringify({ error: safeMsg }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status },
    )
  }
})
