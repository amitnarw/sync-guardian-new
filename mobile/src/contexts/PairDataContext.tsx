import React, { createContext, useContext, useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { isValidUUID } from '@/lib/uuid';
import { logger } from '@/services/logger';
import { useAuthStore } from '@/hooks/use-auth-store';

export interface MirroredNotification {
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
  delivery_mode: string;
  app_icon_base64: string | null;
}

export interface ChildSummary {
  pairId: string;
  childDeviceId: string;
  childUserId: string;
  displayName: string | null;
  isOnline: boolean;
  lastSeenAt: string | null;
  isForeground: boolean;
  pushToken: string | null;
}

interface PairDataState {
  pair: { id: string; child_device_id: string } | null;
  /**
   * The child_user_id of the currently selected child. Stable across
   * disconnect/reconnect cycles, unlike `pair.id`. Used for comparison
   * against the auth store's `selectedChildId` so we don't repeatedly
   * re-run `init()` on every render.
   */
  currentChildUserId: string | null;
  childDevice: {
    id: string;
    is_foreground: boolean;
    last_seen_at: string | null;
    push_token: string | null;
  } | null;
  childName: string | null;
  notifications: MirroredNotification[];
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
}

interface PairDataContextValue extends PairDataState {
  latestNotification: MirroredNotification | null;
  isOnline: boolean;
  allChildren: ChildSummary[];
  refresh: () => Promise<void>;
}

const PairDataContext = createContext<PairDataContextValue | null>(null);

function safeParseDate(dateStr: string | null): number {
  if (!dateStr) return 0;
  const ts = new Date(dateStr).getTime();
  return isNaN(ts) ? 0 : ts;
}

function computeIsOnline(childDevice: PairDataState['childDevice']): boolean {
  if (!childDevice) return false;
  return (
    childDevice.is_foreground ||
    (childDevice.last_seen_at !== null &&
      Date.now() - safeParseDate(childDevice.last_seen_at) < 120000)
  );
}

function computeChildSummary(
  pairId: string,
  childDeviceId: string,
  childUserId: string,
  device: { is_foreground: boolean; last_seen_at: string | null; push_token: string | null } | null,
  displayName: string | null,
): ChildSummary {
  const isForeground = !!device?.is_foreground;
  const lastSeenAt = device?.last_seen_at ?? null;
  const isOnline =
    isForeground || (lastSeenAt !== null && Date.now() - safeParseDate(lastSeenAt) < 120000);
  return {
    pairId,
    childDeviceId,
    childUserId,
    displayName,
    isOnline,
    lastSeenAt,
    isForeground,
    pushToken: device?.push_token ?? null,
  };
}

export function PairDataProvider({ children }: { children: React.ReactNode }) {
  const { deviceId, userRole } = useAuthStore();
  const isParent = userRole === 'parent';

  const selectedChildIdFromStore = useAuthStore((s) => s.selectedChildId);
  const setSelectedChildIdInStore = useAuthStore((s) => s.setSelectedChildId);

  const [allChildren, setAllChildren] = useState<ChildSummary[]>([]);
  const [state, setState] = useState<PairDataState>({
    pair: null,
    currentChildUserId: null,
    childDevice: null,
    childName: null,
    notifications: [],
    isLoading: true,
    isRefreshing: false,
    error: null,
  });

  const channelsRef = useRef<ReturnType<typeof supabase.channel>[]>([]);
  const initIdRef = useRef(0);
  const cancelledRef = useRef(false);

  const removeAllChannels = useCallback(async () => {
    await Promise.all(channelsRef.current.map((ch) => supabase.removeChannel(ch)));
    channelsRef.current = [];
  }, []);

  const loadAllChildren = useCallback(async (): Promise<ChildSummary[]> => {
    const auth = useAuthStore.getState();
    const dId = auth.deviceId;
    if (!isValidUUID(dId)) return [];

    const { data, error } = await supabase
      .from('pairs')
      .select(
        'id, child_device_id, child_user_id, child_device:devices!child_device_id(is_foreground, last_seen_at, push_token), child_user:profiles!child_user_id(display_name)',
      )
      .eq('parent_device_id', dId)
      .in('status', ['active', 'pending'])
      .order('paired_at', { ascending: true });

    if (error || !data) {
      logger.warn('PairDataProvider: loadAllChildren error:', error);
      return [];
    }

    return (data as any[]).map((row) => {
      const device = row.child_device ?? null;
      const profile = row.child_user ?? null;
      return computeChildSummary(
        row.id as string,
        row.child_device_id as string,
        row.child_user_id as string,
        device,
        (profile?.display_name as string | null) ?? null,
      );
    });
  }, []);

  const loadChildData = useCallback(
    async (childUserId: string, childDeviceId: string): Promise<{
      device: PairDataState['childDevice'];
      name: string | null;
      notifications: MirroredNotification[];
    }> => {
      const [deviceRes, profileRes, notifRes] = await Promise.all([
        supabase
          .from('devices')
          .select('id, is_foreground, last_seen_at, push_token')
          .eq('id', childDeviceId)
          .maybeSingle(),
        supabase
          .from('profiles')
          .select('display_name')
          .eq('id', childUserId)
          .maybeSingle(),
        supabase.functions.invoke('get-notifications', {
          body: { child_user_id: childUserId, limit: 50 },
        }),
      ]);

      const device =
        deviceRes.data && !deviceRes.error
          ? (deviceRes.data as PairDataState['childDevice'])
          : null;
      const name =
        profileRes.data && !profileRes.error
          ? ((profileRes.data as any).display_name as string | null)
          : null;
      const notifications =
        !notifRes.error && notifRes.data?.data
          ? (notifRes.data.data as MirroredNotification[])
          : [];

      return { device, name, notifications };
    },
    [],
  );

  const subscribeToChild = useCallback(
    async (childDeviceId: string, childUserId: string, childLabel: string) => {
      const uniqueSuffix = Math.random().toString(36).slice(2);
      const deviceChannel = supabase.channel(`pairdata_device_${childDeviceId}_${uniqueSuffix}`);
      const notifChannel = supabase.channel(`pairdata_notifications_${childUserId}_${uniqueSuffix}`);

      deviceChannel.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'devices',
          filter: `id=eq.${childDeviceId}`,
        },
        (payload) => {
          const updated = payload.new as any;
          setAllChildren((prev) =>
            prev.map((c) =>
              c.childDeviceId === childDeviceId
                ? {
                    ...c,
                    isForeground:
                      'is_foreground' in updated ? !!updated.is_foreground : c.isForeground,
                    lastSeenAt:
                      'last_seen_at' in updated
                        ? (updated.last_seen_at ?? null)
                        : c.lastSeenAt,
                    pushToken:
                      'push_token' in updated ? (updated.push_token ?? null) : c.pushToken,
                    isOnline:
                      ('is_foreground' in updated ? !!updated.is_foreground : c.isForeground) ||
                      (('last_seen_at' in updated
                        ? updated.last_seen_at
                        : c.lastSeenAt) &&
                        Date.now() -
                          new Date(
                            'last_seen_at' in updated
                              ? updated.last_seen_at
                              : (c.lastSeenAt as string),
                          ).getTime() <
                          120000),
                  }
                : c,
            ),
          );
          setState((prev) => {
            if (prev.childDevice?.id !== childDeviceId) return prev;
            return {
              ...prev,
              childDevice: prev.childDevice ? { ...prev.childDevice, ...updated } : prev.childDevice,
            };
          });
        },
      );

      notifChannel.on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'mirrored_notifications',
          filter: `child_user_id=eq.${childUserId}`,
        },
        async (payload) => {
          const notifId = (payload.new as any).id;
          if (!notifId) return;

          const rowChildUserId = (payload.new as any)?.child_user_id ?? childUserId;
          const { data: fetched } = await supabase.functions.invoke('get-notifications', {
            body: { child_user_id: rowChildUserId, ids: [notifId] },
          });

          if (fetched?.data?.length > 0) {
            const newNotif = fetched.data[0] as MirroredNotification;
            setState((prev) => {
              if (newNotif.child_user_id !== childUserId) return prev;
              const exists = prev.notifications.some((n) => n.id === newNotif.id);
              if (exists) return prev;
              return { ...prev, notifications: [newNotif, ...prev.notifications] };
            });
          } else {
            void childLabel;
          }
        },
      );

      await deviceChannel.subscribe();
      await notifChannel.subscribe();
      channelsRef.current.push(deviceChannel, notifChannel);
    },
    [],
  );

  const init = useCallback(
    async (isRefresh = false) => {
      const initId = ++initIdRef.current;

      if (!isParent) {
        setState({
          pair: null,
          currentChildUserId: null,
          childDevice: null,
          childName: null,
          notifications: [],
          isLoading: false,
          isRefreshing: false,
          error: null,
        });
        setAllChildren([]);
        return;
      }

      setState((prev) => ({
        ...prev,
        isLoading: !isRefresh,
        isRefreshing: isRefresh,
        error: null,
      }));

      try {
        await removeAllChannels();

        const children = await loadAllChildren();
        if (cancelledRef.current || initId !== initIdRef.current) return;
        setAllChildren(children);

        if (children.length === 0) {
          setSelectedChildIdInStore(null);
          setState({
            pair: null,
            currentChildUserId: null,
            childDevice: null,
            childName: null,
            notifications: [],
            isLoading: false,
            isRefreshing: false,
            error: null,
          });
          return;
        }

        const auth = useAuthStore.getState();
        const requestedId = auth.selectedChildId;
        const requested = requestedId
          ? children.find((c) => c.childUserId === requestedId)
          : undefined;
        const target =
          requested ?? children[children.length - 1];

        if (!target) return;
        if (requestedId && requestedId !== target.childUserId) {
          setSelectedChildIdInStore(target.childUserId);
        }

        setState((prev) => ({
          ...prev,
          pair: { id: target.pairId, child_device_id: target.childDeviceId },
          currentChildUserId: target.childUserId,
        }));

        const { device, name, notifications } = await loadChildData(
          target.childUserId,
          target.childDeviceId,
        );

        if (cancelledRef.current || initId !== initIdRef.current) return;

        setState((prev) => ({
          ...prev,
          childDevice: device,
          childName: name,
          notifications,
        }));

        await subscribeToChild(target.childDeviceId, target.childUserId, name ?? 'child');
      } catch (err) {
        logger.warn('PairDataProvider: init error:', err);
        setState((prev) => ({
          ...prev,
          error: err instanceof Error ? err.message : 'Failed to load pair data',
        }));
      } finally {
        setState((prev) => ({ ...prev, isLoading: false, isRefreshing: false }));
      }
    },
    [isParent, loadAllChildren, loadChildData, removeAllChannels, setSelectedChildIdInStore, subscribeToChild],
  );

  useEffect(() => {
    cancelledRef.current = false;
    const initIdAtSetup = initIdRef.current;
    init(false);

    return () => {
      cancelledRef.current = true;
      initIdRef.current = initIdAtSetup + 1;
      removeAllChannels();
    };
  }, [deviceId, userRole, init, removeAllChannels]);

  // Parents: subscribe to realtime changes on the `pairs` table filtered by
  // this parent device. Any INSERT / UPDATE / DELETE triggers a soft refresh
  // so newly paired children appear immediately, and revocations are picked
  // up even if the device-side guard missed the event.
  useEffect(() => {
    if (!isParent) return;
    if (!deviceId) return;

    const channel = supabase
      .channel(`pairdata_pairs_${deviceId}_${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'pairs',
          filter: `parent_device_id=eq.${deviceId}`,
        },
        () => {
          // Any change to the parent's pair list means we should re-resolve
          // children and current selection. Use init(true) so isRefreshing
          // stays true briefly but existing notifications aren't cleared.
          init(true);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel).catch(() => undefined);
    };
  }, [isParent, deviceId, init]);

  const pairRevokedAt = useAuthStore((s) => s.pairRevokedAt);
  const prevPairRevokedAt = useRef<number | null>(null);
  useEffect(() => {
    if (pairRevokedAt && pairRevokedAt !== prevPairRevokedAt.current) {
      prevPairRevokedAt.current = pairRevokedAt;
      init(true);
    }
  }, [pairRevokedAt, init]);

  const refresh = useCallback(async () => {
    await init(true);
  }, [init]);

  const effectiveSelectedId = useMemo(() => {
    if (!selectedChildIdFromStore) return null;
    const hit = allChildren.find((c) => c.childUserId === selectedChildIdFromStore);
    return hit ? hit.childUserId : null;
  }, [selectedChildIdFromStore, allChildren]);

  useEffect(() => {
    if (
      effectiveSelectedId &&
      effectiveSelectedId !== state.currentChildUserId &&
      !state.isLoading
    ) {
      init(true);
    }
  }, [effectiveSelectedId, state.currentChildUserId, state.isLoading, init]);

  const [, forceUpdate] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => forceUpdate((n) => n + 1), 30000);
    return () => clearInterval(interval);
  }, []);

  const value = useMemo(() => {
    const childDevice = state.childDevice;
    const isOnline = computeIsOnline(childDevice);
    const notifications = state.notifications;
    const latestNotification = notifications.length > 0 ? notifications[0] : null;

    return {
      ...state,
      latestNotification,
      isOnline,
      allChildren,
      refresh,
    };
  }, [state, allChildren, refresh]);

  return (
    <PairDataContext.Provider value={value}>
      {children}
    </PairDataContext.Provider>
  );
}

export function usePairDataContext(): PairDataContextValue {
  const ctx = useContext(PairDataContext);
  if (!ctx) {
    throw new Error('usePairDataContext must be used within PairDataProvider');
  }
  return ctx;
}
