import { serve } from "https://deno.land/std@0.192.0/http/server.ts"
import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { getAdminClient } from '../_shared/supabase-admin.ts'
import { logger, mapError } from '../_shared/logger.ts'
import { verifyWebhookSignature } from '../_shared/phonepe-client.ts'

function addFrequency(planFrequency: string, from: Date): Date {
  const d = new Date(from.getTime())
  if (planFrequency === 'yearly') {
    d.setFullYear(d.getFullYear() + 1)
  } else {
    d.setMonth(d.getMonth() + 1)
  }
  return d
}

serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    const rawBody = await req.text()

    // Signature verification is best-effort: if PHONEPE_WEBHOOK_SECRET is not
    // configured yet, accept the callback so sandbox testing isn't blocked.
    const xVerify = req.headers.get('X-VERIFY')
    const ok = await verifyWebhookSignature(rawBody, xVerify)
    if (!ok) {
      logger.warn('phonepe-autopay-webhook', 'signature verification failed')
      return new Response(
        JSON.stringify({ error: 'Invalid signature' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 },
      )
    }

    let event: Record<string, unknown>
    try {
      event = JSON.parse(rawBody)
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid body' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 },
      )
    }

    const adminClient = getAdminClient()

    // The event may be at top level or nested under `payload`.
    const payload = (event.payload && typeof event.payload === 'object')
      ? event.payload as Record<string, unknown>
      : event

    const eventType = String(event.event ?? event.type ?? payload.event ?? payload.type ?? '')
    const merchantSubscriptionId = String(
      payload.merchantSubscriptionId ??
      event.merchantSubscriptionId ??
      payload.merchant_subscription_id ??
      '',
    )
    const merchantOrderId = String(
      payload.merchantOrderId ??
      event.merchantOrderId ??
      payload.merchant_order_id ??
      '',
    )

    if (!merchantSubscriptionId && !merchantOrderId) {
      logger.warn('phonepe-autopay-webhook', 'no subscription/order identifier in payload')
      return new Response(
        JSON.stringify({ error: 'Missing identifier' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 },
      )
    }

    // Look up our subscription row.
    let query = adminClient.from('subscriptions').select('*')
    if (merchantSubscriptionId) {
      query = query.eq('merchant_subscription_id', merchantSubscriptionId)
    } else {
      query = query.eq('merchant_order_id', merchantOrderId)
    }
    const { data: subscription, error: subError } = await query.maybeSingle()
    if (subError) throw subError
    if (!subscription) {
      logger.warn('phonepe-autopay-webhook', 'unknown subscription', { merchantSubscriptionId, merchantOrderId })
      return new Response(
        JSON.stringify({ error: 'Subscription not found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 },
      )
    }

    // Map PhonePe events to our status.
    const lower = eventType.toLowerCase()
    let status: string | null = null
    if (lower.includes('activate')) status = 'active'
    else if (lower.includes('charge') || lower.includes('redemption') || lower.includes('debit')) status = 'active'
    else if (lower.includes('paus')) status = 'paused'
    else if (lower.includes('revoke') || lower.includes('cancel')) status = 'revoked'
    else if (lower.includes('expire')) status = 'expired'

    const updates: Record<string, unknown> = {}
    if (status) {
      updates.status = status
      if (status === 'active') {
        const start = new Date()
        const { data: plan } = await adminClient
          .from('plans')
          .select('frequency')
          .eq('id', subscription.plan_id)
          .maybeSingle()
        updates.current_cycle_start = start.toISOString()
        updates.current_cycle_end = addFrequency(plan?.frequency ?? 'monthly', start).toISOString()
        updates.next_charge_at = updates.current_cycle_end
      }
    }
    if (typeof payload.amount === 'number') {
      updates.last_charge_amount_paise = payload.amount
    }

    if (Object.keys(updates).length > 0) {
      const { error: updateError } = await adminClient
        .from('subscriptions')
        .update(updates)
        .eq('id', subscription.id)
      if (updateError) throw updateError
    }

    await adminClient.from('subscription_events').insert({
      user_id: subscription.user_id,
      subscription_id: subscription.id,
      event_type: eventType || 'unknown',
      payload: payload,
    }).throwOnError()

    logger.info('phonepe-autopay-webhook', 'event processed', {
      eventType,
      subscriptionId: subscription.id,
      status,
    })

    return new Response(
      JSON.stringify({ data: { received: true } }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
    )
  } catch (error) {
    const { status, error: safeMsg } = mapError(error)
    logger.error('phonepe-autopay-webhook', safeMsg, error instanceof Error ? error.message : error)
    return new Response(
      JSON.stringify({ error: safeMsg }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status },
    )
  }
})
