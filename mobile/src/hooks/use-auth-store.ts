import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { clearAppMetadataCache } from './use-app-metadata';
import { isValidUUID } from '@/lib/uuid';

export type UserRole = 'parent' | 'child' | 'admin' | null;

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

  pairRevokedAt: number | null;
  markPairRevoked: () => void;

  syncDeviceErrorCount: number;
  syncDeviceError: string | null;
  incrementSyncDeviceError: (msg: string) => void;
  clearSyncDeviceError: () => void;

  // Notification capture observability
  lastCaptureAt: number | null;
  lastCapturePackage: string | null;
  setCapture: (pkg: string) => void;
  lastIngestAt: number | null;
  lastIngestError: string | null;
  lastIngestDropped: string | null;
  setIngestSuccess: () => void;
  setIngestError: (error: string) => void;
  setIngestDropped: (reason: string) => void;

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
      setPairId: (pairId) => set({ pairId: isValidUUID(pairId) ? pairId : null }),
      deviceId: null,
      setDeviceId: (deviceId) => set({ deviceId: isValidUUID(deviceId) ? deviceId : null }),

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

      pairRevokedAt: null,
      markPairRevoked: () => set({ pairRevokedAt: Date.now() }),

      syncDeviceErrorCount: 0,
      syncDeviceError: null,
      incrementSyncDeviceError: (msg) => set((s) => ({
        syncDeviceErrorCount: s.syncDeviceErrorCount + 1,
        syncDeviceError: msg,
      })),
      clearSyncDeviceError: () => set({ syncDeviceErrorCount: 0, syncDeviceError: null }),

      clearPair: () => set({ pairId: null, deviceId: null }),

      lastCaptureAt: null,
      lastCapturePackage: null,
      setCapture: (pkg) => set({ lastCaptureAt: Date.now(), lastCapturePackage: pkg }),
      lastIngestAt: null,
      lastIngestError: null,
      lastIngestDropped: null,
      setIngestSuccess: () => set({ lastIngestAt: Date.now(), lastIngestError: null, lastIngestDropped: null }),
      setIngestError: (error) => set({ lastIngestError: error }),
      setIngestDropped: (reason) => set({ lastIngestDropped: reason }),

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
          pairRevokedAt: null,
          syncDeviceErrorCount: 0,
          syncDeviceError: null,
          lastCaptureAt: null,
          lastCapturePackage: null,
          lastIngestAt: null,
          lastIngestError: null,
          lastIngestDropped: null,
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
        lastCaptureAt: state.lastCaptureAt,
        lastCapturePackage: state.lastCapturePackage,
        lastIngestAt: state.lastIngestAt,
        lastIngestError: state.lastIngestError,
        lastIngestDropped: state.lastIngestDropped,
      }),
    },
  )
);
