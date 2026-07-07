import { serve } from "https://deno.land/std@0.192.0/http/server.ts"
import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { verifyAuth, checkRateLimit } from '../_shared/auth-verifier.ts'
import { getAdminClient } from '../_shared/supabase-admin.ts'
import { verifyQrJwt } from '../_shared/qr-jwt.ts'
import { isValidString, sanitizeString, ValidationError } from '../_shared/validation.ts'

serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    const authHeader = req.headers.get('Authorization')
    const user = await verifyAuth(authHeader)

    const adminClient = getAdminClient()
    const body = await req.json()
    const device_name = sanitizeString(body.device_name, 100) || 'Parent Device'

    checkRateLimit(req.headers.get('x-forwarded-for') ?? user.id)

    let token: string | null = body.token || null
    let code: string | null = body.code || null

    // If QR JWT provided, verify and extract token/code
    if (body.qr_jwt) {
      const qrPayload = await verifyQrJwt(body.qr_jwt)
      if (!qrPayload) {
        return new Response(
          JSON.stringify({ error: 'Invalid or expired QR code' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 },
        )
      }
      token = qrPayload.token
      code = qrPayload.code
    }

    if (!token && !code) {
      return new Response(
        JSON.stringify({ error: 'token, code, or qr_jwt is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 },
      )
    }

    const { data, error } = await adminClient.rpc('claim_pairing_token', {
      p_token: token || null,
      p_code: code || null,
      p_parent_user_id: user.id,
      p_parent_device_name: device_name,
    })

    if (error) throw new Error(error.message)

    return new Response(
      JSON.stringify({ data: { ...data, parent_device_id: data?.parent_device_id || 'unknown' } }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
    )
  } catch (error) {
    const msg = error.message || 'Unknown error'
    const status = msg.includes('Unauthorized') ? 401
      : msg.includes('Too many') ? 429
      : msg.includes('Invalid or expired') ? 400
      : msg.includes('ValidationError') ? 400
      : 400
    return new Response(
      JSON.stringify({ error: msg }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status },
    )
  }
})
