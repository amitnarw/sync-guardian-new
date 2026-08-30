import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import React, { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AppState } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ErrorBoundary } from '@/components/error-boundary';
import { useAuthTheme } from '@/hooks/use-auth-theme';
import { useAuthStore } from '@/hooks/use-auth-store';
import { ModalProvider } from '@/hooks/use-app-modal';
import { supabase } from '@/lib/supabase';
import { requestFcmPermission } from '@/services/fcm-handler';
import '@/services/notification-listener';
import { flushBuffer } from '@/services/mmkv-buffer';
import { primeAppCategoriesCache } from '@/services/app-categories';
import { resolveParentDeviceId, resolveChildDeviceId } from '@/lib/device-recovery';
import { logger } from '@/services/logger';
import * as SplashScreen from 'expo-splash-screen';
import {
  useFonts,
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
  PlusJakartaSans_400Regular_Italic,
  PlusJakartaSans_700Bold_Italic,
  PlusJakartaSans_800ExtraBold_Italic,
} from '@expo-google-fonts/plus-jakarta-sans';

SplashScreen.preventAutoHideAsync();

const LightTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: '#ffffff',
    card: '#ffffff',
  },
};

export default function RootLayout() {
  const authTheme = useAuthTheme();
  const {
    userRole,
    isAuthenticated,
    deviceId,
    userId,
    _hasHydrated,
    setUserId,
    setIsAuthenticated,
    setEmail,
    setProfileImage,
    setDisplayName,
    setPairId,
    setDeviceId,
    setSessionChecked,
  } = useAuthStore();

  const [loaded, error] = useFonts({
    'PlusJakartaSans-Regular': PlusJakartaSans_400Regular,
    'PlusJakartaSans-Medium': PlusJakartaSans_500Medium,
    'PlusJakartaSans-SemiBold': PlusJakartaSans_600SemiBold,
    'PlusJakartaSans-Bold': PlusJakartaSans_700Bold,
    'PlusJakartaSans-ExtraBold': PlusJakartaSans_800ExtraBold,
    'PlusJakartaSans-RegularItalic': PlusJakartaSans_400Regular_Italic,
    'PlusJakartaSans-BoldItalic': PlusJakartaSans_700Bold_Italic,
    'PlusJakartaSans-ExtraBoldItalic': PlusJakartaSans_800ExtraBold_Italic,
  });

  useEffect(() => {
    if (loaded || error) {
      SplashScreen.hideAsync();
    }
  }, [loaded, error]);

  // Warm the social-media / messaging / dating whitelist cache so the parent
  // app can open the app-selection screen instantly.
  useEffect(() => {
    primeAppCategoriesCache();
  }, []);

  // Restore Supabase Auth session on app launch and validate user exists.
  // Resilient to offline state: never wipes session on network/offline errors.
  useEffect(() => {
    async function restoreSession() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          let resolvedUser = session.user;
          try {
            const { data: { user }, error: userErr } = await supabase.auth.getUser();
            if (userErr) {
              const status = (userErr as any)?.status;
              if (status === 401 || status === 403) {
                logger.warn('Session explicitly rejected by server, signing out');
                await supabase.auth.signOut();
                setIsAuthenticated(false);
                setUserId(null);
                setEmail(null);
                setProfileImage(null);
                setDisplayName(null);
                setPairId(null);
                setDeviceId(null);
                setSessionChecked(true);
                return;
              }
              logger.info('Using cached session user (network offline or unavailable)');
            } else if (user) {
              resolvedUser = user;
            }
          } catch (netErr) {
            logger.info('Network call failed on restoreSession, using cached session user', netErr);
          }

          if (resolvedUser) {
            setIsAuthenticated(true);
            setUserId(resolvedUser.id);
            setEmail(resolvedUser.email ?? null);
            const meta = resolvedUser.user_metadata || {};
            setProfileImage(meta.avatar_url || meta.picture || null);
            setDisplayName(meta.full_name || meta.name || null);
          }
        }
      } catch (err) {
        logger.warn('Error checking session on restore:', err);
      } finally {
        setSessionChecked(true);
      }
    }
    restoreSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          const user = session?.user;
          if (user) {
            setIsAuthenticated(true);
            setUserId(user.id);
            setEmail(user.email ?? null);
            const meta = user.user_metadata || {};
            setProfileImage(meta.avatar_url || meta.picture || null);
            setDisplayName(meta.full_name || meta.name || null);
          }
        } else if (event === 'SIGNED_OUT') {
          setIsAuthenticated(false);
          setUserId(null);
          setEmail(null);
          setProfileImage(null);
          setDisplayName(null);
          setPairId(null);
          setDeviceId(null);
        }
      },
    );

    return () => subscription.unsubscribe();
  }, [setUserId, setIsAuthenticated, setEmail, setProfileImage, setDisplayName, setPairId, setDeviceId, setSessionChecked]);

  // Device-id recovery ,  runs after hydration so the persisted deviceId is
  // loaded, and after the user role is known so we can recover either a
  // parent deviceId (default) or a child deviceId.
  useEffect(() => {
    if (!_hasHydrated) return;
    if (!userId) return;
    if (!isAuthenticated) return;

    let cancelled = false;
    (async () => {
      const persistedDeviceId = useAuthStore.getState().deviceId;
      try {
        let recovered: string | null = null;
        if (userRole === 'parent') {
          recovered = await resolveParentDeviceId(userId, persistedDeviceId);
        } else if (userRole === 'child') {
          recovered = await resolveChildDeviceId(userId, persistedDeviceId);
        }
        if (!cancelled && recovered && recovered !== persistedDeviceId) {
          setDeviceId(recovered);
        }
      } catch (err) {
        logger.warn('device-recovery failed (post-hydration)', err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [_hasHydrated, isAuthenticated, userId, userRole, setDeviceId]);

  // Sync device presence + FCM token via edge function.
  useEffect(() => {
    async function syncDevice() {
      if (!_hasHydrated) return;
      if (!isAuthenticated || !deviceId) return;

      let pushToken: string | null = null;
      try {
        const { granted } = await requestFcmPermission();
        const token = useAuthStore.getState().fcmToken;
        if (granted && token) {
          pushToken = token;
        }
      } catch (err) {
        logger.warn('Failed to get FCM token:', err);
      }

      try {
        await supabase.functions.invoke('sync-device', {
          body: {
            device_id: deviceId,
            is_foreground: true,
            push_token: pushToken,
          },
        });
        useAuthStore.getState().clearSyncDeviceError();
      } catch (e) {
        let realMsg = e instanceof Error ? e.message : 'unknown';
        try {
          const ctx = (e as any)?.context;
          if (ctx) {
            const body = await ctx.json();
            if (body?.error) realMsg = body.error;
          }
        } catch {}
        logger.warn('Failed to sync device:', new Error(realMsg));
        useAuthStore.getState().incrementSyncDeviceError(realMsg);
      }
    }
    syncDevice();
  }, [_hasHydrated, isAuthenticated, userRole, deviceId, userId]);

  // Listen for AppState changes to update foreground status.
  useEffect(() => {
    if (!_hasHydrated) return;
    if (!deviceId || !isAuthenticated) return;

    const { incrementSyncDeviceError, clearSyncDeviceError } = useAuthStore.getState();

    const updatePresence = async (foreground: boolean) => {
      let fcmToken = useAuthStore.getState().fcmToken;
      if (!fcmToken) {
        try {
          const { granted } = await requestFcmPermission();
          if (granted) {
            fcmToken = useAuthStore.getState().fcmToken;
          }
        } catch (err) {
          logger.warn('Failed to get FCM token on foreground:', err);
        }
      }
      try {
        await supabase.functions.invoke('sync-device', {
          body: {
            device_id: deviceId,
            is_foreground: foreground,
            push_token: fcmToken,
          },
        });
        clearSyncDeviceError();
      } catch (e) {
        let realMsg = e instanceof Error ? e.message : 'unknown';
        try {
          const ctx = (e as any)?.context;
          if (ctx) {
            const body = await ctx.json();
            if (body?.error) realMsg = body.error;
          }
        } catch {}
        logger.warn('Failed to update presence:', new Error(realMsg));
        incrementSyncDeviceError(realMsg);
      }
    };

    let heartbeatInterval: ReturnType<typeof setInterval> | null = null;
    const startHeartbeat = (foreground: boolean) => {
      if (heartbeatInterval) clearInterval(heartbeatInterval);
      if (!foreground) return;
      heartbeatInterval = setInterval(() => {
        const { syncDeviceErrorCount } = useAuthStore.getState();
        if (syncDeviceErrorCount >= 5) {
          return;
        }
        updatePresence(true);
      }, 30000);
    };

    const initialForeground = AppState.currentState === 'active';
    updatePresence(initialForeground);
    startHeartbeat(initialForeground);

    const subscription = AppState.addEventListener('change', (nextState) => {
      const foreground = nextState === 'active';
      clearSyncDeviceError();
      startHeartbeat(foreground);
      updatePresence(foreground);
      if (foreground && userRole === 'child') {
        flushBuffer().catch(() => {});
      }
    });

    return () => {
      subscription.remove();
      if (heartbeatInterval) clearInterval(heartbeatInterval);
    };
  }, [_hasHydrated, deviceId, isAuthenticated, userRole]);

  if (!loaded && !error) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ErrorBoundary>
        <ModalProvider>
          <ThemeProvider value={LightTheme}>
            <StatusBar style="dark" />
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: authTheme.background },
                animation: 'fade',
                animationDuration: 220,
              }}
            />
          </ThemeProvider>
        </ModalProvider>
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
}