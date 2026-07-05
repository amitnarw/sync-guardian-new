import { useEffect } from 'react';
import { router } from 'expo-router';
import { useAuthStore } from '@/hooks/use-auth-store';

export default function Index() {
  const _hasHydrated = useAuthStore((state) => state._hasHydrated);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const userRole = useAuthStore((state) => state.userRole);
  const pairId = useAuthStore((state) => state.pairId);

  useEffect(() => {
    // Wait for auth store to hydrate before checking state
    if (!_hasHydrated) return;

    if (isAuthenticated) {
      if (!userRole) {
        router.replace('/role-selection');
      } else if (userRole === 'child' && !pairId) {
        router.replace('/pairing');
      } else if (userRole === 'child') {
        router.replace('/(child)/home');
      } else {
        router.replace('/(tabs)/home');
      }
    } else {
      router.replace('/splash');
    }
  }, [_hasHydrated, isAuthenticated, userRole, pairId]);

  return null;
}
