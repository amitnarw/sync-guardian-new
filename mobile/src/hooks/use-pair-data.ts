import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { logger } from '@/services/logger';
import { useAuthStore } from '@/hooks/use-auth-store';

export interface MirroredNotification {
  id: string;
  pair_id: string;
  child_device_id: string;
  source_package: string | null;
  source_app_name: string | null;
  notification_title: string;
  notification_body: string;
  notification_posted_at: string;
  delivery_mode: string;
}

export interface UsePairDataResult {
  pair: { id: string; child_device_id: string } | null;
  childDevice: {
    id: string;
    device_name: string | null;
    is_foreground: boolean;
    last_seen_at: string | null;
    push_token: string | null;
  } | null;
  notifications: MirroredNotification[];
  latestNotification: MirroredNotification | null;
  isOnline: boolean;
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function usePairData(): UsePairDataResult {
  const { deviceId, pairId: storePairId, userRole } = useAuthStore();
  const [pair, setPair] = useState<UsePairDataResult['pair']>(null);
  const [childDevice, setChildDevice] = useState<UsePairDataResult['childDevice']>(null);
  const [notifications, setNotifications] = useState<MirroredNotification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const channelsRef = useRef<ReturnType<typeof supabase.channel>[]>([]);
  const cancelledRef = useRef(false);

  // Only Parent devices should query pair data
  const isParent = userRole === 'parent';

  const isOnline = childDevice
    ? childDevice.is_foreground ||
      (childDevice.last_seen_at !== null &&
        Date.now() - safeParseDate(childDevice.last_seen_at) < 120000)
    : false;

  function safeParseDate(dateStr: string | null): number {
    if (!dateStr) return 0
    const ts = new Date(dateStr).getTime()
    return isNaN(ts) ? 0 : ts
  }

  const latestNotification = notifications.length > 0 ? notifications[0] : null;

  const init = useCallback(async (isRefresh = false) => {
    const auth = useAuthStore.getState();
    const dId = auth.deviceId;
    const sPId = auth.pairId;

    if (!isParent) {
      setIsLoading(false)
      return
    }

    if (isRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setError(null);

    try {
      // Unsubscribe old channels before re-fetching
      channelsRef.current.forEach((ch) => supabase.removeChannel(ch));
      channelsRef.current = [];

      // 1. Resolve the active pair
      let resolvedPair: { id: string; child_device_id: string } | null = null;

      if (sPId && dId) {
        const { data, error: pairError } = await supabase
          .from('pairs')
          .select('id, child_device_id')
          .eq('id', sPId)
          .single();
        if (!pairError && data) {
          resolvedPair = data;
        }
      }

      if (!resolvedPair && dId) {
        const { data, error: pairError } = await supabase
          .from('pairs')
          .select('id, child_device_id')
          .eq('parent_device_id', dId)
          .in('status', ['active', 'pending'])
          .limit(1);
        if (!pairError && data && data.length > 0) {
          resolvedPair = data[0];
        }
      }

      if (cancelledRef.current) return;

      if (!resolvedPair) {
        setPair(null);
        setChildDevice(null);
        setNotifications([]);
        return;
      }

      setPair(resolvedPair);

      // 2. Fetch child device info
      const { data: devData, error: devError } = await supabase
        .from('devices')
        .select('id, device_name, is_foreground, last_seen_at, push_token')
        .eq('id', resolvedPair.child_device_id)
        .single();
      if (devData && !cancelledRef.current) {
        setChildDevice(devData as any);
      } else if (devError) {
        logger.warn('usePairData: child device query error:', devError);
      }

      // 3. Fetch recent notifications
      const { data: notifData, error: notifError } = await supabase
        .from('mirrored_notifications')
        .select('*')
        .eq('pair_id', resolvedPair.id)
        .order('notification_posted_at', { ascending: false })
        .limit(50);
      if (notifData && !cancelledRef.current) {
        setNotifications(notifData as MirroredNotification[]);
      } else if (notifError) {
        logger.warn('usePairData: notifications query error:', notifError);
      }

      if (cancelledRef.current) return;

      // 4. Subscribe to realtime changes
      const deviceChannel = supabase
        .channel(`device_presence_${resolvedPair.child_device_id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'devices',
            filter: `id=eq.${resolvedPair.child_device_id}`,
          },
          (payload) => {
            const updated = payload.new as any;
            setChildDevice((prev) => (prev ? { ...prev, ...updated } : prev));
          },
        )
        .subscribe();

      const notifChannel = supabase
        .channel(`notifications_${resolvedPair.id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'mirrored_notifications',
            filter: `pair_id=eq.${resolvedPair.id}`,
          },
          (payload) => {
            const newNotif = payload.new as MirroredNotification;
            setNotifications((prev) => {
              const exists = prev.some((n) => n.id === newNotif.id);
              if (exists) return prev;
              return [newNotif, ...prev];
            });
          },
        )
        .subscribe();

      channelsRef.current = [deviceChannel, notifChannel];
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load pair data');
      logger.warn('usePairData: init error:', err);
    } finally {
      if (isRefresh) {
        setIsRefreshing(false);
      } else {
        setIsLoading(false);
      }
    }
  }, [isParent]);

  // Bootstrap: resolve pair, then fetch child + notifications + subscribe
  useEffect(() => {
    cancelledRef.current = false;
    init(false);

    return () => {
      cancelledRef.current = true;
      channelsRef.current.forEach((ch) => supabase.removeChannel(ch));
      channelsRef.current = [];
    };
  }, [deviceId, storePairId, isParent]);

  const refresh = useCallback(async () => {
    await init(true);
  }, [init]);

  // Re-evaluate isOnline every 30s for the last_seen_at timeout
  const [, forceUpdate] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => forceUpdate((n) => n + 1), 30000);
    return () => clearInterval(interval);
  }, []);

  if (!isParent) {
    return { pair: null, childDevice: null, notifications: [], latestNotification: null, isOnline: false, isLoading: false, isRefreshing: false, error: null, refresh: async () => {} };
  }

  return {
    pair,
    childDevice,
    notifications,
    latestNotification,
    isOnline,
    isLoading,
    isRefreshing,
    error,
    refresh,
  };
}
