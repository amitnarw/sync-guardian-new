import { useEffect } from 'react';
import { router } from 'expo-router';
import { useAuthStore } from '@/hooks/use-auth-store';
import { getOnboardingState } from '@/services/onboarding-api';

export default function Index() {
  const _hasHydrated = useAuthStore((state) => state._hasHydrated);
  const sessionChecked = useAuthStore((state) => state.sessionChecked);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  useEffect(() => {
    if (!_hasHydrated || !sessionChecked) return;

    if (!isAuthenticated) {
      router.replace('/splash');
      return;
    }

    let cancelled = false;

    (async () => {
      const state = await getOnboardingState();
      if (cancelled) return;

      // Keep local role cache in sync with the DB source of truth.
      if (state.selected_role) {
        useAuthStore.getState().setUserRole(state.selected_role);
      }

      if (state.onboarding_completed) {
        if (state.selected_role === 'child') {
          router.replace('/(child)/home');
        } else {
          router.replace('/(tabs)/home');
        }
        return;
      }

      if (state.selected_role === 'admin') {
        router.replace('/(admin)/dashboard');
        return;
      }

      router.replace('/onboarding');
    })()
      .catch(() => {
        if (!cancelled) router.replace('/onboarding');
      });

    return () => {
      cancelled = true;
    };
  }, [_hasHydrated, sessionChecked, isAuthenticated]);

  return null;
}

