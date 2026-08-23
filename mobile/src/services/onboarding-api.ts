import { supabase } from '@/lib/supabase';
import { logger } from '@/services/logger';

export type OnboardingStep =
  | 'role_selection'
  | 'pairing'
  | 'permissions'
  | 'app_selection'
  | 'completed';

export type OnboardingRole = 'parent' | 'child' | 'admin';

export interface OnboardingState {
  selected_role: OnboardingRole | null;
  onboarding_step: OnboardingStep;
  onboarding_completed: boolean;
  /** Server-side reality check: a pairs row exists for this user (pending|active). */
  has_active_pair?: boolean;
}

export async function getOnboardingState(): Promise<OnboardingState> {
  const { data, error } = await supabase.functions.invoke('get-onboarding-state');
  if (error) {
    logger.warn('getOnboardingState', 'invoke failed', { message: error.message });
    // Default to starting onboarding from the beginning.
    return {
      selected_role: null,
      onboarding_step: 'role_selection',
      onboarding_completed: false,
      has_active_pair: false,
    };
  }
  return (data as { data: OnboardingState }).data;
}

export async function setOnboardingRole(
  selectedRole: OnboardingRole,
  onboardingStep?: OnboardingStep,
): Promise<void> {
  const { error } = await supabase.functions.invoke('set-onboarding-role', {
    body: {
      selected_role: selectedRole,
      ...(onboardingStep ? { onboarding_step: onboardingStep } : {}),
    },
  });
  if (error) {
    logger.warn('setOnboardingRole', 'invoke failed', { message: error.message });
    throw error;
  }
}
