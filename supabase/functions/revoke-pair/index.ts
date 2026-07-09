import { serve } from "https://deno.land/std@0.192.0/http/server.ts"
import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { verifyAuth } from '../_shared/auth-verifier.ts'
import { getAdminClient } from '../_shared/supabase-admin.ts'
import { sendPairRevokedPush } from '../_shared/fcm.ts'
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
    const { pair_id } = requireBody(body, ['pair_id'])
    const pairId = pair_id as string

    if (!isValidUUID(pairId)) {
      return new Response(
        JSON.stringify({ error: 'Invalid pair_id format' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 },
      )
    }

    // Verify the pair exists and the user owns it (either as parent or child)
    const { data: pair, error: pairError } = await adminClient
      .from('pairs')
      .select('id, parent_device_id, child_device_id')
      .eq('id', pairId)
      .single()

    if (pairError || !pair) {
      return new Response(
        JSON.stringify({ error: 'Pair not found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 },
      )
    }

    // Check if user owns either the parent or child device in the pair
    const { data: userDevices } = await adminClient
      .from('devices')
      .select('id')
      .eq('user_id', user.id)

    const deviceIds = userDevices?.map(d => d.id) || []
    const isOwner = deviceIds.includes(pair.parent_device_id) || deviceIds.includes(pair.child_device_id)

    if (!isOwner) {
      return new Response(
        JSON.stringify({ error: 'Not authorized to revoke this pair' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 },
      )
    }

    const { error: updateError } = await adminClient
      .from('pairs')
      .update({ status: 'revoked' })
      .eq('id', pairId)

    if (updateError) throw updateError

    // Determine the "other" device in the pair and notify via FCM
    const callerDeviceIds = deviceIds
    const isParentCaller = callerDeviceIds.includes(pair.parent_device_id)
    const revokedBy: 'parent' | 'child' = isParentCaller ? 'parent' : 'child'
    const otherDeviceId = isParentCaller ? pair.child_device_id : pair.parent_device_id

    const { data: otherDevice } = await adminClient
      .from('devices')
      .select('push_token')
      .eq('id', otherDeviceId)
      .maybeSingle()

    if (otherDevice?.push_token) {
      await sendPairRevokedPush(otherDevice.push_token, revokedBy, pairId).catch(
        (e) => logger.warn('revoke-pair', 'FCM push to other device failed', e),
      )
    }

    return new Response(
      JSON.stringify({ data: { id: pairId, status: 'revoked' } }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
    )
  } catch (error) {
    const { status, error: safeMsg } = mapError(error)
    logger.error('revoke-pair', safeMsg, error instanceof Error ? error.message : error)
    return new Response(
      JSON.stringify({ error: safeMsg }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status },
    )
  }
})
