import React, { createContext, useContext, useEffect, useState, useCallback, useRef, useMemo } from 'react';
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
  app_icon_base64: string | null;
}

interface PairDataState {
  pair: { id: string; child_device_id: string } | null;
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

export function PairDataProvider({ children }: { children: React.ReactNode }) {
  const { deviceId, pairId: storePairId, userRole } = useAuthStore();
  const isParent = userRole === 'parent';

  const [state, setState] = useState<PairDataState>({
    pair: null,
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

  const init = useCallback(async (isRefresh = false) => {
    const initId = ++initIdRef.current;

    if (!isParent) {
      setState({
        pair: null,
        childDevice: null,
        childName: null,
        notifications: [],
        isLoading: false,
        isRefreshing: false,
        error: null,
      });
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

      const auth = useAuthStore.getState();
      const dId = auth.deviceId;
      const sPId = auth.pairId;

      let resolvedPair: { id: string; child_device_id: string; child_user_id: string } | null = null;

      if (sPId && dId) {
        const { data, error: pairError } = await supabase
          .from('pairs')
          .select('id, child_device_id, child_user_id')
          .eq('id', sPId)
          .in('status', ['active', 'pending'])
          .single();
        if (!pairError && data) {
          resolvedPair = data;
        }
      }

      if (!resolvedPair && dId) {
        const { data, error: pairError } = await supabase
          .from('pairs')
          .select('id, child_device_id, child_user_id')
          .eq('parent_device_id', dId)
          .in('status', ['active', 'pending'])
          .limit(1);
        if (!pairError && data && data.length > 0) {
          resolvedPair = data[0];
        }
      }

      if (cancelledRef.current || initId !== initIdRef.current) return;

      if (!resolvedPair) {
        setState({
          pair: null,
          childDevice: null,
          childName: null,
          notifications: [],
          isLoading: false,
          isRefreshing: false,
          error: null,
        });
        return;
      }

      setState((prev) => ({ ...prev, pair: resolvedPair }));

      const { data: devData, error: devError } = await supabase
        .from('devices')
        .select('id, is_foreground, last_seen_at, push_token')
        .eq('id', resolvedPair.child_device_id)
        .single();

      if (cancelledRef.current || initId !== initIdRef.current) return;

      if (devData) {
        setState((prev) => ({ ...prev, childDevice: devData as any }));
      } else if (devError) {
        logger.warn('PairDataProvider: child device query error:', devError);
      }

      // Child's display name comes from their profile (sourced from auth.users),
      // not from a device column. The parent is permitted to read it via RLS.
      const { data: childProfile } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('id', resolvedPair.child_user_id)
        .maybeSingle();

      if (cancelledRef.current || initId !== initIdRef.current) return;

      if (childProfile) {
        setState((prev) => ({ ...prev, childName: (childProfile as any).display_name ?? null }));
      }

      const { data: notifData, error: notifError } = await supabase.functions.invoke(
        'get-notifications',
        { body: { pair_id: resolvedPair.id, limit: 50 } },
      )

      if (cancelledRef.current || initId !== initIdRef.current) return;

      if (notifData?.data) {
        setState((prev) => ({ ...prev, notifications: notifData.data as MirroredNotification[] }));
      } else if (notifError) {
        logger.warn('PairDataProvider: notifications query error:', notifError);
      }

      if (cancelledRef.current || initId !== initIdRef.current) return;

      const uniqueSuffix = Math.random().toString(36).slice(2);
      const deviceChannel = supabase.channel(`pairdata_device_${resolvedPair.child_device_id}_${uniqueSuffix}`);
      const notifChannel = supabase.channel(`pairdata_notifications_${resolvedPair.id}_${uniqueSuffix}`);

      deviceChannel.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'devices',
          filter: `id=eq.${resolvedPair.child_device_id}`,
        },
        (payload) => {
          const updated = payload.new as any;
          setState((prev) => ({
            ...prev,
            childDevice: prev.childDevice ? { ...prev.childDevice, ...updated } : prev.childDevice,
          }));
        },
      );

      notifChannel.on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'mirrored_notifications',
          filter: `pair_id=eq.${resolvedPair.id}`,
        },
        async (payload) => {
          const notifId = (payload.new as any).id;
          if (!notifId) return;

          const { data: fetched } = await supabase.functions.invoke(
            'get-notifications',
            { body: { ids: [notifId] } },
          );

          if (fetched?.data?.length > 0) {
            const newNotif = fetched.data[0] as MirroredNotification;
            setState((prev) => {
              const exists = prev.notifications.some((n) => n.id === newNotif.id);
              if (exists) return prev;
              return { ...prev, notifications: [newNotif, ...prev.notifications] };
            });
          }
        },
      );

      // Pair revocation is handled by usePairStatusGuard, so we deliberately do
      // not subscribe to `pairs` here. This avoids channel-name collisions and
      // re-subscribing callbacks after subscribe() (the source of the warning).

      if (cancelledRef.current || initId !== initIdRef.current) return;

      await deviceChannel.subscribe();
      await notifChannel.subscribe();

      channelsRef.current = [deviceChannel, notifChannel];
    } catch (err) {
      logger.warn('PairDataProvider: init error:', err);
      setState((prev) => ({
        ...prev,
        error: err instanceof Error ? err.message : 'Failed to load pair data',
      }));
    } finally {
      setState((prev) => ({ ...prev, isLoading: false, isRefreshing: false }));
    }
  }, [isParent, removeAllChannels]);

  useEffect(() => {
    cancelledRef.current = false;
    init(false);

    return () => {
      cancelledRef.current = true;
      ++initIdRef.current;
      removeAllChannels();
    };
  }, [deviceId, storePairId, isParent, init, removeAllChannels]);

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

    return { ...state, latestNotification, isOnline, refresh };
  }, [state, refresh]);

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
