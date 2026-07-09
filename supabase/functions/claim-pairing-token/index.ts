import { serve } from "https://deno.land/std@0.192.0/http/server.ts"
import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { verifyAuth, checkRateLimit } from '../_shared/auth-verifier.ts'
import { getAdminClient } from '../_shared/supabase-admin.ts'
import { verifyQrJwt } from '../_shared/qr-jwt.ts'
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
    const device_name = sanitizeString(body.device_name, 100) || 'Parent Device'

    checkRateLimit(req.headers.get('x-forwarded-for') ?? user.id)

    let token: string | null = body.token || null
    let code: string | null = body.code || null

    // If QR JWT provided, verify and extract token/code
    if (body.qr_jwt) {
      const result = await verifyQrJwt(body.qr_jwt)
      if (!result.ok) {
        // Log the reason (sanitized) without exposing the secret or token
        logger.warn('claim-pairing-token', 'QR JWT verification failed', { reason: result.reason })
        const message =
          result.reason === 'expired'
            ? 'This QR code has expired. Ask the child to tap Regenerate and scan the new code.'
            : result.reason === 'bad_signature'
              ? 'QR code signature is invalid. The pairing secret may be misconfigured.'
              : 'This QR code is not valid. Ask the child to tap Regenerate and scan the new code.'
        return new Response(
          JSON.stringify({ error: message }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 },
        )
      }
      token = result.payload.token
      code = result.payload.code
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
    const msg = error instanceof Error ? error.message : ''
    const lower = msg.toLowerCase()
    if (lower.includes('expired') || (lower.includes('invalid') && lower.includes('pair'))) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired pairing code.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 },
      )
    }
    const { status, error: safeMsg } = mapError(error)
    logger.error('claim-pairing-token', safeMsg, msg)
    return new Response(
      JSON.stringify({ error: safeMsg }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status },
    )
  }
})
