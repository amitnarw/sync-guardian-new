import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type UserRole = 'parent' | 'child' | null;

interface AuthState {
  userRole: UserRole;
  setUserRole: (role: UserRole) => void;

  hasCompletedOnboarding: boolean;
  setHasCompletedOnboarding: (completed: boolean) => void;

  isAuthenticated: boolean;
  setIsAuthenticated: (authenticated: boolean) => void;

  email: string | null;
  setEmail: (email: string | null) => void;

  pairId: string | null;
  setPairId: (pairId: string | null) => void;
  deviceId: string | null;
  setDeviceId: (deviceId: string | null) => void;

  fcmToken: string | null;
  setFcmToken: (fcmToken: string | null) => void;

  userId: string | null;
  setUserId: (id: string | null) => void;

  _hasHydrated: boolean;
  setHasHydrated: (state: boolean) => void;

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

      userId: null,
      setUserId: (id) => set({ userId: id }),

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
          userId: null,
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
      partialize: (state) => ({
        userRole: state.userRole,
        hasCompletedOnboarding: state.hasCompletedOnboarding,
        isAuthenticated: state.isAuthenticated,
        email: state.email,
        pairId: state.pairId,
        deviceId: state.deviceId,
        fcmToken: state.fcmToken,
        userId: state.userId,
      }),
    },
  )
);
