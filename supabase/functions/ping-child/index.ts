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
      return new Response(
        JSON.stringify({ error: 'Not authorized to ping this child device' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 },
      )
    }

    // Look up the child's push token
    const { data: childDevice } = await adminClient
      .from('devices')
      .select('push_token')
      .eq('id', childDeviceId)
      .single()

    const pushToken = childDevice?.push_token
    if (!pushToken) {
      return new Response(
        JSON.stringify({ error: 'Child device does not have a push token registered' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 },
      )
    }

    const result = await sendChildRecoveryPush(pushToken)

    if (!result.success && result.unregisteredToken) {
      // Clear the stale token
      await adminClient
        .from('devices')
        .update({ push_token: null })
        .eq('id', childDeviceId)
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
