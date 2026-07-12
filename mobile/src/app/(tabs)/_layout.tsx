import { useEffect, useRef } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import AppTabs from '@/components/app-tabs';
import AppHeader from '@/components/app-header';
import { useProtectedRoute } from '@/hooks/use-protected-route';
import { usePairStatusGuard } from '@/hooks/use-pair-status-guard';
import { useAuthStore } from '@/hooks/use-auth-store';
import { useAppModal } from '@/hooks/use-app-modal';
import { PairDataProvider } from '@/contexts/PairDataContext';
import { HeaderRefreshProvider } from '@/contexts/HeaderRefreshContext';

export default function TabsLayout() {
  useProtectedRoute('parent');
  usePairStatusGuard('parent');
  const syncDeviceErrorCount = useAuthStore((s) => s.syncDeviceErrorCount);
  const syncDeviceError = useAuthStore((s) => s.syncDeviceError);
  const { showModal } = useAppModal();
  const shownRef = useRef(false);

  useEffect(() => {
    if (syncDeviceErrorCount >= 3 && syncDeviceError && !shownRef.current) {
      shownRef.current = true;
      showModal({
        title: 'Sync Issue Detected',
        message: 'Your device is having trouble syncing. Please re-register or check your connection.',
        icon: 'warning',
        primaryButton: 'Okay',
        onPrimaryPress: () => { shownRef.current = false; },
      });
    }
  }, [syncDeviceErrorCount, syncDeviceError, showModal]);

  return (
    <PairDataProvider>
      <HeaderRefreshProvider>
        <SafeAreaView style={{ flex: 1, backgroundColor: '#fff8f0' }} edges={['top']}>
          <AppHeader role="parent" />
          <AppTabs />
        </SafeAreaView>
      </HeaderRefreshProvider>
    </PairDataProvider>
  );
}