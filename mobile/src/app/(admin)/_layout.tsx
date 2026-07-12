import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useAuthTheme } from '@/hooks/use-auth-theme';
import { useProtectedRouteAdmin } from '@/hooks/use-protected-route';

export default function AdminLayout() {
  const colors = useAuthTheme();
  // Redirects to /login if not authed, or out if not an admin.
  useProtectedRouteAdmin();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style="dark" backgroundColor={colors.background} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
          animation: 'fade',
        }}
      />
    </SafeAreaView>
  );
}
