import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import React from 'react';
import { useColorScheme } from 'react-native';
import { Stack } from 'expo-router';
import { useAuthTheme } from '@/hooks/use-auth-theme';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const authTheme = useAuthTheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: authTheme.background },
        }}
      />
    </ThemeProvider>
  );
}