import { useEffect } from 'react';
import { router } from 'expo-router';
import { useAuthStore } from '@/hooks/use-auth-store';

export default function Index() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const userRole = useAuthStore((state) => state.userRole);

  useEffect(() => {
    if (isAuthenticated) {
      if (userRole === 'child') {
        router.replace('/(child)/home');
      } else {
        router.replace('/(tabs)/home');
      }
    } else {
      router.replace('/splash');
    }
  }, [isAuthenticated, userRole]);

  return null;
}