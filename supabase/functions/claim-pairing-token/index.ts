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

    // Generate parent device_id
    const parent_device_id = crypto.randomUUID()

    const { error: deviceError } = await adminClient
      .from('devices')
      .insert({
        id: parent_device_id,
        user_id: user.id,
        role: 'parent',
        device_name,
        platform: 'android',
      })

    if (deviceError) throw deviceError

    const query = adminClient
      .from('pairing_tokens')
      .select('*')
      .is('consumed_at', null)
      .gt('expires_at', new Date().toISOString())

    if (token) {
      query.eq('token', token)
    } else {
      query.eq('code', code)
    }

    const { data: tokenData, error: tokenError } = await query.single()

    if (tokenError || !tokenData) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 },
      )
    }

    // Fetch child device owner for RLS
    const { data: childDevice } = await adminClient
      .from('devices')
      .select('user_id')
      .eq('id', tokenData.child_device_id)
      .single()

    // Create the pair first, so we have the pair_id
    const { data: pairData, error: pairError } = await adminClient
      .from('pairs')
      .insert({
        parent_device_id,
        child_device_id: tokenData.child_device_id,
        parent_user_id: user.id,
        child_user_id: childDevice?.user_id,
        status: 'active',
      })
      .select()
      .single()

    if (pairError) throw pairError

    // Mark token as consumed with the pair_id
    const { error: updateError } = await adminClient
      .from('pairing_tokens')
      .update({ consumed_at: new Date().toISOString(), pair_id: pairData.id })
      .eq('id', tokenData.id)

    if (updateError) throw updateError

    return new Response(
      JSON.stringify({ data: { ...pairData, parent_device_id } }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
    )
  } catch (error) {
    const status = error.message.includes('Unauthorized') ? 401
      : error.message.includes('Too many') ? 429
      : 400
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status },
    )
  }
})
