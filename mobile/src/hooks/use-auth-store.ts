import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { clearAppMetadataCache } from './use-app-metadata';

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

  profileImage: string | null;
  setProfileImage: (image: string | null) => void;
  displayName: string | null;
  setDisplayName: (name: string | null) => void;

  _hasHydrated: boolean;
  setHasHydrated: (state: boolean) => void;

  sessionChecked: boolean;
  setSessionChecked: (checked: boolean) => void;

  resetAuth: () => void;
  clearPair: () => void;
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

      profileImage: null,
      setProfileImage: (image) => set({ profileImage: image }),
      displayName: null,
      setDisplayName: (name) => set({ displayName: name }),

      _hasHydrated: false,
      setHasHydrated: (state) => set({ _hasHydrated: state }),

      sessionChecked: false,
      setSessionChecked: (checked) => set({ sessionChecked: checked }),

      clearPair: () => set({ pairId: null, deviceId: null }),

      resetAuth: () => {
        clearAppMetadataCache();
        set({
          userRole: null,
          hasCompletedOnboarding: false,
          isAuthenticated: false,
          email: null,
          pairId: null,
          deviceId: null,
          fcmToken: null,
          userId: null,
          profileImage: null,
          displayName: null,
        });
      },
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
        email: state.email,
        pairId: state.pairId,
        deviceId: state.deviceId,
        fcmToken: state.fcmToken,
        profileImage: state.profileImage,
        displayName: state.displayName,
      }),
    },
  )
);
