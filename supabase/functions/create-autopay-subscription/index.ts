import { serve } from "https://deno.land/std@0.192.0/http/server.ts"
import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { verifyAuth } from '../_shared/auth-verifier.ts'
import { getAdminClient } from '../_shared/supabase-admin.ts'
import { requireBody, isValidString } from '../_shared/validation.ts'
import { logger, mapError } from '../_shared/logger.ts'
import {
  createSubscriptionOrder,
  PhonePeFrequency,
  IS_SANDBOX,
} from '../_shared/phonepe-client.ts'

// Cryptographically random alphanumeric id (AGENTS.md: crypto.getRandomValues).
function randomId(prefix: string, length = 20): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  let out = prefix
  for (let i = 0; i < bytes.length; i++) {
    out += alphabet[bytes[i] % alphabet.length]
  }
  return out
}

const FREQUENCY_MAP: Record<string, PhonePeFrequency> = {
  monthly: 'MONTHLY',
  yearly: 'YEARLY',
}

serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    const user = await verifyAuth(req.headers.get('Authorization'))
    const adminClient = getAdminClient()

    const missingSecrets: string[] = []
    if (!Deno.env.get('PHONEPE_ENV')) missingSecrets.push('PHONEPE_ENV')
    if (!Deno.env.get('PHONEPE_CLIENT_ID')) missingSecrets.push('PHONEPE_CLIENT_ID')
    if (!Deno.env.get('PHONEPE_CLIENT_VERSION')) missingSecrets.push('PHONEPE_CLIENT_VERSION')
    if (!Deno.env.get('PHONEPE_CLIENT_SECRET')) missingSecrets.push('PHONEPE_CLIENT_SECRET')
    if (!Deno.env.get('PHONEPE_MERCHANT_ID')) missingSecrets.push('PHONEPE_MERCHANT_ID')
    if (missingSecrets.length > 0) {
      logger.warn('create-autopay-subscription', 'missing required PhonePe secrets', {
        missing: missingSecrets,
      })
    }

    const body = await req.json()
    const { plan_id } = requireBody(body, ['plan_id'])
    if (!isValidString(plan_id, 64)) {
      return new Response(
        JSON.stringify({ error: 'Invalid plan_id' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 },
      )
    }

    const { data: plan, error: planError } = await adminClient
      .from('plans')
      .select('*')
      .eq('id', plan_id)
      .eq('active', true)
      .maybeSingle()
    if (planError) throw planError
    if (!plan) {
      return new Response(
        JSON.stringify({ error: 'Plan not found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 },
      )
    }

    // Only one live subscription per user; switching plans means cancelling first.
    const { data: existing } = await adminClient
      .from('subscriptions')
      .select('id, status')
      .eq('user_id', user.id)
      .in('status', ['pending', 'active', 'paused'])
      .maybeSingle()
    if (existing) {
      // A stale `pending` row means a previous mandate setup was interrupted
      // or its order expired. Replace it so the user can retry. Active/paused
      // mandates must be explicitly cancelled first.
      if (existing.status !== 'pending') {
        return new Response(
          JSON.stringify({ error: 'An active subscription already exists. Cancel it before changing plans.' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 409 },
        )
      }
      const { error: deleteError } = await adminClient
        .from('subscriptions')
        .delete()
        .eq('id', existing.id)
      if (deleteError) throw deleteError
    }

    const frequency = FREQUENCY_MAP[plan.frequency as string] ?? 'MONTHLY'
    const merchantOrderId = randomId('ORD')
    const merchantSubscriptionId = randomId('SUB')

    const result = await createSubscriptionOrder({
      merchantOrderId,
      merchantSubscriptionId,
      amountPaise: plan.amount_paise as number,
      maxAmountPaise: plan.max_amount_paise as number,
      frequency,
      metaInfo: {
        udf1: user.id,
        udf2: String(plan_id),
      },
    })

    const { data: subscription, error: insertError } = await adminClient
      .from('subscriptions')
      .insert({
        user_id: user.id,
        plan_id: plan_id,
        status: 'pending',
        merchant_order_id: merchantOrderId,
        merchant_subscription_id: merchantSubscriptionId,
        phonepe_order_id: result.orderId,
        error_message: null,
      })
      .select('id')
      .single()
    if (insertError) throw insertError

    await adminClient.from('subscription_events').insert({
      user_id: user.id,
      subscription_id: subscription.id,
      event_type: 'order_created',
      payload: { merchantOrderId, merchantSubscriptionId, orderId: result.orderId },
    }).throwOnError()

    return new Response(
      JSON.stringify({
        data: {
          subscriptionId: subscription.id,
          merchantId: Deno.env.get('PHONEPE_MERCHANT_ID') ?? '',
          orderId: result.orderId,
          token: result.token,
          environment: IS_SANDBOX ? 'SANDBOX' : 'PRODUCTION',
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
    )
  } catch (error) {
    const { status, error: safeMsg } = mapError(error)
    logger.error('create-autopay-subscription', safeMsg, error instanceof Error ? error.message : error)
    return new Response(
      JSON.stringify({ error: safeMsg }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status },
    )
  }
})
