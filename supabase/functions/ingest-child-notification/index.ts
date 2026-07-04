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
): Promise<void> {
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
  }
}

serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    const authHeader = req.headers.get('Authorization')
    await verifyAuth(authHeader)

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

    const invalid = notifications.find((n) => !isValidNotification(n))
    if (invalid) {
      return new Response(
        JSON.stringify({ error: 'Each notification requires child_device_id and pair_id' }),
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
      delivery_mode: 'pending' as const,
    }))

    const { data: inserted, error } = await adminClient
      .from('mirrored_notifications')
      .insert(rows)
      .select()

    if (error) throw error

    const pairId = notifications[0].pair_id as string
    const batchCount = notifications.length

    const { data: pairData } = await adminClient
      .from('pairs')
      .select('parent_device_id')
      .eq('id', pairId)
      .single()

    if (pairData) {
      const { data: parentDevice } = await adminClient
        .from('devices')
        .select('is_foreground, push_token')
        .eq('id', pairData.parent_device_id)
        .single()

      const isForeground = parentDevice?.is_foreground === true
      const pushToken = parentDevice?.push_token
      const notificationIds = (inserted ?? []).map((r: any) => r.id)

      if (isForeground) {
        await adminClient
          .from('mirrored_notifications')
          .update({ delivery_mode: 'realtime' })
          .in('id', notificationIds)
      } else if (pushToken) {
        if (batchCount >= 4) {
          const firstApp = rows[0]?.source_app_name || 'apps'
          await sendFcmPush(
            supabaseUrl,
            serviceRoleKey,
            pushToken,
            `${batchCount} new notifications`,
            `${batchCount} notification${batchCount > 1 ? 's' : ''} from ${firstApp}${batchCount > 1 ? ' and others' : ''}`,
            batchCount,
          )
        } else {
          await Promise.all(
            rows.map((n) =>
              sendFcmPush(
                supabaseUrl,
                serviceRoleKey,
                pushToken,
                n.source_app_name || 'Notification',
                n.notification_title?.slice(0, 120) || '',
              )
            ),
          )
        }

        await adminClient
          .from('mirrored_notifications')
          .update({ delivery_mode: 'push' })
          .in('id', notificationIds)
      }
    }

    return new Response(
      JSON.stringify({ data: inserted, count: inserted?.length ?? 0 }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
    )
  } catch (error) {
    const status = error.message.includes('Unauthorized') ? 401 : 400
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status },
    )
  }
})
