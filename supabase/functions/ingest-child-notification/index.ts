import { serve } from "https://deno.land/std@0.192.0/http/server.ts"
import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { verifyAuth } from '../_shared/auth-verifier.ts'
import { getAdminClient } from '../_shared/supabase-admin.ts'

function isValidNotification(n: Record<string, unknown>): boolean {
  return !!(n.child_device_id && n.pair_id)
}

async function sendFcmPush(
  supabaseUrl: string,
  serviceRoleKey: string,
  deviceToken: string,
  title: string,
  body: string,
  notificationCount?: number,
): Promise<boolean> {
  const url = `${supabaseUrl}/functions/v1/send-parent-push`
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${serviceRoleKey}`,
    },
    body: JSON.stringify({
      device_token: deviceToken,
      title,
      body,
      notification_count: notificationCount,
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    console.error('FCM push failed:', err)
    return false
  }
  return true
}

serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    const authHeader = req.headers.get('Authorization')
    const user = await verifyAuth(authHeader)

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const adminClient = getAdminClient()

    const payload = await req.json()

    const notifications: Record<string, unknown>[] = payload.notifications
      ? payload.notifications
      : [payload]

    if (notifications.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No notifications provided' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 },
      )
    }

    if (notifications.length > 100) {
      return new Response(
        JSON.stringify({ error: 'Batch size exceeds limit of 100' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 },
      )
    }

    // Validate all notifications have same pair_id and belong to user
    const pairId = notifications[0].pair_id as string
    const child_device_id = notifications[0].child_device_id as string

    // Verify user owns the child_device
    const { data: childDevice } = await adminClient
      .from('devices')
      .select('user_id')
      .eq('id', child_device_id)
      .eq('role', 'child')
      .single()

    if (!childDevice || childDevice.user_id !== user.id) {
      return new Response(
        JSON.stringify({ error: 'Not authorized to post notifications for this device' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 },
      )
    }

    // Verify pair exists and is active
    const { data: pairData } = await adminClient
      .from('pairs')
      .select('parent_device_id, child_device_id, status')
      .eq('id', pairId)
      .eq('child_device_id', child_device_id)
      .single()

    if (!pairData || pairData.status !== 'active') {
      return new Response(
        JSON.stringify({ error: 'Invalid or inactive pair' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 },
      )
    }

    const rows = notifications.map((n) => ({
      pair_id: n.pair_id,
      child_device_id: n.child_device_id,
      source_package: n.source_package || null,
      source_app_name: n.source_app_name || null,
      notification_title: n.notification_title || '',
      notification_body: n.notification_body || '',
      notification_posted_at: n.notification_posted_at || new Date().toISOString(),
      notification_key: n.notification_key || null,
      metadata_json: n.metadata_json || null,
      delivery_mode: 'pending' as const,
    }))

    // Use ON CONFLICT for deduplication
    const { data: inserted, error } = await adminClient
      .from('mirrored_notifications')
      .upsert(rows, { onConflict: 'pair_id, child_device_id, notification_key' })
      .select()

    if (error) throw error

    const parentDeviceId = pairData.parent_device_id
    const { data: parentDevice } = await adminClient
      .from('devices')
      .select('is_foreground, push_token')
      .eq('id', parentDeviceId)
      .single()

    const notificationIds = inserted.map((r: any) => r.id)

    if (parentDevice) {
      const isForeground = parentDevice.is_foreground === true
      const pushToken = parentDevice.push_token

      if (isForeground) {
        await adminClient
          .from('mirrored_notifications')
          .update({ delivery_mode: 'realtime' })
          .in('id', notificationIds)
      }

      if (pushToken) {
        const batchCount = inserted.length
        if (batchCount >= 4) {
          const firstApp = rows[0]?.source_app_name || 'apps'
          const success = await sendFcmPush(
            supabaseUrl,
            serviceRoleKey,
            pushToken,
            `${batchCount} new notifications`,
            `${batchCount} notification${batchCount > 1 ? 's' : ''} from ${firstApp}${batchCount > 1 ? ' and others' : ''}`,
            batchCount,
          )
          if (success) {
            await adminClient
              .from('mirrored_notifications')
              .update({ delivery_mode: 'push' })
              .in('id', notificationIds)
          }
        } else {
          const successCount = await Promise.all(
            rows.map(async (n) => {
              const sent = await sendFcmPush(
                supabaseUrl,
                serviceRoleKey,
                pushToken,
                n.source_app_name || 'Notification',
                n.notification_title?.slice(0, 120) || '',
              )
              return sent ? 1 : 0
            })
          ).then(counts => counts.reduce((sum, c) => sum + c, 0))

          if (successCount > 0) {
            await adminClient
              .from('mirrored_notifications')
              .update({ delivery_mode: 'push' })
              .in('id', notificationIds.slice(0, successCount))
          }
        }
      }
    }

    return new Response(
      JSON.stringify({ data: inserted, count: inserted?.length ?? 0 }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
    )
  } catch (error) {
    const status = error.message.includes('Unauthorized') ? 401
      : error.message.includes('Too many') ? 429
      : error.message.includes('Not authorized') ? 403
      : 400
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status },
    )
  }
})
