import { serve } from "https://deno.land/std@0.192.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { token, code, device_name = 'Parent Device' } = await req.json()

    if (!token && !code) {
      return new Response(
        JSON.stringify({ error: 'token or code is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    const parent_device_id = crypto.randomUUID();

    // Ensure Parent device exists in devices table
    const { error: deviceError } = await supabaseClient
      .from('devices')
      .insert({
        id: parent_device_id,
        role: 'parent',
        device_name,
        platform: 'android'
      })

    if (deviceError) throw deviceError;

    // Find the token
    const query = supabaseClient
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
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Mark token as consumed and create the pair
    const { error: updateError } = await supabaseClient
      .from('pairing_tokens')
      .update({ consumed_at: new Date().toISOString() })
      .eq('id', tokenData.id)

    if (updateError) throw updateError

    // Create the pair
    const { data: pairData, error: pairError } = await supabaseClient
      .from('pairs')
      .insert({
        parent_device_id,
        child_device_id: tokenData.child_device_id,
        status: 'active',
      })
      .select()
      .single()

    if (pairError) throw pairError

    return new Response(
      JSON.stringify({ data: { ...pairData, parent_device_id } }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
