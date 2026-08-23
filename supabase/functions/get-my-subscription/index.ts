import { serve } from "https://deno.land/std@0.192.0/http/server.ts"
import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { verifyAuth } from '../_shared/auth-verifier.ts'
import { getAdminClient } from '../_shared/supabase-admin.ts'
import { logger, mapError } from '../_shared/logger.ts'

// ============================================================
// Access snapshot for the caller.
//
// - Parents/admins: access derives from their own trial + subscription.
// - Children: trials and billing never belong to them. Their access
//   derives from the PAIRED PARENT's trial/subscription. The response
//   for a child carries no subscription row or merchant data at all —
//   only hasAccess/reason plus who manages their access.
//
// Child detection: onboarding selected_role = 'child' OR an existing
// non-revoked pair where the caller is the child_user_id.
// ============================================================

interface AccessSnapshot {
  hasAccess: boolean
  reason: 'trial' | 'subscription' | 'none'
}

async function loadOwnSnapshot(
  adminClient: ReturnType<typeof getAdminClient>,
  userId: string,
): Promise<{ snapshot: AccessSnapshot; trial: Record<string, unknown> | null; subscription: Record<string, unknown> | null }> {
  const [{ data: trial }, { data: subscription }] = await Promise.all([
    adminClient
      .from('user_trials')
      .select('status, started_at, ends_at')
      .eq('user_id', userId)
      .maybeSingle(),
    adminClient
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .in('status', ['pending', 'active', 'paused'])
      .maybeSingle(),
  ])

  const now = Date.now()
  let hasAccess = false
  let reason: 'trial' | 'subscription' | 'none' = 'none'

  if (subscription && (subscription.status === 'active' || subscription.status === 'paused')) {
    hasAccess = true
    reason = 'subscription'
  } else if (trial && trial.status === 'active' && trial.ends_at && new Date(trial.ends_at as string).getTime() > now) {
    hasAccess = true
    reason = 'trial'
  }

  return {
    snapshot: { hasAccess, reason },
    trial: (trial as Record<string, unknown>) ?? null,
    subscription: (subscription as Record<string, unknown>) ?? null,
  }
}

serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    const user = await verifyAuth(req.headers.get('Authorization'))
    const adminClient = getAdminClient()

    // Detect child role + live pairing in parallel with the own snapshot.
    const [{ data: obState }, { data: pairAsChild }, own] = await Promise.all([
      adminClient
        .from('user_onboarding_state')
        .select('selected_role')
        .eq('user_id', user.id)
        .maybeSingle(),
      adminClient
        .from('pairs')
        .select('parent_user_id, status')
        .eq('child_user_id', user.id)
        .in('status', ['pending', 'active'])
        .limit(1)
        .maybeSingle(),
      loadOwnSnapshot(adminClient, user.id),
    ])

    const isChild = obState?.selected_role === 'child' || pairAsChild !== null

    if (!isChild) {
      const { snapshot, trial, subscription } = own
      const now = Date.now()
      return new Response(
        JSON.stringify({
          data: {
            hasAccess: snapshot.hasAccess,
            reason: snapshot.reason,
            is_child: false,
            managed_by_parent_user_id: null,
            trial: trial
              ? {
                  status: trial.status,
                  started_at: trial.started_at,
                  ends_at: trial.ends_at,
                  days_remaining: trial.ends_at
                    ? Math.max(0, Math.ceil((new Date(trial.ends_at as string).getTime() - now) / 86_400_000))
                    : 0,
                }
              : null,
            subscription: subscription ?? null,
          },
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
      )
    }

    // ---- Child device path -------------------------------------------
    // No subscription object, no merchant fields, no own-trial leak.
    // Access mirrors the paired parent's live state; unpaired children
    // simply have none (the app keeps them on its pairing/waiting UI).
    let hasAccess = false
    let reason: 'trial' | 'subscription' | 'none' = 'none'
    let managedBy: string | null = null

    if (pairAsChild?.parent_user_id) {
      managedBy = pairAsChild.parent_user_id
      const parentSnap = await loadOwnSnapshot(adminClient, pairAsChild.parent_user_id)
      hasAccess = parentSnap.snapshot.hasAccess
      reason = parentSnap.snapshot.reason
    }

    return new Response(
      JSON.stringify({
        data: {
          hasAccess,
          reason,
          is_child: true,
          managed_by_parent_user_id: managedBy,
          trial: null,
          subscription: null,
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
