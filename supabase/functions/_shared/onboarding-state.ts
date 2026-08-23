import { getAdminClient } from './supabase-admin.ts'

export type OnboardingStep =
  | 'role_selection'
  | 'pairing'
  | 'permissions'
  | 'app_selection'
  | 'completed'

export type OnboardingRole = 'parent' | 'child' | 'admin'

/**
 * Advance (or initialize) a user's onboarding state.
 * Always sets updated_at via the DB trigger.
 */
export async function upsertOnboardingState(
  userId: string,
  updates: {
    selected_role?: OnboardingRole
    onboarding_step?: OnboardingStep
    onboarding_completed?: boolean
  },
): Promise<void> {
  const adminClient = getAdminClient()

  const { error } = await adminClient
    .from('user_onboarding_state')
    .upsert(
      {
        user_id: userId,
        ...updates,
      },
      { onConflict: 'user_id' },
    )

  if (error) throw error
}

/**
 * Fetch a user's onboarding state. Returns a sensible default when no row
 * exists yet (brand-new user who hasn't started onboarding).
 *
 * `has_active_pair` is a reality check: a pairs row is only created when a
 * pairing token is claimed, so its presence proves the user progressed past
 * the pairing step even if their onboarding_state row went stale (e.g. the
 * claim-time upsert failed). Clients use this to avoid funneling an
 * already-paired user back into /pairing.
 */
export async function getOnboardingState(userId: string): Promise<{
  selected_role: OnboardingRole | null
  onboarding_step: OnboardingStep
  onboarding_completed: boolean
  has_active_pair: boolean
}> {
  const adminClient = getAdminClient()

  const [{ data, error }, { data: pairRow, error: pairErr }] = await Promise.all([
    adminClient
      .from('user_onboarding_state')
      .select('selected_role, onboarding_step, onboarding_completed')
      .eq('user_id', userId)
      .maybeSingle(),
    adminClient
      .from('pairs')
      .select('id')
      .or(`parent_user_id.eq.${userId},child_user_id.eq.${userId}`)
      .in('status', ['pending', 'active'])
      .limit(1)
      .maybeSingle(),
  ])

  if (error) throw error
  if (pairErr) throw pairErr

  const has_active_pair = !!pairRow

  if (!data) {
    return {
      selected_role: null,
      onboarding_step: 'role_selection',
      onboarding_completed: false,
      has_active_pair,
    }
  }

  return {
    selected_role: (data.selected_role as OnboardingRole) ?? null,
    onboarding_step: (data.onboarding_step as OnboardingStep) ?? 'role_selection',
    onboarding_completed: !!data.onboarding_completed,
    has_active_pair,
  }
}
