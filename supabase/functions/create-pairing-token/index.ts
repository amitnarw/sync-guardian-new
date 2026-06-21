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

    const { device_name = 'Child Device' } = await req.json()

    const child_device_id = crypto.randomUUID();

    // 1. Insert device into devices table to satisfy foreign key constraint
    const { error: deviceError } = await supabaseClient
      .from('devices')
      .insert({
        id: child_device_id,
        role: 'child',
        device_name: device_name,
        platform: 'android'
      })

    if (deviceError) throw deviceError;

    // Generate a 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString()
    // Generate a secure token
    const token = crypto.randomUUID()
    
    // Expires in 10 minutes
    const expires_at = new Date(Date.now() + 10 * 60000).toISOString()

    const { data, error } = await supabaseClient
      .from('pairing_tokens')
      .insert({
        child_device_id,
        code,
        token,
        expires_at
      })
      .select()
      .single()

    if (error) throw error

    return new Response(
      JSON.stringify({ data }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
