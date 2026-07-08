import AppTabs from '@/components/app-tabs';
import { useProtectedRoute } from '@/hooks/use-protected-route';
import { usePairStatusGuard } from '@/hooks/use-pair-status-guard';
import { PairDataProvider } from '@/contexts/PairDataContext';

export default function TabsLayout() {
  useProtectedRoute('parent');
  usePairStatusGuard('parent');
  return (
    <PairDataProvider>
      <AppTabs />
    </PairDataProvider>
  );
}