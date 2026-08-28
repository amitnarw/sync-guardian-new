import { getAdminClient } from './supabase-admin.ts'
import { logger } from './logger.ts'

/**
 * Single source of truth for subscription / trial entitlement.
 *
 * All edge functions and the SQL `claim_pairing_token` function must use this
 * logic (or its SQL equivalent in `20260830000000_enforce_child_device_tier_limits.sql`)
 * so access, ingestion, and pairing limits stay aligned.
 *
 * Invariant: a parent can have at most ONE subscription at any time. Plan
 * changes take effect only when the current plan's period ends (the new
 * subscription row's `current_cycle_start` is scheduled for that date, not
 * inserted immediately). If multiple entitled rows are ever detected, we
 * pick the one with the furthest `current_cycle_end` and log a warning so
 * data-integrity bugs surface in observability.
 *
 * Rules (locked product policy):
 *
 *   1. Paid subscription:
 *      status = 'active' AND current_cycle_end > now()
 *        → hasAccess: true, maxChildren: plan.tier (tier_a=1, tier_b=4)
 *      status IN ('revoked','cancelled') AND current_cycle_end > now()
 *        → still hasAccess: true, maxChildren from plan (grace period).
 *        Cancellation does NOT cut off access instantly; access persists
 *        until the current paid period ends.
 *      status = 'paused' / 'pending' / cycle ended
 *        → not entitled by the subscription path.
 *        (PhonePe pause events are mapped to 'revoked' with current_cycle_end
 *        preserved, so they fall into the grace-period rule above.)
 *
 *   2. Active trial:
 *      user_trials.status = 'active' AND ends_at > now()
 *        → hasAccess: true, maxChildren: 1
 *
 *   3. Otherwise:
 *        → hasAccess: false, maxChildren: 0
 *
 * When both subscription and trial are active, the subscription wins (it
 * grants the higher tier limit).
 */
export interface SubscriptionRow {
  id: string
  user_id: string
  plan_id: string
  status: string
  current_cycle_end: string | null
  current_cycle_start?: string | null
  source?: string | null
}

export interface TrialRow {
  id: string
  user_id: string
  status: string
  started_at: string | null
  ends_at: string | null
}

export interface Entitlement {
  hasAccess: boolean
  maxChildren: number
  reason: 'subscription' | 'trial' | 'none'
  subscription: SubscriptionRow | null
  trial: TrialRow | null
  /** When the current entitlement period ends. null when no entitlement. */
  periodEnd: string | null
}

function tierToMaxChildren(tier: unknown): number {
  if (tier === 'tier_a') return 1
  if (tier === 'tier_b') return 4
  // Conservative default: unknown plans get 0 children rather than silently
  // granting the highest tier.
  return 0
}

export async function getUserEntitlement(userId: string): Promise<Entitlement> {
  const noEntitlement: Entitlement = {
    hasAccess: false,
    maxChildren: 0,
    reason: 'none',
    subscription: null,
    trial: null,
    periodEnd: null,
  }

  if (!userId) return noEntitlement

  const adminClient = getAdminClient()

  const [{ data: subscriptionRows, error: subErr }, { data: trial }] = await Promise.all([
    adminClient
      .from('subscriptions')
      .select('id, user_id, plan_id, status, current_cycle_end, current_cycle_start, source, plans(tier)')
      .eq('user_id', userId)
      .in('status', ['active', 'revoked', 'cancelled'])
      .not('current_cycle_end', 'is', null)
      .gt('current_cycle_end', new Date().toISOString())
      .order('current_cycle_end', { ascending: false, nullsLast: true })
      .limit(10),
    adminClient
      .from('user_trials')
      .select('id, user_id, status, started_at, ends_at')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('ends_at', { ascending: false, nullsLast: true })
      .maybeSingle(),
  ])

  if (subErr) {
    // Don't silently grant access on a DB error; callers will treat the
    // resulting no-entitlement as "no access".
    return noEntitlement
  }

  const now = Date.now()
  const trialEndsAtMs = trial?.ends_at ? new Date(trial.ends_at as string).getTime() : 0
  const trialIsLive = !!trial && trialEndsAtMs > now

  // Subscription entitlement: status IN (active, revoked, cancelled) AND
  // current_cycle_end > now(). The DB filter already enforces the date,
  // so we just pick the row with the furthest end date (matches the
  // SQL `ORDER BY current_cycle_end DESC NULLS LAST` logic).
  const entitledSubRows = subscriptionRows ?? []

  if (entitledSubRows.length > 1) {
    // Surface the invariant violation so it can be detected in logs.
    // The shared `logger` sanitizes any UUID-shaped values per AGENTS.md.
    logger.warn('subscription-entitlement', 'multiple entitled subscriptions detected', {
      count: entitledSubRows.length,
      userId,
    })
  }

  const subRow = entitledSubRows[0] ?? null
  if (subRow) {
    const plans = (subRow as any)?.plans
    const tier = Array.isArray(plans) ? plans[0]?.tier : plans?.tier
    return {
      hasAccess: true,
      maxChildren: tierToMaxChildren(tier),
      reason: 'subscription',
      subscription: subRow as SubscriptionRow,
      trial: trial ?? null,
      periodEnd: subRow.current_cycle_end ?? null,
    }
  }

  if (trialIsLive) {
    return {
      hasAccess: true,
      maxChildren: 1,
      reason: 'trial',
      subscription: null,
      trial,
      periodEnd: trial.ends_at ?? null,
    }
  }

  return noEntitlement
}

/**
 * Convenience wrapper preserved for existing callers that only care about
 * the boolean access flag.
 */
export async function userHasAccess(userId: string): Promise<boolean> {
  const ent = await getUserEntitlement(userId)
  return ent.hasAccess
}
