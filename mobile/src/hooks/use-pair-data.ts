import { usePairDataContext } from '@/contexts/PairDataContext';

export type MirroredNotification = {
  id: string;
  pair_id: string;
  child_device_id: string;
  source_package: string | null;
  source_app_name: string | null;
  notification_title: string;
  notification_body: string;
  notification_posted_at: string;
  delivery_mode: string;
  app_icon_base64: string | null;
};

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
  refresh: () => Promise<void>;
};

export function usePairData(): UsePairDataResult {
  return usePairDataContext();
}
