import { serve } from "https://deno.land/std@0.192.0/http/server.ts"
import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { verifyAuth } from '../_shared/auth-verifier.ts'
import { getAdminClient } from '../_shared/supabase-admin.ts'
import { logger, mapError } from '../_shared/logger.ts'
import { cancelPhonePeSubscription } from '../_shared/phonepe-client.ts'

serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    const user = await verifyAuth(req.headers.get('Authorization'))
    const adminClient = getAdminClient()

    const { data: subscription } = await adminClient
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .in('status', ['pending', 'active', 'paused'])
      .maybeSingle()

    if (!subscription) {
      return new Response(
        JSON.stringify({ error: 'No active subscription to cancel' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 },
      )
    }

    // Complimentary admin-granted subscriptions have no PhonePe mandate to
    // cancel; route them through the admin panel only.
    if (subscription.source === 'gift') {
      return new Response(
        JSON.stringify({
          error:
            'This subscription was granted by support and cannot be cancelled from the app. Please contact support.',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 409 },
      )
    }

    // Ask PhonePe to cancel the mandate, but allow local cancellation to
    // proceed even if the remote call fails (e.g. sandbox credentials not
    // configured yet) so the app is never left locked.
    let remoteCancelled = false
    if (subscription.merchant_subscription_id) {
      try {
        await cancelPhonePeSubscription(subscription.merchant_subscription_id)
        remoteCancelled = true
      } catch (e) {
        logger.warn('cancel-subscription', 'phonepe cancel failed, proceeding locally', {
          message: e instanceof Error ? e.message : 'unknown',
        })
      }
    }

    const now = new Date().toISOString()
    // Scope by both id AND user_id. The earlier select already filters by
    // user_id, but service_role bypasses RLS — so a forged request could
    // (in theory) name a subscription id owned by someone else. Adding the
    // user_id guard makes the mutation atomic and ownership-checked.
    const { error: updateError } = await adminClient
      .from('subscriptions')
      .update({ status: 'revoked', revoked_at: now, error_message: null })
      .eq('id', subscription.id)
      .eq('user_id', user.id)
    if (updateError) throw updateError

    await adminClient.from('subscription_events').insert({
      user_id: user.id,
      subscription_id: subscription.id,
      event_type: 'cancelled',
      payload: { source: 'user', remoteCancelled, cancelled_at: now },
    }).throwOnError()

    return new Response(
      JSON.stringify({ data: { status: 'revoked', remoteCancelled } }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
    )
  } catch (error) {
    const { status, error: safeMsg } = mapError(error)
    logger.error('cancel-subscription', safeMsg, error instanceof Error ? error.message : error)
    return new Response(
      JSON.stringify({ error: safeMsg }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status },
    )
  }
})
