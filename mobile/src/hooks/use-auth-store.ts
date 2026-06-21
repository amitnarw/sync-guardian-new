import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type UserRole = 'parent' | 'child' | null;

interface AuthState {
  // User role selection
  userRole: UserRole;
  setUserRole: (role: UserRole) => void;

  // Onboarding state
  hasCompletedOnboarding: boolean;
  setHasCompletedOnboarding: (completed: boolean) => void;

  // Authentication state
  isAuthenticated: boolean;
  setIsAuthenticated: (authenticated: boolean) => void;

  // Email for login
  email: string | null;
  setEmail: (email: string | null) => void;

  // Pairing state
  pairId: string | null;
  setPairId: (pairId: string | null) => void;
  deviceId: string | null;
  setDeviceId: (deviceId: string | null) => void;

  fcmToken: string | null;
  setFcmToken: (fcmToken: string | null) => void;

  // Hydration state
  _hasHydrated: boolean;
  setHasHydrated: (state: boolean) => void;

  // Reset auth state
  resetAuth: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      userRole: null,
      setUserRole: (role) => set({ userRole: role }),

      hasCompletedOnboarding: false,
      setHasCompletedOnboarding: (completed) => set({ hasCompletedOnboarding: completed }),

      isAuthenticated: false,
      setIsAuthenticated: (authenticated) => set({ isAuthenticated: authenticated }),

      email: null,
      setEmail: (email) => set({ email }),

      pairId: null,
      setPairId: (pairId) => set({ pairId }),

      deviceId: null,
      setDeviceId: (deviceId) => set({ deviceId }),

      fcmToken: null,
      setFcmToken: (fcmToken) => set({ fcmToken }),

      _hasHydrated: false,
      setHasHydrated: (state) => set({ _hasHydrated: state }),

      resetAuth: () =>
        set({
          userRole: null,
          hasCompletedOnboarding: false,
          isAuthenticated: false,
          email: null,
          pairId: null,
          deviceId: null,
        }),
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => AsyncStorage),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.setHasHydrated(true);
        }
      },
    }
  )
);