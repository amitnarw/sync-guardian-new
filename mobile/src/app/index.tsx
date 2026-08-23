import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
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

  useEffect(() => {
    if (!_hasHydrated || !sessionChecked) return;

    if (!isAuthenticated) {
      router.replace('/splash');
      return;
    }

    let cancelled = false;
    let resolvedRole: string | null = null;

    (async () => {
      const state = await getOnboardingState();
      if (cancelled) return;

      // Keep local role cache in sync with the DB source of truth.
      if (state.selected_role) {
        useAuthStore.getState().setUserRole(state.selected_role);
      }
      resolvedRole = state.selected_role;

      // A stale onboarding row must never funnel an already-paired user back
      // into the pairing funnel. A pairs row only exists after a token claim,
      // so its presence at a pre-pairing step proves the row went stale
      // (e.g. the claim-time onboarding upsert failed) and onboarding is
      // effectively done for this user.
      const stalePrePairingStep =
        !!state.has_active_pair &&
        ['role_selection', 'permissions', 'pairing'].includes(state.onboarding_step);

      if (state.onboarding_completed || stalePrePairingStep) {
        // Children never see subscription/money UI — their access mirrors
        // the paired parent's state server-side, and the child home screen
        // handles waiting/paused states on its own. Only parents/admins are
        // gated through the subscription check.
        if (state.selected_role !== 'child') {
          // Validate subscription/trial access before entering the app.
          // The server is the only source of truth — we never trust a cached
          // `hasAccess` value. While this is in flight, the splash below is
          // shown so the user is never given implicit access.
          await useSubscriptionStore.getState().refresh();
          if (cancelled) return;

          const sub = useSubscriptionStore.getState();
          if (!sub.hasAccess) {
            const lapsedSub =
              sub.subscriptionStatus != null &&
              ['cancelled', 'revoked', 'expired'].includes(sub.subscriptionStatus);
            router.replace({
              pathname: '/(paywall)/plans',
              params: { reason: lapsedSub ? 'subscription_ended' : 'trial_ended' },
            });
            return;
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
    })()
      .catch(() => {
        // Even on error, do NOT route past the paywall — let the user retry
        // by re-opening the app or pulling to refresh on the next screen.
        if (cancelled) return;
        const role = resolvedRole ?? useAuthStore.getState().userRole;
        // A child device must never land on the paywall, even on transient
        // errors — send it to its own home which shows waiting states.
        if (role === 'child') {
          router.replace('/(child)/home');
          return;
        }
        router.replace('/(paywall)/plans');
      });

    return () => {
      cancelled = true;
    };
  }, [_hasHydrated, sessionChecked, isAuthenticated]);

  return (
    <View style={s.splash}>
      <ActivityIndicator color={AuthColors.primary} size="large" />
    </View>
  );
}

const s = StyleSheet.create({
  splash: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: AuthColors.surface,
  },
});
