import React, { useEffect, useState } from 'react';
import { StyleSheet, View, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { getOnboardingState, type OnboardingStep } from '@/services/onboarding-api';
import { AuthColors as C } from '@/constants/auth-theme';

const STEP_ROUTE: Record<OnboardingStep, string> = {
  role_selection: '/role-selection',
  pairing: '/pairing',
  permissions: '/permissions',
  app_selection: '/app-filters',
  completed: '/(tabs)/home',
};

export default function OnboardingHub() {
  const [, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const state = await getOnboardingState();

      if (cancelled) return;

      if (state.selected_role === 'admin') {
        router.replace('/(admin)/dashboard');
        return;
      }

      // Stale-row immunity: a pairs row only exists after a token claim, so
      // its presence at a pre-pairing step means the onboarding_state row
      // went stale (e.g. the claim-time upsert failed). Never funnel an
      // already-paired user back into /pairing.
      const stalePrePairingStep =
        !!state.has_active_pair &&
        ['role_selection', 'permissions', 'pairing'].includes(state.onboarding_step);

      if (state.onboarding_completed || stalePrePairingStep) {
        if (state.selected_role === 'child') {
          router.replace('/(child)/home');
        } else {
          router.replace('/(tabs)/home');
        }
        return;
      }

      // app_selection is role-specific: the parent chooses apps while the
      // child waits for the parent to finish.
      if (state.onboarding_step === 'app_selection') {
        if (state.selected_role === 'child') {
          router.replace('/onboarding-app-selection');
        } else {
          router.replace('/onboarding-parent-wait');
        }
        return;
      }

      const route = STEP_ROUTE[state.onboarding_step];
      router.replace(route as never);
    })()
      .catch(() => {
        if (!cancelled) router.replace('/role-selection');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <View style={s.container}>
      <ActivityIndicator color={C.primary} size="large" />
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
