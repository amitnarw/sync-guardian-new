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
  //
  // `hasAccess === undefined` means "not yet verified by the server on this
  // launch". The notification listener treats that as "buffer but do not
  // send" so notifications captured during the cold-start hydration window
  // are not silently dropped. `false` means "server confirmed no access" and
  // is terminal. `true` means "active".
  hasAccess: boolean | undefined;
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
      // Default to UNKNOWN (`undefined`) so the notification listener
      // buffers during the cold-start hydration window instead of dropping.
      // A previous `false` default caused any notification captured before
      // the first foreground refresh to be silently lost. The server is the
      // only authority on access ,  leaving this undefined until refresh()
      // resolves is strictly safer than assuming denial.
      hasAccess: undefined,
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
            // On failure, leave `hasAccess` as it was. If the listener was
            // already buffered while hydrating, it will retry on the next
            // foreground refresh. If we force `false` here, a transient
            // network blip on launch would silently lock the user out for
            // the rest of the session.
            error: e instanceof Error ? e.message : 'Failed to load subscription',
            loading: false,
          });
        }
      },

      clear: () =>
        set({
          // After sign-out, reset to `undefined` so the next signed-in user
          // hydrates from scratch. Forcing `false` here would cause the
          // listener to drop the very first notifications of the new user
          // before their first refresh completes.
          hasAccess: undefined,
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
      // Only persist display hints ,  never the access decision itself.
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
