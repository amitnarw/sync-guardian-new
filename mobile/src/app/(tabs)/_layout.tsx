import AppTabs from '@/components/app-tabs';
import { useProtectedRoute } from '@/hooks/use-protected-route';
import { PairDataProvider } from '@/contexts/PairDataContext';

export default function TabsLayout() {
  useProtectedRoute('parent');
  return (
    <PairDataProvider>
      <AppTabs />
    </PairDataProvider>
  );
}