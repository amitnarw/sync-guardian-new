import { serve } from "https://deno.land/std@0.192.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { verifyAuth } from '../_shared/auth-verifier.ts'
import { getAdminClient } from '../_shared/supabase-admin.ts'

serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    const authHeader = req.headers.get('Authorization')
    const user = await verifyAuth(authHeader)

    const adminClient = getAdminClient()
    const { device_name = 'Child Device' } = await req.json()

    // Check if user already has a child device — prevent duplicates
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

    const code = Math.floor(100000 + Math.random() * 900000).toString()
    const token = crypto.randomUUID()
    const expires_at = new Date(Date.now() + 10 * 60000).toISOString()

    const { data, error } = await adminClient
      .from('pairing_tokens')
      .insert({ child_device_id, code, token, expires_at })
      .select()
      .single()

    if (error) throw error

    return new Response(
      JSON.stringify({ data }),
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
