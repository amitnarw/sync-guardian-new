import { usePairDataContext, type MirroredNotification, type ChildSummary } from '@/contexts/PairDataContext';

export type { MirroredNotification, ChildSummary };

export type UsePairDataResult = {
  pair: { id: string; child_device_id: string } | null;
  childDevice: {
    id: string;
    is_foreground: boolean;
    last_seen_at: string | null;
    push_token: string | null;
  } | null;
  childName: string | null;
  notifications: MirroredNotification[];
  latestNotification: MirroredNotification | null;
  isOnline: boolean;
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  allChildren: ChildSummary[];
  refresh: () => Promise<void>;
};

export function usePairData(): UsePairDataResult {
  return usePairDataContext();
}
