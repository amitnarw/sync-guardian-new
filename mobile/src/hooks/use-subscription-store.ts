import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, AppStateStatus } from 'react-native';
import { getMySubscription } from '@/services/subscription-api';
import type { SubscriptionRow } from '@/services/subscription-api';

export type SubscriptionReason = 'trial' | 'subscription' | 'none' | null;

interface SubscriptionState {
  // Derived access snapshot. Always re-derived from the server via refresh().
  // NEVER trusted from disk: a persisted `hasAccess: true` would let a user
  // bypass the trial by simply not opening the app (or by toggling airplane
  // mode after their trial expired). The server is the only authority.
  hasAccess: boolean;
  reason: SubscriptionReason;
  trialDaysRemaining: number | null;
  activePlanId: string | null;
  subscriptionStatus: string | null;
  subscription: SubscriptionRow | null;

  // Loading / error transient state (not persisted).
  loading: boolean;
  error: string | null;

  refresh: () => Promise<void>;
  clear: () => void;
}

export const useSubscriptionStore = create<SubscriptionState>()(
  persist(
    (set) => ({
      // Default to NO access. Until the server confirms access via refresh(),
      // we must not assume the user is entitled to anything — otherwise a
      // stale persisted state (or a device-clock manipulation) would let the
      // user bypass the paywall.
      hasAccess: false,
      reason: null,
      trialDaysRemaining: null,
      activePlanId: null,
      subscriptionStatus: null,
      subscription: null,

      loading: false,
      error: null,

      refresh: async () => {
        set({ loading: true, error: null });
        try {
          const state = await getMySubscription();
          set({
            hasAccess: state.hasAccess,
            reason: state.reason,
            trialDaysRemaining: state.trial?.days_remaining ?? null,
            activePlanId: state.subscription?.plan_id ?? null,
            subscriptionStatus: state.subscription?.status ?? null,
            subscription: state.subscription ?? null,
            loading: false,
          });
        } catch (e) {
          set({
            error: e instanceof Error ? e.message : 'Failed to load subscription',
            loading: false,
          });
        }
      },

      clear: () =>
        set({
          hasAccess: false,
          reason: null,
          trialDaysRemaining: null,
          activePlanId: null,
          subscriptionStatus: null,
          subscription: null,
          loading: false,
          error: null,
        }),
    }),
    {
      name: 'subscription-storage',
      storage: createJSONStorage(() => AsyncStorage),
      // Only persist display hints — never the access decision itself.
      // hasAccess MUST be re-derived from the server on every cold start.
      partialize: (state) => ({
        reason: state.reason,
        trialDaysRemaining: state.trialDaysRemaining,
        activePlanId: state.activePlanId,
        subscriptionStatus: state.subscriptionStatus,
      }),
    },
  ),
);

// Refresh subscription state whenever the app comes to the foreground so the
// notification listener's hard gate stays current without per-notification
// network calls. Without this the gate could stay stale for hours after the
// parent's trial/subscription expires.
let foregroundRefreshRegistered = false;
function registerForegroundRefresh(): void {
  if (foregroundRefreshRegistered) return;
  foregroundRefreshRegistered = true;
  AppState.addEventListener('change', (state: AppStateStatus) => {
    if (state === 'active') {
      useSubscriptionStore.getState().refresh().catch(() => {});
    }
  });
}
registerForegroundRefresh();
