import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
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
  error: string | null;
}

export function usePairData(): UsePairDataResult {
  const { deviceId, pairId: storePairId, userRole } = useAuthStore();
  const [pair, setPair] = useState<UsePairDataResult['pair']>(null);
  const [childDevice, setChildDevice] = useState<UsePairDataResult['childDevice']>(null);
  const [notifications, setNotifications] = useState<MirroredNotification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const channelsRef = useRef<ReturnType<typeof supabase.channel>[]>([]);

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

  // Bootstrap: resolve pair, then fetch child + notifications + subscribe
  useEffect(() => {
    if (!isParent) {
      setIsLoading(false)
      return
    }

    let cancelled = false;

    const init = async () => {
      setIsLoading(true);
      setError(null);

      console.log('usePairData init:', { storePairId, deviceId, isParent });

      // 1. Resolve the active pair
      let resolvedPair: { id: string; child_device_id: string } | null = null;

      if (storePairId && deviceId) {
        const { data, error: pairError } = await supabase
          .from('pairs')
          .select('id, child_device_id')
          .eq('id', storePairId)
          .single();
        if (!pairError && data) {
          resolvedPair = data;
          console.log('usePairData: resolved pair by storePairId:', data);
        } else {
          console.warn('usePairData: storePairId query failed:', pairError);
        }
      }

      if (!resolvedPair && deviceId) {
        const { data, error: pairError } = await supabase
          .from('pairs')
          .select('id, child_device_id')
          .eq('parent_device_id', deviceId)
          .in('status', ['active', 'pending'])
          .limit(1);
        if (!pairError && data && data.length > 0) {
          resolvedPair = data[0];
          console.log('usePairData: resolved pair by deviceId fallback:', data[0]);
        } else if (pairError) {
          console.warn('usePairData: fallback pair query error:', pairError);
        } else {
          console.warn('usePairData: fallback pair query returned empty array');
        }
      }

      if (cancelled) return;

      if (!resolvedPair) {
        setIsLoading(false);
        return;
      }

      setPair(resolvedPair);

      // 2. Fetch child device info
      const { data: devData, error: devError } = await supabase
        .from('devices')
        .select('id, device_name, is_foreground, last_seen_at, push_token')
        .eq('id', resolvedPair.child_device_id)
        .single();
      if (devData && !cancelled) {
        setChildDevice(devData as any);
        console.log('usePairData: child device fetched:', devData.id);
      } else if (devError) {
        console.warn('usePairData: child device query error:', devError);
      }

      // 3. Fetch recent notifications
      const { data: notifData, error: notifError } = await supabase
        .from('mirrored_notifications')
        .select('*')
        .eq('pair_id', resolvedPair.id)
        .order('notification_posted_at', { ascending: false })
        .limit(50);
      if (notifData && !cancelled) {
        setNotifications(notifData as MirroredNotification[]);
        console.log('usePairData: fetched', notifData.length, 'notifications');
      } else if (notifError) {
        console.warn('usePairData: notifications query error:', notifError);
      }

      if (cancelled) return;

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

      setIsLoading(false);
    };

    init();

    return () => {
      cancelled = true;
      channelsRef.current.forEach((ch) => supabase.removeChannel(ch));
      channelsRef.current = [];
    };
  }, [deviceId, storePairId, isParent]);

  // Re-evaluate isOnline every 30s for the last_seen_at timeout
  const [, forceUpdate] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => forceUpdate((n) => n + 1), 30000);
    return () => clearInterval(interval);
  }, []);

  if (!isParent) {
    return { pair: null, childDevice: null, notifications: [], latestNotification: null, isOnline: false, isLoading: false, error: null };
  }

  return {
    pair,
    childDevice,
    notifications,
    latestNotification,
    isOnline,
    isLoading,
    error,
  };
}
