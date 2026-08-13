import { serve } from "https://deno.land/std@0.192.0/http/server.ts"
import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { verifyAuth } from '../_shared/auth-verifier.ts'
import { getAdminClient } from '../_shared/supabase-admin.ts'
import { logger, mapError } from '../_shared/logger.ts'

serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    const user = await verifyAuth(req.headers.get('Authorization'))
    const adminClient = getAdminClient()

    const { data: trial } = await adminClient
      .from('user_trials')
      .select('status, started_at, ends_at')
      .eq('user_id', user.id)
      .maybeSingle()

    const { data: subscription } = await adminClient
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .in('status', ['pending', 'active', 'paused'])
      .maybeSingle()

    // Determine access. Trial grants access until it ends; an active
    // subscription supersedes any trial. Trial "used" once it expires
    // or the user subscribes.
    const now = Date.now()
    let hasAccess = false
    let reason: 'trial' | 'subscription' | 'none' = 'none'

    if (subscription && (subscription.status === 'active' || subscription.status === 'paused')) {
      hasAccess = true
      reason = 'subscription'
    } else if (trial && trial.status === 'active' && trial.ends_at && new Date(trial.ends_at).getTime() > now) {
      hasAccess = true
      reason = 'trial'
    }

    return new Response(
      JSON.stringify({
        data: {
          hasAccess,
          reason,
          trial: trial
            ? {
                status: trial.status,
                started_at: trial.started_at,
                ends_at: trial.ends_at,
                days_remaining: trial.ends_at
                  ? Math.max(0, Math.ceil((new Date(trial.ends_at).getTime() - now) / 86_400_000))
                  : 0,
              }
            : null,
          subscription: subscription ?? null,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
    )
  } catch (error) {
    const { status, error: safeMsg } = mapError(error)
    logger.error('get-my-subscription', safeMsg, error instanceof Error ? error.message : error)
    return new Response(
      JSON.stringify({ error: safeMsg }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status },
    )
  }
})
