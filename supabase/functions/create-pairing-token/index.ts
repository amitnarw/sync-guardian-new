import { serve } from "https://deno.land/std@0.192.0/http/server.ts"
import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { verifyAuth } from '../_shared/auth-verifier.ts'
import { getAdminClient } from '../_shared/supabase-admin.ts'
import { signQrJwt } from '../_shared/qr-jwt.ts'
import { isValidString, sanitizeString } from '../_shared/validation.ts'
import { logger, mapError } from '../_shared/logger.ts'

serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    const authHeader = req.headers.get('Authorization')
    const user = await verifyAuth(authHeader)

    const adminClient = getAdminClient()
    const body = await req.json()
    const device_name = sanitizeString(body.device_name, 100) || 'Child Device'

    const { data: existingDevice } = await adminClient
      .from('devices')
      .select('id')
      .eq('user_id', user.id)
      .eq('role', 'child')
      .single()

    const child_device_id = existingDevice?.id ?? crypto.randomUUID()

    if (!existingDevice) {
      const { error: deviceError } = await adminClient
        .from('devices')
        .insert({
          id: child_device_id,
          user_id: user.id,
          role: 'child',
          device_name,
          platform: 'android',
        })
      if (deviceError) throw deviceError
    }

    // Expire any existing unconsumed tokens for this child device
    await adminClient
      .from('pairing_tokens')
      .update({ consumed_at: new Date().toISOString() })
      .eq('child_device_id', child_device_id)
      .is('consumed_at', null)

    // Generate cryptographically random 6-digit code
    const array = new Uint32Array(1)
    crypto.getRandomValues(array)
    const code = String(100000 + (array[0] % 900000))
    const token = crypto.randomUUID()
    const expires_at = new Date(Date.now() + 10 * 60000).toISOString()

    const { data, error } = await adminClient
      .from('pairing_tokens')
      .insert({ child_device_id, code, token, expires_at })
      .select()
      .single()

    if (error) throw error

    // Sign QR JWT for QR code display
    const qrJwt = await signQrJwt({
      token,
      code,
      child_device_id,
      exp: Math.floor(Date.now() / 1000) + 600,
    })

    return new Response(
      JSON.stringify({ data: { ...data, qr_jwt: qrJwt } }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
    )
  } catch (error) {
    const { status, error: safeMsg } = mapError(error)
    logger.error('create-pairing-token', safeMsg, error instanceof Error ? error.message : error)
    return new Response(
      JSON.stringify({ error: safeMsg }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status },
    )
  }
})
