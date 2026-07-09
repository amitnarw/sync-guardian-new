import { serve } from "https://deno.land/std@0.192.0/http/server.ts"
import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { verifyAuth } from '../_shared/auth-verifier.ts'
import { getAdminClient } from '../_shared/supabase-admin.ts'
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
    const { device_id } = requireBody(body, ['device_id'])
    const deviceId = device_id as string

    if (!isValidUUID(deviceId)) {
      return new Response(
        JSON.stringify({ error: 'Invalid device_id format' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 },
      )
    }

    // Verify the user owns this device
    const { data: device } = await adminClient
      .from('devices')
      .select('id, user_id')
      .eq('id', deviceId)
      .single()

    if (!device) {
      return new Response(
        JSON.stringify({ error: 'Device not found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 },
      )
    }

    // If the device exists but belongs to a different user, check if it's still
    // actively paired. If so, the user must unpair first. If not, repair ownership
    // to handle stale persisted deviceId from a previous auth session.
    if (device.user_id !== user.id) {
      const { data: activePair } = await adminClient
        .from('pairs')
        .select('id')
        .or(`parent_device_id.eq.${deviceId},child_device_id.eq.${deviceId}`)
        .in('status', ['active', 'pending'])
        .maybeSingle()

      if (activePair) {
        return new Response(
          JSON.stringify({ error: 'Device is currently paired. Please unpair first.' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 409 },
        )
      }

      const { error: reassignError } = await adminClient
        .from('devices')
        .update({ user_id: user.id })
        .eq('id', deviceId)

      if (reassignError) {
        return new Response(
          JSON.stringify({ error: 'Device registered to another account. Please re-register this device.' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 409 },
        )
      }
    }

    const now = new Date().toISOString()
    const updates: Record<string, unknown> = {
      is_foreground: body.is_foreground !== undefined ? !!body.is_foreground : undefined,
      last_seen_at: now,
      updated_at: now,
      push_token: body.push_token !== undefined ? body.push_token : undefined,
      user_id: user.id,
    }

    // Remove undefined keys so we don't overwrite with nulls
    const cleanUpdates: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        cleanUpdates[key] = value
      }
    }

    const { error: updateError } = await adminClient
      .from('devices')
      .update(cleanUpdates)
      .eq('id', deviceId)

    if (updateError) throw updateError

    return new Response(
      JSON.stringify({ data: { id: deviceId, last_seen_at: now } }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
    )
  } catch (error) {
    const { status, error: safeMsg } = mapError(error)
    logger.error('sync-device', safeMsg, error instanceof Error ? error.message : error)
    return new Response(
      JSON.stringify({ error: safeMsg }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status },
    )
  }
})
