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

// Cap each idempotency-key component to avoid blowing past the ~2704-byte
// B-tree index limit on adversarial / pathological payloads.
const KEY_PART_MAX = 128

function truncateKeyPart(value: string, max = KEY_PART_MAX): string {
  if (!value) return value
  return value.length > max ? value.slice(0, max) : value
}

// PhonePe V2 sometimes sends `timestamp` as a numeric Unix epoch (in
// seconds or milliseconds), sometimes as an ISO 8601 string. Coerce all
// of those to a valid TIMESTAMPTZ-compatible ISO string or null so the
// `received_at` column never receives an unparseable value.
function parsePhonePeTimestamp(raw: unknown): string | null {
  if (raw == null) return null
  if (typeof raw === 'number') {
    // Heuristic: epochs beyond 10^12 are milliseconds, smaller are seconds.
    const ms = raw > 1e12 ? raw : raw * 1000
    const d = new Date(ms)
    return isNaN(d.getTime()) ? null : d.toISOString()
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim()
    if (!trimmed) return null
    if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
      const num = Number(trimmed)
      const ms = num > 1e12 ? num : num * 1000
      const d = new Date(ms)
      return isNaN(d.getTime()) ? null : d.toISOString()
    }
    const d = new Date(trimmed)
    return isNaN(d.getTime()) ? null : d.toISOString()
  }
  return null
}

// Canonical set of PhonePe V2 Autopay event types we currently handle.
// Anything outside this list is logged but treated as a no-op so an
// unknown event type cannot crash the webhook or leak an
// inappropriately-mapped status.
const HANDLED_EVENT_TYPES = new Set<string>([
  'subscription.setup.order.completed',
  'subscription.notification.completed',
  'subscription.redemption.order.completed',
  'subscription.paused',
  'subscription.unpaused',
  'subscription.revoked',
  'subscription.cancelled',
])

serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    const rawBody = await req.text()

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

    const eventType = String(
      event.event ??
        event.type ??
        payload.event ??
        '',
    )
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

    // Map PhonePe V2 Autopay events to our status (exact-match only).
    // PhonePe pause events map to 'revoked' (with current_cycle_end
    // preserved) so the entitlement module treats them as cancellation
    // with grace-period access until the current cycle ends.
    let status: string | null = null
    switch (eventType) {
      case 'subscription.setup.order.completed':
      case 'subscription.notification.completed':
      case 'subscription.redemption.order.completed':
        status = 'active'
        break
      case 'subscription.paused':
        status = 'revoked'
        break
      case 'subscription.unpaused':
        status = 'active'
        break
      case 'subscription.revoked':
      case 'subscription.cancelled':
        status = 'revoked'
        break
      default:
        // EXPIRED is case-insensitive: PhonePe docs use upper-case
        // but some sandbox responses have used lowercase.
        if (
          typeof payload.state === 'string' &&
          payload.state.toUpperCase() === 'EXPIRED'
        ) {
          status = 'expired'
        }
        break
    }

    // Log unhandled event types so future PhonePe schema additions are
    // visible in observability. The webhook still records the event in
    // subscription_events (via the RPC) so audit is complete.
    if (
      eventType &&
      !HANDLED_EVENT_TYPES.has(eventType) &&
      status === null
    ) {
      const rawState =
        typeof payload.state === 'string' ? payload.state : null
      logger.warn('phonepe-autopay-webhook', 'unhandled event type', {
        eventType,
        merchantSubscriptionId,
        state: rawState,
      })
    }

    // Build idempotency key from stable event identifiers. Each
    // component is truncated to avoid blowing past the B-tree index
    // limit on adversarial inputs.
    const transactionId = String(
      payload.transactionId ??
      payload.transaction_id ??
      '',
    ).trim()
    const eventTimestampIso = parsePhonePeTimestamp(
      payload.timestamp ?? payload.eventTime ?? payload.event_time,
    )
    const transactionPart = transactionId
      ? `tx:${truncateKeyPart(transactionId)}`
      : eventTimestampIso
        ? `ts:${truncateKeyPart(eventTimestampIso)}`
        : 'no-ts'
    const idempotencyKey = [
      truncateKeyPart(eventType || 'unknown'),
      truncateKeyPart(merchantSubscriptionId || 'no-sub'),
      truncateKeyPart(merchantOrderId || 'no-order'),
      transactionPart,
    ].join('|')

    // Build the subscription update object as JSONB so the RPC can
    // apply it atomically with the sentinel insert.
    const subscriptionUpdates: Record<string, unknown> = {}
    if (status) {
      subscriptionUpdates.status = status
      const startsNewCycle =
        eventType === 'subscription.setup.order.completed' ||
        eventType === 'subscription.notification.completed' ||
        eventType === 'subscription.redemption.order.completed'
      if (status === 'active' && startsNewCycle) {
        // Prefer the event-provided timestamp so delayed/retried
        // webhooks don't shift the billing window. Fall back to server
        // time.
        const start = eventTimestampIso ? new Date(eventTimestampIso) : new Date()
        if (!isNaN(start.getTime())) {
          const { data: plan } = await adminClient
            .from('plans')
            .select('frequency')
            .eq('id', subscription.plan_id)
            .maybeSingle()
          const cycleStart = start.toISOString()
          const cycleEnd = addFrequency(plan?.frequency ?? 'monthly', start).toISOString()
          subscriptionUpdates.current_cycle_start = cycleStart
          subscriptionUpdates.current_cycle_end = cycleEnd
          subscriptionUpdates.next_charge_at = cycleEnd
        }
      }
    }
    if (typeof payload.amount === 'number' && Number.isFinite(payload.amount)) {
      // Coerce to integer paise. PhonePe amounts are whole numbers;
      // if a fractional value ever appears we truncate rather than
      // fail the RPC's bigint cast (which would roll back the
      // entire transaction and loop on retry).
      subscriptionUpdates.last_charge_amount_paise = Math.trunc(payload.amount)
    }

    // Single atomic call: sentinel insert + subscription update either
    // both commit or both roll back. Returns duplicate=true when the
    // same event has already been processed.
    const rpcStart = Date.now()
    const { data: rpcResult, error: rpcError } = await adminClient.rpc(
      'process_phonepe_event',
      {
        p_idempotency_key: idempotencyKey,
        p_subscription_id: subscription.id,
        p_user_id: subscription.user_id,
        p_event_type: eventType || 'unknown',
        p_payload: payload,
        p_received_at: eventTimestampIso ?? new Date().toISOString(),
        p_subscription_updates: subscriptionUpdates,
      },
    )
    if (rpcError) throw rpcError

    const result = (rpcResult ?? {}) as { duplicate?: boolean; processed?: boolean }
    if (result.duplicate) {
      if (result.processed === false) {
        // Another transaction is in flight for the same key. Tell
        // PhonePe we haven't processed it yet so they retry shortly.
        logger.info('phonepe-autopay-webhook', 'in-flight duplicate, will retry', {
          eventType,
          subscriptionId: subscription.id,
        })
        return new Response(
          JSON.stringify({ error: 'In flight, retry shortly' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 409 },
        )
      }
      logger.info('phonepe-autopay-webhook', 'duplicate event ignored', {
        eventType,
        subscriptionId: subscription.id,
        rpcMs: Date.now() - rpcStart,
      })
      return new Response(
        JSON.stringify({ data: { received: true, duplicate: true } }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
      )
    }

    logger.info('phonepe-autopay-webhook', 'event processed', {
      eventType,
      subscriptionId: subscription.id,
      status,
      rpcMs: Date.now() - rpcStart,
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
