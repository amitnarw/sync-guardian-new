import { serve } from "https://deno.land/std@0.192.0/http/server.ts"
import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { verifyAuth } from '../_shared/auth-verifier.ts'
import { getAdminClient } from '../_shared/supabase-admin.ts'
import { getUserEntitlement } from '../_shared/subscription-entitlement.ts'
import { logger, mapError } from '../_shared/logger.ts'

// ============================================================
// Access snapshot for the caller.
//
// - Parents/admins: access derives from their own trial + subscription.
// - Children: trials and billing never belong to them. Their access
//   derives from the PAIRED PARENT's trial/subscription. The response
//   for a child carries no subscription row or merchant data at all , 
//   only hasAccess/reason plus who manages their access.
//
// Access / max-child limits use the single shared entitlement module
// (`_shared/subscription-entitlement.ts`) so this view, ingestion
// gating, and pairing limits all stay aligned.
//
// Child detection: onboarding selected_role = 'child' OR an existing
// non-revoked pair where the caller is the child_user_id.
// ============================================================

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
      getUserEntitlement(user.id),
    ])

    const isChild = obState?.selected_role === 'child' || pairAsChild !== null

    if (!isChild) {
      const now = Date.now()
      return new Response(
        JSON.stringify({
          data: {
            hasAccess: own.hasAccess,
            reason: own.reason,
            is_child: false,
            managed_by_parent_user_id: null,
            trial: own.trial
              ? {
                  status: own.trial.status,
                  started_at: own.trial.started_at ?? null,
                  ends_at: own.trial.ends_at,
                  days_remaining: own.trial.ends_at
                    ? Math.max(
                        0,
                        Math.ceil(
                          (new Date(own.trial.ends_at).getTime() - now) / 86_400_000,
                        ),
                      )
                    : 0,
                }
              : null,
            subscription: own.subscription ?? null,
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
      const parentEnt = await getUserEntitlement(pairAsChild.parent_user_id)
      hasAccess = parentEnt.hasAccess
      reason = parentEnt.reason
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
