import { serve } from "https://deno.land/std@0.192.0/http/server.ts"
import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { verifyAuth } from '../_shared/auth-verifier.ts'
import { getAdminClient } from '../_shared/supabase-admin.ts'
import { sendParentPush } from '../_shared/fcm.ts'
import { isValidUUID, isValidString, sanitizeString, requireBody } from '../_shared/validation.ts'
import { logger, mapError } from '../_shared/logger.ts'
import { encryptNotification } from '../_shared/notification-crypto.ts'
import { userHasAccess } from '../_shared/subscription-access.ts'

async function deterministicKey(n: Record<string, unknown>): Promise<string> {
  const raw = `${n.source_package || ''}|${n.notification_posted_at || ''}|${n.notification_title || ''}|${n.notification_body || ''}`
  const encoder = new TextEncoder()
  const data = encoder.encode(raw)
  const hash = await crypto.subtle.digest('SHA-256', data)
  const hex = Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('')
  return `auto_${hex.slice(0, 32)}`
}

interface NotificationRow {
  pair_id: string
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
      .select('parent_device_id, child_device_id, parent_user_id, status')
      .eq('id', pairId)
      .eq('child_device_id', childDeviceId)
      .single()

    if (!pairData || pairData.status !== 'active') {
      return new Response(
        JSON.stringify({ data: [], count: 0, dropped: rawNotifications.length, reason: 'pair_inactive' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
      )
    }

    // Gate: the paired parent must currently have access (active subscription
    // or live trial). When access has lapsed we silently drop the batch and do
    // not write to the DB or send FCM push. The client treats this reason as
    // a terminal drop in its local buffer.
    const parentHasAccess = await userHasAccess(pairData.parent_user_id as string)
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
        const rawKey = n.notification_key as string | null
        return {
          pair_id: pairId,
          child_device_id: childDeviceId,
          source_package: sanitizeString(n.source_package, 200) || null,
          source_app_name: sanitizeString(n.source_app_name, 200) || null,
          app_icon_base64: sanitizeString(n.app_icon_base64 as string, 500000) || null,
          notification_title: sanitizeString(n.notification_title, 500),
          notification_body: sanitizeString(n.notification_body, 2000),
          notification_posted_at: sanitizeString(n.notification_posted_at, 30) || new Date().toISOString(),
          notification_key: rawKey && rawKey.length > 0
            ? rawKey.slice(0, 256)
            : await deterministicKey(n),
          delivery_mode: 'pending' as const,
        }
      })
    )

    const encryptedRows = await Promise.all(
      rows.map((r) => encryptNotification(r as unknown as Record<string, unknown>, pairId)),
    )

    const { data: inserted, error } = await adminClient
      .from('mirrored_notifications')
      .upsert(encryptedRows, { onConflict: 'pair_id, child_device_id, notification_key' })
      .select()

    if (error) throw error
    if (!inserted || inserted.length === 0) {
      return new Response(
        JSON.stringify({ data: [], count: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
      )
    }

    const parentDeviceId = pairData.parent_device_id
    const { data: parentDevice } = await adminClient
      .from('devices')
      .select('is_foreground, push_token, id')
      .eq('id', parentDeviceId)
      .single()

    const notificationIds = inserted.map((r: any) => r.id)

    if (parentDevice) {
      try {
        const isForeground = parentDevice.is_foreground === true

        if (isForeground) {
          await adminClient
            .from('mirrored_notifications')
            .update({ delivery_mode: 'realtime' })
            .in('id', notificationIds)
        }

        const pushToken = parentDevice.push_token
        // Track FCM delivery success per notification id so push_delivery_logs
        // can record the actual outcome instead of relying on stale DB rows.
        const deliveryResults = new Map<string, 'success' | 'pending' | 'failed'>()
        if (!pushToken) {
          // No push token; mark every notification as pending (it will be
          // fetched on next app open).
          for (const id of notificationIds) deliveryResults.set(id, 'pending')
        } else {
          const batchCount = inserted.length
          if (batchCount >= 4) {
            const firstApp = rows[0]?.source_app_name || 'apps'
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
                .in('id', notificationIds)
              for (const id of notificationIds) deliveryResults.set(id, 'success')
            } else {
              for (const id of notificationIds) deliveryResults.set(id, 'failed')
            }
            if (result.unregisteredToken) {
              await adminClient
                .from('devices')
                .update({ push_token: null })
                .eq('id', parentDeviceId)
            }
          } else {
            const results = await Promise.all(
              rows.map(async (n, idx) => {
                const sent = await sendParentPush(
                  pushToken,
                  n.source_app_name || 'Notification',
                  n.notification_title.slice(0, 120) || '',
                )
                return {
                  id: (inserted[idx] as any).id as string,
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

        // Log push delivery attempts to push_delivery_logs. Use the per-id
        // deliveryResults map so the recorded status reflects what actually
        // happened, not the stale `delivery_mode` from the upsert return.
        // Skip entirely when the parent has no push token — we don't want
        // the table to fill up with pending rows for parents who never
        // registered for push.
        if (notificationIds.length > 0 && pushToken) {
          const attemptedAt = new Date().toISOString()
          const logRows = notificationIds.map((id) => ({
            notification_id: id,
            pair_id: pairId,
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

    return new Response(
      JSON.stringify({ data: inserted, count: inserted.length, dropped: droppedCount }),
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
