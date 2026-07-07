import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/hooks/use-auth-store';

export interface InsightsNotification {
  id: string;
  source_package: string | null;
  source_app_name: string | null;
  notification_title: string;
  notification_posted_at: string;
}

export type TimeWindow = 'today' | 'week' | 'month' | 'year';

export interface UseInsightsDataResult {
  notifications: InsightsNotification[];
  isLoading: boolean;
  error: string | null;
  window: TimeWindow;
  setWindow: (w: TimeWindow) => void;
  refresh: () => void;
}

function getStartDate(window: TimeWindow): string {
  const now = new Date();
  switch (window) {
    case 'today': {
      const d = new Date(now);
      d.setHours(0, 0, 0, 0);
      return d.toISOString();
    }
    case 'week':
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    case 'month':
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    case 'year':
      return new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString();
  }
}

export function useInsightsData(): UseInsightsDataResult {
  const { deviceId, pairId: storePairId, userRole } = useAuthStore();
  const [window, setWindow] = useState<TimeWindow>('week');
  const [notifications, setNotifications] = useState<InsightsNotification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshCounter, setRefreshCounter] = useState(0);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const isParent = userRole === 'parent';

  const refresh = useCallback(() => setRefreshCounter(c => c + 1), []);

  const resolvePair = useCallback(async (): Promise<string | null> => {
    if (storePairId && deviceId) {
      const { data } = await supabase
        .from('pairs')
        .select('id')
        .eq('id', storePairId)
        .single();
      if (data) return data.id;
    }
    if (deviceId) {
      const { data } = await supabase
        .from('pairs')
        .select('id')
        .eq('parent_device_id', deviceId)
        .in('status', ['active', 'pending'])
        .limit(1);
      if (data && data.length > 0) return data[0].id;
    }
    return null;
  }, [deviceId, storePairId]);

  useEffect(() => {
    if (!isParent) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    const fetchData = async () => {
      if (cancelled) return;
      setIsLoading(true);
      setError(null);

      try {
        const pairId = await resolvePair();
        if (cancelled) return;

        if (!pairId) {
          setNotifications([]);
          return;
        }

        const startDate = getStartDate(window);

        const { data, error: fetchError } = await supabase
          .from('mirrored_notifications')
          .select('id, source_package, source_app_name, notification_title, notification_posted_at')
          .eq('pair_id', pairId)
          .gte('notification_posted_at', startDate)
          .order('notification_posted_at', { ascending: false })
          .limit(2000);

        if (cancelled) return;

        if (fetchError) {
          setError(fetchError.message);
          return;
        }

        setNotifications(data as InsightsNotification[] ?? []);

        if (channelRef.current) {
          supabase.removeChannel(channelRef.current);
          channelRef.current = null;
        }

        const channel = supabase
          .channel(`insights_${pairId}`)
          .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'mirrored_notifications',
            filter: `pair_id=eq.${pairId}`,
          }, (payload) => {
            const newN = payload.new as InsightsNotification;
            const currentStart = getStartDate(window);
            if (newN.notification_posted_at >= currentStart) {
              setNotifications(prev => {
                const exists = prev.some(n => n.id === newN.id);
                if (exists) return prev;
                return [newN, ...prev];
              });
            }
          })
          .subscribe();

        channelRef.current = channel;
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'An unknown error occurred');
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      cancelled = true;
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [isParent, resolvePair, window, refreshCounter]);

  if (!isParent) {
    return { notifications: [], isLoading: false, error: null, window, setWindow, refresh };
  }

  return { notifications, isLoading, error, window, setWindow, refresh };
}
