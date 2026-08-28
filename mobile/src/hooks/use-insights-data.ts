import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { isValidUUID } from '@/lib/uuid';
import { useAuthStore } from '@/hooks/use-auth-store';
import { usePairData } from '@/hooks/use-pair-data';
import { fetchParentNotificationsPaginated } from '@/services/notifications-service';

export interface InsightsNotification {
  id: string;
  pair_id: string;
  child_device_id: string;
  source_package: string | null;
  source_app_name: string | null;
  notification_title: string;
  notification_body: string;
  notification_posted_at: string;
  app_icon_base64: string | null;
}

export type TimeWindow = 'today' | 'week' | 'month' | 'year';

export interface InsightsChildBreakdown {
  pairId: string;
  displayName: string | null;
  count: number;
}

export interface UseInsightsDataResult {
  notifications: InsightsNotification[];
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  window: TimeWindow;
  setWindow: (w: TimeWindow) => void;
  refresh: () => void;
  perChildBreakdown: InsightsChildBreakdown[];
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
  const deviceId = useAuthStore((s) => s.deviceId);
  const userRole = useAuthStore((s) => s.userRole);
  const selectedChildId = useAuthStore((s) => s.selectedChildId);
  const setSelectedChildId = useAuthStore((s) => s.setSelectedChildId);
  const { allChildren } = usePairData();
  const allChildrenKey = allChildren.map((c) => c.pairId).join(',');

  const [window, setWindow] = useState<TimeWindow>('today');
  const [notifications, setNotifications] = useState<InsightsNotification[]>([]);
  const [childNames, setChildNames] = useState<Record<string, string | null>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshCounter, setRefreshCounter] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const channelsRef = useRef<ReturnType<typeof supabase.channel>[]>([]);
  const effectIdRef = useRef(0);

  const isParent = userRole === 'parent';

  const refresh = useCallback(() => {
    setIsRefreshing(true);
    setRefreshCounter((c) => c + 1);
  }, []);

  useEffect(() => {
    if (!isParent) {
      setIsLoading(false);
      return;
    }
    if (!isValidUUID(deviceId)) {
      setIsLoading(false);
      setNotifications([]);
      return;
    }

    const effectId = ++effectIdRef.current;
    let cancelled = false;

    const cleanupChannels = () => {
      for (const ch of channelsRef.current) {
        supabase.removeChannel(ch).catch(() => undefined);
      }
      channelsRef.current = [];
    };

    const fetchData = async () => {
      if (cancelled) return;
      setIsLoading(true);
      setError(null);

      try {
        const startDate = getStartDate(window);
        const result = await fetchParentNotificationsPaginated({
          parentDeviceId: deviceId,
          selectedChildId,
          since: startDate,
          maxPages: 10,
        });

        if (cancelled || effectId !== effectIdRef.current) return;

        const namesMap: Record<string, string | null> = {};
        for (const c of result.children) namesMap[c.pairId] = c.displayName;
        setChildNames(namesMap);

        // If the user's selection no longer matches any active/pending child,
        // flip to "all children" in one shot (no flicker, no double fetch).
        if (selectedChildId && !result.children.some((c) => c.pairId === selectedChildId)) {
          if (cancelled || effectId !== effectIdRef.current) return;
          setSelectedChildId(null);
          return;
        }

        setNotifications(result.notifications as InsightsNotification[]);

        cleanupChannels();

        for (const child of result.children) {
          if (selectedChildId && child.pairId !== selectedChildId) continue;
          const channel = supabase
            .channel(`insights_${child.pairId}_${Math.random().toString(36).slice(2)}`)
            .on(
              'postgres_changes',
              {
                event: 'INSERT',
                schema: 'public',
                table: 'mirrored_notifications',
                filter: `pair_id=eq.${child.pairId}`,
              },
              async (payload) => {
                const notifId = (payload.new as any).id;
                if (!notifId) return;

                const { data: fetched } = await supabase.functions.invoke('get-notifications', {
                  body: { ids: [notifId] },
                });

                if (fetched?.data?.length > 0) {
                  const newN = fetched.data[0] as InsightsNotification;
                  const currentStart = getStartDate(window);
                  if (newN.notification_posted_at >= currentStart) {
                    setNotifications((prev) => {
                      const exists = prev.some((n) => n.id === newN.id);
                      if (exists) return prev;
                      return [newN, ...prev];
                    });
                  }
                }
              },
            )
            .subscribe();

          channelsRef.current.push(channel);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'An unknown error occurred');
        }
      } finally {
        if (!cancelled && effectId === effectIdRef.current) {
          setIsLoading(false);
          setIsRefreshing(false);
        }
      }
    };

    fetchData();

    return () => {
      cancelled = true;
      cleanupChannels();
    };
  }, [isParent, deviceId, selectedChildId, window, refreshCounter, setSelectedChildId, allChildrenKey]);

  const perChildBreakdown = (() => {
    if (!selectedChildId) {
      const counts: Record<string, number> = {};
      for (const n of notifications) {
        counts[n.pair_id] = (counts[n.pair_id] ?? 0) + 1;
      }
      return Object.entries(counts).map(([pairId, count]) => ({
        pairId,
        displayName: childNames[pairId] ?? null,
        count,
      }));
    }
    return [];
  })();

  if (!isParent) {
    return {
      notifications: [],
      isLoading: false,
      isRefreshing: false,
      error: null,
      window,
      setWindow,
      refresh,
      perChildBreakdown: [],
    };
  }

  return {
    notifications,
    isLoading,
    isRefreshing,
    error,
    window,
    setWindow,
    refresh,
    perChildBreakdown,
  };
}
