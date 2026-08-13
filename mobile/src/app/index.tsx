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

    (async () => {
      const state = await getOnboardingState();
      if (cancelled) return;

      // Keep local role cache in sync with the DB source of truth.
      if (state.selected_role) {
        useAuthStore.getState().setUserRole(state.selected_role);
      }

      if (state.onboarding_completed) {
        // Validate subscription/trial access before entering the app.
        // The server is the only source of truth — we never trust a cached
        // `hasAccess` value. While this is in flight, the splash below is
        // shown so the user is never given implicit access.
        await useSubscriptionStore.getState().refresh();
        if (cancelled) return;

        if (!useSubscriptionStore.getState().hasAccess) {
          router.replace('/(paywall)/plans');
          return;
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
        if (!cancelled) router.replace('/(paywall)/plans');
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
