import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { isValidUUID } from '@/lib/uuid';
import { useAuthStore } from '@/hooks/use-auth-store';
import { usePairData } from '@/hooks/use-pair-data';
import { fetchParentNotificationsPaginated } from '@/services/notifications-service';
import { logger } from '@/services/logger';
import {
  buildCategoryMap,
  type CategoryMap,
  type NotificationWindow,
} from '@/lib/notification-analytics';

export interface InsightsNotification {
  id: string;
  pair_id: string | null;
  parent_user_id: string;
  child_user_id: string;
  child_device_id: string;
  source_package: string | null;
  source_app_name: string | null;
  notification_title: string;
  notification_body: string;
  notification_posted_at: string;
  app_icon_base64: string | null;
}

export type { NotificationWindow };

export interface InsightsChildBreakdown {
  childUserId: string;
  displayName: string | null;
  count: number;
}

export interface UseInsightsDataResult {
  notifications: InsightsNotification[];
  previousNotifications: InsightsNotification[];
  isLoading: boolean;
  isInitializing: boolean;
  isRefreshing: boolean;
  error: string | null;
  window: NotificationWindow;
  setWindow: (w: NotificationWindow) => void;
  refresh: () => void;
  perChildBreakdown: InsightsChildBreakdown[];
  categoryMap: CategoryMap;
}

function getStartDate(window: NotificationWindow): Date {
  const now = new Date();
  switch (window) {
    case 'today': {
      const d = new Date(now);
      d.setHours(0, 0, 0, 0);
      return d;
    }
    case 'week':
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case 'month':
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    case 'year':
      return new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
  }
}

function getPriorWindowStart(window: NotificationWindow): Date {
  const currentStart = getStartDate(window);
  switch (window) {
    case 'today':
      return new Date(currentStart.getTime() - 24 * 60 * 60 * 1000);
    case 'week':
      return new Date(currentStart.getTime() - 7 * 24 * 60 * 60 * 1000);
    case 'month':
      return new Date(currentStart.getTime() - 30 * 24 * 60 * 60 * 1000);
    case 'year':
      return new Date(currentStart.getTime() - 365 * 24 * 60 * 60 * 1000);
  }
}

async function fetchCategoryMap(): Promise<CategoryMap> {
  try {
    const { data, error } = await supabase.functions.invoke('get-app-categories', { body: {} });
    if (error || !data?.data) {
      if (error) logger.warn('[insights] get-app-categories error:', error.message ?? error);
      return buildCategoryMap([]);
    }
    return buildCategoryMap(data.data as { package_name: string; category: string }[]);
  } catch (e) {
    logger.warn('[insights] category fetch failed:', e);
    return buildCategoryMap([]);
  }
}

export function useInsightsData(): UseInsightsDataResult {
  const deviceId = useAuthStore((s) => s.deviceId);
  const userRole = useAuthStore((s) => s.userRole);
  const selectedChildId = useAuthStore((s) => s.selectedChildId);
  const setSelectedChildId = useAuthStore((s) => s.setSelectedChildId);
  const { allChildren } = usePairData();
  const allChildrenKey = allChildren.map((c) => c.childUserId).join(',');

  const [window, setWindow] = useState<NotificationWindow>('today');
  const [notifications, setNotifications] = useState<InsightsNotification[]>([]);
  const [previousNotifications, setPreviousNotifications] = useState<InsightsNotification[]>([]);
  const [categoryMap, setCategoryMap] = useState<CategoryMap>(() => buildCategoryMap([]));
  const [childNames, setChildNames] = useState<Record<string, string | null>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
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
    let cancelled = false;
    fetchCategoryMap().then((map) => {
      if (!cancelled) setCategoryMap(map);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isParent) {
      setIsLoading(false);
      return;
    }
    if (!isValidUUID(deviceId)) {
      setIsLoading(false);
      setNotifications([]);
      setPreviousNotifications([]);
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
        const priorStart = getPriorWindowStart(window);

        const [currentResult, priorResult, catMap] = await Promise.all([
          fetchParentNotificationsPaginated({
            parentDeviceId: deviceId,
            selectedChildId,
            since: startDate.toISOString(),
            maxPages: 10,
          }),
          fetchParentNotificationsPaginated({
            parentDeviceId: deviceId,
            selectedChildId,
            since: priorStart.toISOString(),
            before: startDate.toISOString(),
            maxPages: 5,
          }),
          categoryMap.size === 0 ? fetchCategoryMap() : Promise.resolve(categoryMap),
        ]);

        if (cancelled || effectId !== effectIdRef.current) return;

        if (catMap && catMap.size > 0 && catMap !== categoryMap) {
          setCategoryMap(catMap);
        }

        const namesMap: Record<string, string | null> = {};
        for (const c of currentResult.children) namesMap[c.childUserId] = c.displayName;
        for (const c of priorResult.children) namesMap[c.childUserId] = c.displayName;
        setChildNames(namesMap);

        if (selectedChildId && !currentResult.children.some((c) => c.childUserId === selectedChildId)) {
          if (cancelled || effectId !== effectIdRef.current) return;
          setSelectedChildId(null);
          return;
        }

        setNotifications(currentResult.notifications as InsightsNotification[]);
        setPreviousNotifications(priorResult.notifications as InsightsNotification[]);

        cleanupChannels();

        for (const child of currentResult.children) {
          if (selectedChildId && child.childUserId !== selectedChildId) continue;
          const channel = supabase
            .channel(`insights_${child.childUserId}_${Math.random().toString(36).slice(2)}`)
            .on(
              'postgres_changes',
              {
                event: 'INSERT',
                schema: 'public',
                table: 'mirrored_notifications',
                filter: `child_user_id=eq.${child.childUserId}`,
              },
              async (payload) => {
                const notifId = (payload.new as any).id;
                if (!notifId) return;

                const rowChildUserId = (payload.new as any)?.child_user_id ?? child.childUserId;
                const { data: fetched } = await supabase.functions.invoke('get-notifications', {
                  body: { child_user_id: rowChildUserId, ids: [notifId] },
                });

                if (fetched?.data?.length > 0) {
                  const newN = fetched.data[0] as InsightsNotification;
                  const currentStart = getStartDate(window);
                  if (new Date(newN.notification_posted_at).getTime() >= currentStart.getTime()) {
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
          setHasLoadedOnce(true);
        }
      }
    };

    fetchData();

    return () => {
      cancelled = true;
      cleanupChannels();
    };
  }, [isParent, deviceId, selectedChildId, window, refreshCounter, setSelectedChildId, allChildrenKey, categoryMap]);

  const perChildBreakdown = (() => {
    if (!selectedChildId) {
      const counts: Record<string, number> = {};
      for (const n of notifications) {
        counts[n.child_user_id] = (counts[n.child_user_id] ?? 0) + 1;
      }
      return Object.entries(counts).map(([childUserId, count]) => ({
        childUserId,
        displayName: childNames[childUserId] ?? null,
        count,
      }));
    }
    return [];
  })();

  if (!isParent) {
    return {
      notifications: [],
      previousNotifications: [],
      isLoading: false,
      isInitializing: false,
      isRefreshing: false,
      error: null,
      window,
      setWindow,
      refresh,
      perChildBreakdown: [],
      categoryMap,
    };
  }

  return {
    notifications,
    previousNotifications,
    isLoading,
    isInitializing: isLoading && !hasLoadedOnce,
    isRefreshing,
    error,
    window,
    setWindow,
    refresh,
    perChildBreakdown,
    categoryMap,
  };
}
