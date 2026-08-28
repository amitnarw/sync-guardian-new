import { serve } from "https://deno.land/std@0.192.0/http/server.ts"
import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { verifyAuth } from '../_shared/auth-verifier.ts'
import { getAdminClient } from '../_shared/supabase-admin.ts'
import { isValidUUID, isValidISODate } from '../_shared/validation.ts'
import { decryptNotification } from '../_shared/notification-crypto.ts'
import { logger, mapError } from '../_shared/logger.ts'

serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    const authHeader = req.headers.get('Authorization')
    const user = await verifyAuth(authHeader)

    const adminClient = getAdminClient()
    const body = await req.json()

    const { limit = 50, before, before_id, since, ids, pair_id, pair_ids } = body as Record<string, unknown>

    // Resolve the user's own pair(s) - always verify ownership
    const { data: userPairs } = await adminClient
      .from('pairs')
      .select('id, parent_user_id, child_user_id, status')
      .or(`parent_user_id.eq.${user.id},child_user_id.eq.${user.id}`)
      .in('status', ['active', 'pending', 'revoked'])
      .limit(50)

    const userPairIds = new Set((userPairs ?? []).map(p => p.id))

    let pairIds: string[] = []
    if (pair_ids && Array.isArray(pair_ids)) {
      // Explicit subset request (used for "select specific children" from the mobile UI).
      // Every requested id MUST be owned by the caller — silently filter rather than error.
      const requested = (pair_ids as unknown[]).filter((v): v is string => typeof v === 'string' && isValidUUID(v))
      pairIds = requested.filter((id) => userPairIds.has(id))
      // If the caller requested non-empty but we resolved none, it means none of the
      // requested ids belong to them — return an empty result rather than leaking anyone.
      if (requested.length > 0 && pairIds.length === 0) pairIds = []
    } else if (pair_id && isValidUUID(pair_id)) {
      const targetPair = (userPairs ?? []).find(p => p.id === pair_id)
      if (targetPair) {
        // Retrieve all pairs (active, pending, revoked) between the same parent and child
        pairIds = (userPairs ?? [])
          .filter(p => p.parent_user_id === targetPair.parent_user_id && p.child_user_id === targetPair.child_user_id)
          .map(p => p.id)
      } else {
        return new Response(
          JSON.stringify({ data: [] }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
        )
      }
    } else {
      // Default to active/pending pairs if no specific pair is requested
      pairIds = (userPairs ?? [])
        .filter(p => p.status === 'active' || p.status === 'pending')
        .map(p => p.id)
    }

    if (pairIds.length === 0) {
      return new Response(
        JSON.stringify({ data: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
      )
    }

    // Build query
    const queryLimit = Math.min(typeof limit === 'number' ? limit : 50, 100)

    let query = adminClient
      .from('mirrored_notifications')
      .select('*')
      .in('pair_id', pairIds)

    if (ids && Array.isArray(ids)) {
      // Always scope requested IDs to the caller's own pairs so a user
      // cannot fetch another pair's notifications by guessing IDs.
      query = query
        .in('id', ids.filter(isValidUUID))
        .in('pair_id', pairIds)
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

    // Decrypt each row using the pair_id from the row itself
    const decrypted = await Promise.all(
      rows.map((row: Record<string, unknown>) => decryptNotification(row, row.pair_id as string)),
    )

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
