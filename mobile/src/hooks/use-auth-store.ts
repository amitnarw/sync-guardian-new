import { create } from 'zustand';

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

  // Reset auth state
  resetAuth: () => void;
}

export const useAuthStore = create<AuthState>()((set) => ({
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

  resetAuth: () =>
    set({
      userRole: null,
      hasCompletedOnboarding: false,
      isAuthenticated: false,
      email: null,
      pairId: null,
      deviceId: null,
    }),
}))