import { serve } from "https://deno.land/std@0.192.0/http/server.ts"
import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { verifyAuth } from '../_shared/auth-verifier.ts'
import { getAdminClient } from '../_shared/supabase-admin.ts'
import { sendParentPush } from '../_shared/fcm.ts'
import { isValidUUID, isValidString, sanitizeString, requireBody } from '../_shared/validation.ts'
import { logger, mapError } from '../_shared/logger.ts'
import { encryptNotification } from '../_shared/notification-crypto.ts'
import { userHasAccess } from '../_shared/subscription-access.ts'

// Canonical content-hash notification_key. This MUST match the mobile
// `deriveLineKey` so the same message always maps to the same row, regardless
// of whether it arrives as a group-summary line or an individual child
// notification. The edge function is the source of truth and always
// re-derives the key server-side; the client key is ignored.
//
// The timestamp is truncated to second precision so the millisecond drift
// between WhatsApp summary and child notifications for the same chat
// message collapses into one row.
async function deterministicKey(n: Record<string, unknown>): Promise<string> {
  const raw = `${n.source_package || ''}|${bucketToSecond(n.notification_posted_at)}|${n.notification_title || ''}|${n.notification_body || ''}`
  const data = new TextEncoder().encode(raw)
  const hash = await crypto.subtle.digest('SHA-256', data)
  const hex = Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('')
  return `auto_${hex.slice(0, 32)}`
}

function bucketToSecond(input: unknown): string {
  if (typeof input !== 'string' || input.length === 0) return ''
  const d = new Date(input)
  if (Number.isNaN(d.getTime())) return ''
  return d.toISOString().slice(0, 19)
}

interface NotificationRow {
  pair_id: string
  parent_user_id: string
  child_user_id: string
  child_device_id: string
  source_package: string | null
  source_app_name: string | null
  app_icon_base64: string | null
  notification_title: string
  notification_body: string
  notification_posted_at: string
  notification_key: string
  delivery_mode: 'pending'
}

serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    const authHeader = req.headers.get('Authorization')
    const user = await verifyAuth(authHeader)

    const adminClient = getAdminClient()
    const payload = await req.json()

    const rawNotifications: Record<string, unknown>[] = payload.notifications
      ? payload.notifications
      : [payload]

    if (rawNotifications.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No notifications provided' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 },
      )
    }

    if (rawNotifications.length > 100) {
      return new Response(
        JSON.stringify({ error: 'Batch size exceeds limit of 100' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 },
      )
    }

    const pairId = rawNotifications[0].pair_id as string
    const childDeviceId = rawNotifications[0].child_device_id as string

    if (!isValidUUID(pairId) || !isValidUUID(childDeviceId)) {
      return new Response(
        JSON.stringify({ error: 'Invalid pair_id or child_device_id format' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 },
      )
    }

    // Reject mixed batches: every row in a single ingest request must
    // belong to the same pair and child device. Without this check, a
    // single request could encrypt notifications for the wrong
    // relationship key and silently leak cross-device notifications.
    for (let i = 1; i < rawNotifications.length; i++) {
      const row = rawNotifications[i] as Record<string, unknown>
      if (row.pair_id !== pairId || row.child_device_id !== childDeviceId) {
        logger.warn('ingest-child-notification', 'mixed batch rejected', {
          index: i,
          expectedPairId: pairId,
          gotPairId: row.pair_id,
        })
        return new Response(
          JSON.stringify({
            error: 'All notifications in a batch must share the same pair_id and child_device_id',
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 },
        )
      }
    }

    const { data: childDevice } = await adminClient
      .from('devices')
      .select('user_id')
      .eq('id', childDeviceId)
      .eq('role', 'child')
      .single()

    if (!childDevice || childDevice.user_id !== user.id) {
      return new Response(
        JSON.stringify({ error: 'Not authorized to post notifications for this device' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 },
      )
    }

    const { data: pairData } = await adminClient
      .from('pairs')
      .select('parent_device_id, child_device_id, parent_user_id, child_user_id, status')
      .eq('id', pairId)
      .eq('child_device_id', childDeviceId)
      .single()

    if (!pairData || pairData.status !== 'active') {
      return new Response(
        JSON.stringify({ data: [], count: 0, dropped: rawNotifications.length, reason: 'pair_inactive' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
      )
    }

    const parentUserId = pairData.parent_user_id as string
    const childUserId = pairData.child_user_id as string

    // Gate: the paired parent must currently have access (active subscription
    // or live trial). When access has lapsed we silently drop the batch and do
    // not write to the DB or send FCM push. The client treats this reason as
    // a terminal drop in its local buffer.
    const parentHasAccess = await userHasAccess(parentUserId)
    if (!parentHasAccess) {
      logger.info('ingest-child-notification', 'dropping batch: parent has no active access', {
        pairId,
        childDeviceId,
      })
      return new Response(
        JSON.stringify({ data: [], count: 0, dropped: rawNotifications.length, reason: 'no_access' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
      )
    }

    // Load app filters so we only ingest notifications for enabled apps.
    // Apps are disabled by default; notifications for unlisted/disabled apps are dropped.
    const { data: filterRows } = await adminClient
      .from('child_app_filters')
      .select('package_name, is_enabled')
      .eq('child_device_id', childDeviceId)

    const allowedPackages = new Set<string>(
      (filterRows ?? [])
        .filter((f: { package_name: string; is_enabled: boolean }) => f.is_enabled === true)
        .map((f) => f.package_name),
    )

    const kept: Record<string, unknown>[] = []
    let droppedCount = 0
    for (const n of rawNotifications) {
      const pkg = sanitizeString(n.source_package, 200)
      if (!pkg || !allowedPackages.has(pkg)) {
        droppedCount++
        continue
      }
      kept.push(n)
    }

    if (kept.length === 0) {
      return new Response(
        JSON.stringify({ data: [], count: 0, dropped: droppedCount, reason: 'app_filtered' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
      )
    }

    const rows: NotificationRow[] = await Promise.all(
      kept.map(async (n) => {
        // Always re-derive the conflict key from message content so the same
        // WhatsApp message arriving as a group-summary line and as a child
        // notification collapses to a single row. The client-supplied key is
        // ignored to avoid leaking instance-level identifiers into the DB
        // unique constraint.
        const sanitizedPostTime =
          sanitizeString(n.notification_posted_at, 30) || new Date().toISOString()
        const sanitizedTitle = sanitizeString(n.notification_title, 500)
        const sanitizedBody = sanitizeString(n.notification_body, 2000)
        const sanitizedPackage = sanitizeString(n.source_package, 200) || ''
        const canonical = {
          source_package: sanitizedPackage,
          notification_posted_at: sanitizedPostTime,
          notification_title: sanitizedTitle,
          notification_body: sanitizedBody,
        }
        return {
          pair_id: pairId,
          parent_user_id: parentUserId,
          child_user_id: childUserId,
          child_device_id: childDeviceId,
          source_package: sanitizedPackage || null,
          source_app_name: sanitizeString(n.source_app_name, 200) || null,
          app_icon_base64: sanitizeString(n.app_icon_base64 as string, 500000) || null,
          notification_title: sanitizedTitle,
          notification_body: sanitizedBody,
          notification_posted_at: sanitizedPostTime,
          notification_key: await deterministicKey(canonical),
          delivery_mode: 'pending' as const,
        }
      })
    )

    const encryptedRows = await Promise.all(
      rows.map((r) =>
        encryptNotification(r as unknown as Record<string, unknown>, parentUserId, childUserId)
      ),
    )

    const { data: inserted, error } = await adminClient
      .from('mirrored_notifications')
      .upsert(encryptedRows, { onConflict: 'parent_user_id, child_user_id, notification_key' })
      .select()

    if (error) throw error
    if (!inserted || inserted.length === 0) {
      return new Response(
        JSON.stringify({ data: [], count: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
      )
    }

    // Distinguish newly-inserted rows from upsert conflicts. Supabase
    // returns the existing row from `.select()` after upsert, so we
    // must check `push_sent_at` to decide whether to send FCM.
    //
    //   * push_sent_at IS NULL  -> newly inserted, push + stamp it
    //   * push_sent_at NOT NULL -> already pushed previously, skip
    //
    // This prevents the parent from receiving duplicate FCM pushes
    // when the same content-hash notification arrives twice (e.g.,
    // WhatsApp summary + child notification race after dedup, or a
    // safe retry after a transient ingest failure).
    const fresh = (inserted as Array<Record<string, unknown>>).filter(
      (r) => r.push_sent_at == null,
    )
    const freshIds = fresh.map((r) => r.id as string)
    const allIds = (inserted as Array<Record<string, unknown>>).map((r) => r.id as string)

    const parentDeviceId = pairData.parent_device_id
    const { data: parentDevice } = await adminClient
      .from('devices')
      .select('is_foreground, push_token, id')
      .eq('id', parentDeviceId)
      .single()

    if (parentDevice && fresh.length > 0) {
      try {
        const isForeground = parentDevice.is_foreground === true

        if (isForeground) {
          await adminClient
            .from('mirrored_notifications')
            .update({ delivery_mode: 'realtime' })
            .in('id', freshIds)
        }

        const pushToken = parentDevice.push_token
        // Track FCM delivery success per notification id so push_delivery_logs
        // can record the actual outcome instead of relying on stale DB rows.
        const deliveryResults = new Map<string, 'success' | 'pending' | 'failed'>()
        let pushSentNow: string[] = []
        if (!pushToken) {
          // No push token; mark every fresh notification as pending (it will be
          // fetched on next app open).
          for (const id of freshIds) deliveryResults.set(id, 'pending')
        } else {
          const batchCount = fresh.length
          if (batchCount >= 4) {
            const firstApp = (fresh[0] as Record<string, unknown>)?.source_app_name || 'apps'
            const result = await sendParentPush(
              pushToken,
              `${batchCount} new notifications`,
              `${batchCount} notification${batchCount > 1 ? 's' : ''} from ${firstApp}${batchCount > 1 ? ' and others' : ''}`,
              batchCount,
            )
            if (result.success) {
              await adminClient
                .from('mirrored_notifications')
                .update({ delivery_mode: 'push' })
                .in('id', freshIds)
              for (const id of freshIds) deliveryResults.set(id, 'success')
              pushSentNow = freshIds
            } else {
              for (const id of freshIds) deliveryResults.set(id, 'failed')
            }
            if (result.unregisteredToken) {
              await adminClient
                .from('devices')
                .update({ push_token: null })
                .eq('id', parentDeviceId)
            }
          } else {
            // Iterate over `fresh` (the rows we actually want to push),
            // not `rows`. `fresh` is a filtered subset of `inserted` so
            // indexing `rows[idx]` against `fresh[idx]` could pair a
            // row's title with a different row's id when some rows
            // were existing conflicts (and therefore not fresh).
            const results = await Promise.all(
              (fresh as Array<Record<string, unknown>>).map(async (n) => {
                const id = n.id as string
                const sent = await sendParentPush(
                  pushToken,
                  (typeof n.source_app_name === 'string' ? n.source_app_name : 'Notification') as string,
                  ((typeof n.notification_title === 'string' ? n.notification_title : '') as string).slice(0, 120),
                )
                return {
                  id,
                  success: sent.success,
                  unregisteredToken: !!sent.unregisteredToken,
                }
              })
            )

            const succeededIds = results.filter(r => r.success).map(r => r.id)
            if (succeededIds.length > 0) {
              await adminClient
                .from('mirrored_notifications')
                .update({ delivery_mode: 'push' })
                .in('id', succeededIds)
              pushSentNow = succeededIds
            }

            for (const r of results) {
              deliveryResults.set(r.id, r.success ? 'success' : 'failed')
            }

            // Only null the parent's push token when FCM explicitly reports
            // it as unregistered. Transient errors (network, rate limit,
            // offline device) must not wipe a valid token.
            const hasUnregistered = results.some(r => r.unregisteredToken)
            if (hasUnregistered) {
              await adminClient
                .from('devices')
                .update({ push_token: null })
                .eq('id', parentDeviceId)
            }
          }
        }

        // Stamp `push_sent_at` on every fresh notification that we
        // successfully (or terminally) attempted to push. This is the
        // durable signal that prevents a future ingest with the same
        // content hash from pushing again. Failures that did NOT
        // actually attempt FCM (e.g., no push token) leave the column
        // null so a later ingest can retry once a token is registered.
        if (pushSentNow.length > 0) {
          await adminClient
            .from('mirrored_notifications')
            .update({ push_sent_at: new Date().toISOString() })
            .in('id', pushSentNow)
        }

        // Log push delivery attempts to push_delivery_logs. Use the per-id
        // deliveryResults map so the recorded status reflects what actually
        // happened, not the stale `delivery_mode` from the upsert return.
        // Skip entirely when the parent has no push token — we don't want
        // the table to fill up with pending rows for parents who never
        // registered for push.
        if (freshIds.length > 0 && pushToken) {
          const attemptedAt = new Date().toISOString()
          const logRows = freshIds.map((id) => ({
            notification_id: id,
            pair_id: pairId,
            parent_user_id: parentUserId,
            child_user_id: childUserId,
            device_id: parentDeviceId,
            delivery_mode: 'parent_push' as const,
            status: (deliveryResults.get(id) ?? 'pending') as 'success' | 'pending' | 'failed',
            attempted_at: attemptedAt,
          }))
          await adminClient
            .from('push_delivery_logs')
            .insert(logRows)
            .then(
              () => {},
              (err) => {
                logger.warn('ingest-child-notification', 'push_delivery_logs insert failed', err)
              },
            )
        }
      } catch (pushErr) {
        logger.warn('ingest-child-notification', 'push delivery error (non-fatal)', pushErr)
      }
    }

    // Observability: surface how many incoming notifications collapsed
    // into existing rows. The WhatsApp summary + child notification race
    // is the common case; an unexpectedly high ratio here usually means
    // a child app is reconnecting with a stale buffer and replaying the
    // same content-hash keys. We only log counts (no content) to keep
    // log metadata cheap and safe.
    const collapsed = inserted.length - fresh.length
    if (collapsed > 0) {
      logger.info('ingest-child-notification', 'duplicate content-hash suppressed', {
        sent: inserted.length,
        fresh: fresh.length,
        collapsed,
        dropped: droppedCount,
      })
    }

    return new Response(
      JSON.stringify({
        data: inserted,
        // `count` is the number of rows the upsert returned (= sent +
        // deduped), `inserted_count` is the number of brand-new rows in
        // this call (the rest were duplicates). The mobile client uses
        // `count` to decide whether to mark keys as processed; the
        // dashboard uses `inserted_count` for "new today" metrics.
        count: inserted.length,
        inserted_count: fresh.length,
        dropped: droppedCount,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
    )
  } catch (error) {
    const msg = error instanceof Error ? error.message : ''
    const code = (error as any)?.code as string | undefined
    // Surface a clear, actionable log if the dedup constraint is missing
    if (code === '42P10') {
      logger.error(
        'ingest-child-notification',
        'ON CONFLICT target missing unique constraint (unique_notification_key). Run the latest DB migration.',
        msg,
      )
      return new Response(
        JSON.stringify({ error: 'Notification storage is misconfigured. Please contact support.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 },
      )
    }
    const { status, error: safeMsg } = mapError(error)
    logger.error('ingest-child-notification', safeMsg, msg)
    return new Response(
      JSON.stringify({ error: safeMsg }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status },
    )
  }
})
