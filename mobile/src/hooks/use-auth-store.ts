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

  resetAuth: () =>
    set({
      userRole: null,
      hasCompletedOnboarding: false,
      isAuthenticated: false,
      email: null,
    }),
}))