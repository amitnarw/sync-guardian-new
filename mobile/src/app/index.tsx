import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '@/hooks/use-auth-store';
import { useSubscriptionStore } from '@/hooks/use-subscription-store';
import { getOnboardingState } from '@/services/onboarding-api';
import { AuthColors } from '@/constants/auth-theme';

function routeToRoleHome(selectedRole: string | null) {
  if (selectedRole === 'child') {
    router.replace('/(child)/home');
  } else {
    router.replace('/(tabs)/home');
  }
}

export default function Index() {
  const _hasHydrated = useAuthStore((state) => state._hasHydrated);
  const sessionChecked = useAuthStore((state) => state.sessionChecked);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const userRole = useAuthStore((state) => state.userRole);

  useEffect(() => {
    if (!_hasHydrated || !sessionChecked) return;

    if (!isAuthenticated) {
      router.replace('/splash');
      return;
    }

    let cancelled = false;
    let resolvedRole: string | null = userRole;

    (async () => {
      try {
        const state = await getOnboardingState();
        if (cancelled) return;

        if (state.selected_role) {
          useAuthStore.getState().setUserRole(state.selected_role);
          resolvedRole = state.selected_role;
        }

        const stalePrePairingStep =
          !!state.has_active_pair &&
          ['role_selection', 'permissions', 'pairing'].includes(state.onboarding_step);

        if (state.onboarding_completed || stalePrePairingStep) {
          if (state.selected_role !== 'child') {
            try {
              await useSubscriptionStore.getState().refresh();
              if (cancelled) return;

              const sub = useSubscriptionStore.getState();
              // Only redirect to paywall when the server has CONFIRMED
              // no access. `undefined` means the refresh was inconclusive
              // (e.g., transient network error left hasAccess untouched);
              // in that case fall through to the cached home and let the
              // foreground-refresh listener catch up.
              if (sub.hasAccess === false) {
                const lapsedSub =
                  sub.subscriptionStatus != null &&
                  ['cancelled', 'revoked', 'expired'].includes(sub.subscriptionStatus);
                router.replace({
                  pathname: '/(paywall)/plans',
                  params: { reason: lapsedSub ? 'subscription_ended' : 'trial_ended' },
                });
                return;
              }
            } catch {
              // On network failure during subscription check, allow offline access to cached home
            }
          }

          routeToRoleHome(state.selected_role);
          return;
        }

        if (state.selected_role === 'admin') {
          router.replace('/(admin)/dashboard');
          return;
        }

        router.replace('/onboarding');
      } catch {
        // Offline / Network error handler: fallback gracefully to cached home screen
        if (cancelled) return;
        const fallbackRole = resolvedRole ?? useAuthStore.getState().userRole;
        if (fallbackRole === 'child') {
          router.replace('/(child)/home');
        } else {
          router.replace('/(tabs)/home');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [_hasHydrated, sessionChecked, isAuthenticated, userRole]);

  return <View style={s.splash} />;
}

const s = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: AuthColors.surface,
  },
});
