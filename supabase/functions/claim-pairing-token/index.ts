import { serve } from "https://deno.land/std@0.192.0/http/server.ts"
import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { verifyAuth, checkRateLimit } from '../_shared/auth-verifier.ts'
import { getAdminClient } from '../_shared/supabase-admin.ts'

serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    const authHeader = req.headers.get('Authorization')
    const user = await verifyAuth(authHeader)

    const adminClient = getAdminClient()
    const { token, code, device_name = 'Parent Device' } = await req.json()

    if (!token && !code) {
      return new Response(
        JSON.stringify({ error: 'token or code is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 },
      )
    }

    // Rate limit by IP (will be behind Kong/API gateway in production)
    checkRateLimit(req.headers.get('x-forwarded-for') ?? user.id)

    // Use atomic RPC function
    const { data, error } = await adminClient.rpc('claim_pairing_token', {
      p_token: token || null,
      p_code: code || token,
      p_parent_user_id: user.id,
      p_parent_device_name: device_name,
    })

    if (error) throw new Error(error.message)

    return new Response(
      JSON.stringify({ data: { ...data, parent_device_id: data?.parent_device_id || 'unknown' } }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
    )
  } catch (error) {
    const status = error.message.includes('Unauthorized') ? 401
      : error.message.includes('Too many') ? 429
      : error.message.includes('Invalid or expired token') ? 400
      : 400
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status },
    )
  }
})
