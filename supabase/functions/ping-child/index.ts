import { serve } from "https://deno.land/std@0.192.0/http/server.ts"
import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { verifyAuth } from '../_shared/auth-verifier.ts'
import { getAdminClient } from '../_shared/supabase-admin.ts'
import { sendChildRecoveryPush } from '../_shared/fcm.ts'
import { isValidUUID, requireBody } from '../_shared/validation.ts'
import { logger, mapError } from '../_shared/logger.ts'

serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    const authHeader = req.headers.get('Authorization')
    const user = await verifyAuth(authHeader)

    const adminClient = getAdminClient()
    const body = await req.json()
    const { child_device_id } = requireBody(body, ['child_device_id'])
    const childDeviceId = child_device_id as string

    if (!isValidUUID(childDeviceId)) {
      return new Response(
        JSON.stringify({ error: 'Invalid child_device_id format' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 },
      )
    }

    // Verify the parent owns a pair with this child
    const { data: pairData, error: pairError } = await adminClient
      .from('pairs')
      .select('id, parent_device_id')
      .eq('child_device_id', childDeviceId)
      .in('status', ['active', 'pending'])
      .maybeSingle()

    if (pairError || !pairData) {
      logger.warn('ping-child', 'no active pair', { childDeviceId })
      return new Response(
        JSON.stringify({ error: 'No active pair found with this child device' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 },
      )
    }

    // Verify the requesting user is the parent of this pair
    const { data: parentDevice } = await adminClient
      .from('devices')
      .select('id')
      .eq('id', pairData.parent_device_id)
      .eq('user_id', user.id)
      .single()

    if (!parentDevice) {
      logger.warn('ping-child', 'not authorized', { userId: user.id, parentDeviceId: pairData.parent_device_id })
      return new Response(
        JSON.stringify({ error: 'Not authorized to ping this child device' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 },
      )
    }

    // Look up the child's push token
    const { data: childDevice } = await adminClient
      .from('devices')
      .select('push_token, is_foreground, last_seen_at')
      .eq('id', childDeviceId)
      .single()

    const pushToken = childDevice?.push_token
    logger.info('ping-child', 'child device lookup', {
      hasToken: !!pushToken,
      isForeground: childDevice?.is_foreground,
      lastSeenAt: childDevice?.last_seen_at,
    })

    if (!pushToken) {
      logger.warn('ping-child', 'no push token registered on child device', { childDeviceId })
      return new Response(
        JSON.stringify({
          error: 'Child device has not registered for push alerts yet. Open the child app and grant the notification permission once to enable pings.',
          reason: 'no_push_token',
          delivered: false,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 409 },
      )
    }

    const result = await sendChildRecoveryPush(pushToken)
    logger.info('ping-child', 'FCM send result', { success: result.success, hasMessageId: !!result.messageId })

    if (!result.success && result.unregisteredToken) {
      logger.warn('ping-child', 'clearing stale push token', { childDeviceId })
      // Defense in depth: scope the token clear to the same pair we
      // verified above. The pair's parent_device_id is owned by the
      // caller, so a forged child_device_id cannot trigger this UPDATE.
      // If we can't re-confirm the pair exists and is active (e.g. it
      // was revoked between the ownership check and now), skip the
      // UPDATE entirely ,  better to leave a stale token than to wipe
      // a valid one through a chained query that may have misfired.
      const { data: livePair } = await adminClient
        .from('pairs')
        .select('id')
        .eq('parent_device_id', pairData.parent_device_id)
        .eq('child_device_id', childDeviceId)
        .in('status', ['active', 'pending'])
        .limit(1)
        .maybeSingle()
      if (livePair) {
        await adminClient
          .from('devices')
          .update({ push_token: null })
          .eq('id', childDeviceId)
      } else {
        logger.warn('ping-child', 'pair no longer live, skipping token clear', { childDeviceId })
      }
    }

    return new Response(
      JSON.stringify({ data: { success: result.success, messageId: result.messageId } }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
    )
  } catch (error) {
    const { status, error: safeMsg } = mapError(error)
    logger.error('ping-child', safeMsg, error instanceof Error ? error.message : error)
    return new Response(
      JSON.stringify({ error: safeMsg }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status },
    )
  }
})
