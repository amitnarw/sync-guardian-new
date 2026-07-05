import AppTabs from '@/components/app-tabs';
import { useProtectedRoute } from '@/hooks/use-protected-route';

export default function TabsLayout() {
  useProtectedRoute('parent');
  return <AppTabs />;
}