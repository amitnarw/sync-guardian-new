import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { useAuthStore } from '@/hooks/use-auth-store';
import { supabase } from '@/lib/supabase';

export default function Index() {
  const _hasHydrated = useAuthStore((state) => state._hasHydrated);
  const sessionChecked = useAuthStore((state) => state.sessionChecked);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const userRole = useAuthStore((state) => state.userRole);
  const pairId = useAuthStore((state) => state.pairId);
  const clearPair = useAuthStore((state) => state.clearPair);
  const [isValidating, setIsValidating] = useState(false);

  useEffect(() => {
    if (!_hasHydrated || !sessionChecked) return;

    if (!isAuthenticated) {
      router.replace('/splash');
      return;
    }

    if (!userRole) {
      router.replace('/role-selection');
      return;
    }

    if (userRole !== 'child') {
      router.replace('/(tabs)/home');
      return;
    }

    if (!pairId) {
      router.replace('/pairing');
      return;
    }

    // Child has a stored pairId — validate it's still active on boot
    if (isValidating) return;

    setIsValidating(true);
    (async () => {
      try {
        const { data, error } = await supabase
          .from('pairs')
          .select('status')
          .eq('id', pairId)
          .single();
        if (error || !data || data.status !== 'active') {
          clearPair();
          router.replace('/pairing');
        } else {
          router.replace('/(child)/home');
        }
      } catch {
        router.replace('/(child)/home');
      } finally {
        setIsValidating(false);
      }
    })();
  }, [_hasHydrated, sessionChecked, isAuthenticated, userRole, pairId, isValidating, clearPair]);

  return null;
}
