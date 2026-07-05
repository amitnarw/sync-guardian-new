import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import React, { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AppState } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useAuthTheme } from '@/hooks/use-auth-theme';
import { useAuthStore } from '@/hooks/use-auth-store';
import { ModalProvider } from '@/hooks/use-app-modal';
import { supabase } from '@/lib/supabase';
import { getApp } from '@react-native-firebase/app';
import { getMessaging, requestPermission, getToken, AuthorizationStatus } from '@react-native-firebase/messaging';
import '@/services/fcm-handler';
import { flushBuffer } from '@/services/mmkv-buffer';
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
  const { userRole, isAuthenticated, deviceId, userId, setFcmToken, setUserId, setIsAuthenticated, setEmail } = useAuthStore();

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
        // Verify the session user still exists in Supabase
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error || !user) {
          // Session is invalid - sign out locally
          await supabase.auth.signOut();
          setIsAuthenticated(false);
          setUserId(null);
          setEmail(null);
          return;
        }
        setIsAuthenticated(true);
        setUserId(user.id);
        setEmail(user.email ?? null);
      }
    }
    restoreSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            setIsAuthenticated(true);
            setUserId(user.id);
            setEmail(user.email ?? null);
          }
        } else if (event === 'SIGNED_OUT') {
          setIsAuthenticated(false);
          setUserId(null);
        }
      },
    );

    return () => subscription.unsubscribe();
  }, []);

  // Sync device presence + FCM token on auth state change
  // Also links device.user_id to the authenticated user
  useEffect(() => {
    async function syncDevice() {
      if (!isAuthenticated || !deviceId) return;

      const updates: Record<string, any> = {
        is_foreground: true,
        last_seen_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Link device to auth user if not already set
      if (userId) {
        updates.user_id = userId;
      }

      // Request FCM token for both Parent (push alerts) and Child (wake-up signal)
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
          updates.push_token = token;
        }
      } catch (error) {
        console.warn('Failed to get FCM token:', error);
      }

      try {
        await supabase.from('devices').update(updates).eq('id', deviceId);
      } catch (e) {
        console.warn('Failed to sync device:', e);
      }
    }
    syncDevice();
  }, [isAuthenticated, userRole, deviceId, userId]);

  // Listen for AppState changes to update foreground status
  useEffect(() => {
    if (!deviceId || !isAuthenticated) return;

    const updatePresence = async (foreground: boolean) => {
      try {
        await supabase
          .from('devices')
          .update({
            is_foreground: foreground,
            last_seen_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', deviceId);
      } catch {}
    };

    const subscription = AppState.addEventListener('change', (nextState) => {
      const foreground = nextState === 'active';
      updatePresence(foreground);
      // Flush buffered notifications when app returns to foreground
      if (foreground && userRole === 'child') {
        flushBuffer().catch(() => {});
      }
    });

    // Heartbeat every 30 seconds while active
    let heartbeatInterval: ReturnType<typeof setInterval> | null = null;
    const startHeartbeat = () => {
      if (heartbeatInterval) clearInterval(heartbeatInterval);
      heartbeatInterval = setInterval(() => {
        updatePresence(true);
      }, 30000);
    };
    startHeartbeat();

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
    </GestureHandlerRootView>
  );
}