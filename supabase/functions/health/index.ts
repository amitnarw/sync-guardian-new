import { serve } from "https://deno.land/std@0.192.0/http/server.ts"
import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { getAdminClient } from '../_shared/supabase-admin.ts'

serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    const checks: Record<string, boolean | string> = {}

    // Check Supabase connection
    try {
      const adminClient = getAdminClient()
      const { data, error } = await adminClient.from('devices').select('id').limit(1)
      checks.database = error ? `error: ${error.message}` : true
    } catch (e) {
      checks.database = `error: ${e.message}`
    }

    // Check FIREBASE_SERVICE_ACCOUNT_JSON
    try {
      const raw = Deno.env.get('FIREBASE_SERVICE_ACCOUNT_JSON')
      if (raw) {
        const parsed = JSON.parse(raw)
        checks.firebase = parsed.project_id ? true : 'missing project_id'
      } else {
        checks.firebase = 'not configured'
      }
    } catch {
      checks.firebase = 'malformed JSON'
    }

    // Check required env vars
    const requiredVars = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'QR_JWT_SECRET']
    for (const v of requiredVars) {
      checks[v] = Deno.env.get(v) ? true : 'missing'
    }

    const allHealthy = Object.values(checks).every(v => v === true)

    return new Response(
      JSON.stringify({
        status: allHealthy ? 'healthy' : 'degraded',
        timestamp: new Date().toISOString(),
        checks,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: allHealthy ? 200 : 503,
      },
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ status: 'unhealthy', error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 },
    )
  }
})
