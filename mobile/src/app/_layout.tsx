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
import { getApp } from '@react-native-firebase/app';
import { getMessaging, requestPermission, getToken, AuthorizationStatus } from '@react-native-firebase/messaging';
import '@/services/fcm-handler';
import { flushBuffer } from '@/services/mmkv-buffer';
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
  PlusJakartaSans_800ExtraBold_Italic
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
  const { userRole, isAuthenticated, deviceId, userId, setFcmToken, setUserId, setIsAuthenticated, setEmail, setProfileImage, setDisplayName, setPairId, setDeviceId, setSessionChecked } = useAuthStore();

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

  // Restore Supabase Auth session on app launch and validate user exists
  useEffect(() => {
    async function restoreSession() {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error || !user) {
          logger.warn('Session invalid on restore, signing out');
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
        setIsAuthenticated(true);
        setUserId(user.id);
        setEmail(user.email ?? null);
        const meta = user.user_metadata || {};
        setProfileImage(meta.avatar_url || meta.picture || null);
        setDisplayName(meta.full_name || meta.name || null);
      }
      setSessionChecked(true);
    }
    restoreSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async       (event, session) => {
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          const { data: { user } } = await supabase.auth.getUser();
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
  }, []);

  // Sync device presence + FCM token via edge function
  useEffect(() => {
    async function syncDevice() {
      if (!isAuthenticated || !deviceId) return;

      let pushToken: string | null = null;

      try {
        const app = getApp();
        const messaging = getMessaging(app);
        const authStatus = await requestPermission(messaging);
        const enabled =
          authStatus === AuthorizationStatus.AUTHORIZED ||
          authStatus === AuthorizationStatus.PROVISIONAL;
        if (enabled) {
          const token = await getToken(messaging);
          setFcmToken(token);
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
  }, [isAuthenticated, userRole, deviceId, userId]);

  // Listen for AppState changes to update foreground status
  useEffect(() => {
    if (!deviceId || !isAuthenticated) return;

    const { incrementSyncDeviceError, clearSyncDeviceError } = useAuthStore.getState();

    const updatePresence = async (foreground: boolean) => {
      try {
        await supabase.functions.invoke('sync-device', {
          body: {
            device_id: deviceId,
            is_foreground: foreground,
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
    const startHeartbeat = () => {
      if (heartbeatInterval) clearInterval(heartbeatInterval);
      heartbeatInterval = setInterval(() => {
        const { syncDeviceErrorCount } = useAuthStore.getState();
        if (syncDeviceErrorCount >= 5) {
          return;
        }
        updatePresence(true);
      }, 30000);
    };
    startHeartbeat();

    const subscription = AppState.addEventListener('change', (nextState) => {
      const foreground = nextState === 'active';
      clearSyncDeviceError();
      if (foreground) {
        startHeartbeat();
      }
      updatePresence(foreground);
      // Flush buffered notifications when app returns to foreground
      if (foreground && userRole === 'child') {
        flushBuffer().catch(() => {});
      }
    });

    return () => {
      subscription.remove();
      if (heartbeatInterval) clearInterval(heartbeatInterval);
    };
  }, [deviceId, isAuthenticated]);

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
          }}
        />
      </ThemeProvider>
      </ModalProvider>
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
}