import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import React, { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useAuthTheme } from '@/hooks/use-auth-theme';
import { useAuthStore } from '@/hooks/use-auth-store';
import messaging from '@react-native-firebase/messaging';
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
  const { userRole, isAuthenticated, setFcmToken } = useAuthStore();

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

  useEffect(() => {
    async function requestUserPermission() {
      // ONLY request push notifications if the user is fully logged in AND is a Parent
      if (!isAuthenticated || userRole !== 'parent') return;

      const authStatus = await messaging().requestPermission();
      const enabled =
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL;

      if (enabled) {
        console.log('Authorization status:', authStatus);
        try {
          const token = await messaging().getToken();
          setFcmToken(token);
          // Normally we'd send this to Supabase to tie it to the `devices` table
        } catch (error) {
          console.warn('Failed to get FCM token (likely due to mock Firebase config):', error);
        }
      }
    }
    requestUserPermission();
  }, [isAuthenticated, userRole]);

  if (!loaded && !error) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
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
    </GestureHandlerRootView>
  );
}