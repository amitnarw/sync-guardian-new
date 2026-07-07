import { serve } from "https://deno.land/std@0.192.0/http/server.ts"
import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { verifyAuth } from '../_shared/auth-verifier.ts'
import { getAdminClient } from '../_shared/supabase-admin.ts'
import { isValidUUID, requireBody, ValidationError } from '../_shared/validation.ts'

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
      .select('id')
      .eq('id', deviceId)
      .eq('user_id', user.id)
      .single()

    if (!device) {
      return new Response(
        JSON.stringify({ error: 'Device not found or not owned by user' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 },
      )
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
    const msg = error.message || 'Unknown error'
    const status = msg.includes('Unauthorized') ? 401
      : msg.includes('Too many') ? 429
      : msg.includes('Not authorized') ? 403
      : msg.includes('ValidationError') ? 400
      : 400
    return new Response(
      JSON.stringify({ error: msg }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status },
    )
  }
})
