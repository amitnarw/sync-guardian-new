import React, { useEffect, useState, useRef } from 'react';
import { StyleSheet, View, Text, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { isValidUUID } from '@/lib/uuid';
import { AuthColors } from '@/constants/auth-theme';
import { SyncAnimation } from '@/components/ui/sync-animation';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/hooks/use-auth-store';
import { logger } from '@/services/logger';

const TIMEOUT_MS = 30_000;

interface PairRow {
  child_device_id: string | null;
  child_user_id: string | null;
  child_inventory_synced_at: string | null;
  child_monitorable_app_count: number | null;
}

export default function OnboardingParentWait() {
  const { pairId, userId } = useAuthStore();
  const [childName, setChildName] = useState('your child');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inventorySynced, setInventorySynced] = useState(false);
  const [hasMonitorableApps, setHasMonitorableApps] = useState(true);
  const [timedOut, setTimedOut] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [childDeviceId, setChildDeviceId] = useState<string | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);
  const navigated = useRef(false);

  useEffect(() => {
    const t = setInterval(() => setElapsedSec((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const formatElapsed = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    if (!isValidUUID(pairId)) {
      setError('Pairing information is missing. Please restart pairing.');
      setLoading(false);
      return;
    }

    let cancelled = false;
    let pollInterval: ReturnType<typeof setInterval>;
    let channel: ReturnType<typeof supabase.channel>;
    let timeoutTimer: ReturnType<typeof setTimeout>;

    const fetchPair = async () => {
      const { data: pair, error: pairErr } = await supabase
        .from('pairs')
        .select(
          'child_device_id, child_user_id, child_inventory_synced_at, child_monitorable_app_count',
        )
        .eq('id', pairId)
        .maybeSingle();

      if (cancelled) return;
      if (pairErr || !pair) return;
      return pair as PairRow;
    };

    const check = async () => {
      if (navigated.current) return;
      const pair = await fetchPair();
      if (cancelled || navigated.current) return;
      if (!pair?.child_device_id) return;

      setChildDeviceId(pair.child_device_id);

      if (!pair.child_inventory_synced_at) return;

      setInventorySynced(true);
      setHasMonitorableApps((pair.child_monitorable_app_count ?? 0) > 0);
      setLoading(false);
      setTimedOut(false);

      if ((pair.child_monitorable_app_count ?? 0) > 0) {
        navigated.current = true;
        router.replace('/app-filters');
      }
    };

    (async () => {
      try {
        const pair = await fetchPair();
        if (cancelled) return;

        if (!pair?.child_device_id) {
          setError('Could not find the linked child device. Please restart pairing.');
          setLoading(false);
          return;
        }

        setChildDeviceId(pair.child_device_id);

        if (pair.child_user_id) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('display_name')
            .eq('id', pair.child_user_id)
            .maybeSingle();
          if (!cancelled && profile?.display_name) {
            setChildName(profile.display_name);
          }
        }

        check();

        pollInterval = setInterval(check, 3000);

        channel = supabase
          .channel(`parent_app_wait_${userId}_${Math.random().toString(36).slice(2)}`)
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'pairs',
              filter: `id=eq.${pairId}`,
            },
            () => check(),
          )
          .subscribe();

        timeoutTimer = setTimeout(() => {
          if (!cancelled && !inventorySynced && !navigated.current) {
            setTimedOut(true);
            setLoading(false);
          }
        }, TIMEOUT_MS);

        if (!cancelled) setLoading(false);
      } catch {
        if (!cancelled) {
          setError('Something went wrong. Please restart pairing.');
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      if (pollInterval) clearInterval(pollInterval);
      if (channel) supabase.removeChannel(channel);
      if (timeoutTimer) clearTimeout(timeoutTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pairId, userId]);

  const skipAppSelection = async () => {
    if (!childDeviceId) return;
    setSubmitting(true);
    try {
      const { error: saveErr } = await supabase.functions.invoke('update-app-filters', {
        body: {
          pair_id: pairId ?? undefined,
          child_device_id: childDeviceId,
          changes: [],
        },
      });
      if (saveErr) throw saveErr;
      navigated.current = true;
      router.replace('/onboarding');
    } catch (e) {
      logger.error('OnboardingParentWait: skip failed', e instanceof Error ? e.message : '');
      setError('Could not finish setup. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={s.safeArea} edges={['top']}>
      <View style={s.header}>
        <MaterialCommunityIcons name="spa" size={24} color={AuthColors.primary} style={s.headerIcon} />
        <Text style={s.headerTitle}>Sync Guardian</Text>
      </View>
      <View style={s.body}>
        {loading ? (
          <ActivityIndicator color={AuthColors.primary} size="large" />
        ) : error ? (
          <>
            <Text style={s.title}>Something went wrong</Text>
            <Text style={s.text}>{error}</Text>
          </>
        ) : inventorySynced && !hasMonitorableApps ? (
          <>
            <SyncAnimation />
            <Text style={s.title}>No apps found on {childName}&apos;s device</Text>
            <Text style={s.text}>
              We couldn&apos;t find any monitorable apps installed on {childName}&apos;s device. You
              can still finish setup now and adjust app choices later in Settings.
            </Text>
            <View style={s.actions}>
              <Button
                title="Continue without selecting apps"
                onPress={skipAppSelection}
                loading={submitting}
              />
            </View>
          </>
        ) : timedOut ? (
          <>
            <SyncAnimation />
            <Text style={s.title}>Still waiting for {childName}&apos;s apps</Text>
            <Text style={s.timerText}>{formatElapsed(elapsedSec)} elapsed</Text>
            <Text style={s.text}>
              {childName}&apos;s device hasn&apos;t reported its apps yet. If it&apos;s stuck, you can
              continue without selecting apps and adjust choices later.
            </Text>
            <View style={s.actions}>
              <Button
                title="Continue anyway"
                onPress={skipAppSelection}
                loading={submitting}
              />
            </View>
          </>
        ) : (
          <>
            <SyncAnimation />
            <Text style={s.title}>Waiting for {childName}&apos;s apps</Text>
            <Text style={s.timerText}>{formatElapsed(elapsedSec)} elapsed</Text>
            <Text style={s.text}>
              We&apos;re fetching the list of apps from {childName}&apos;s device. This opens automatically once
              it&apos;s ready.
            </Text>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: AuthColors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 0,
    backgroundColor: AuthColors.surface,
  },
  headerIcon: { marginRight: 2 },
  headerTitle: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 18,
    color: AuthColors.primary,
    letterSpacing: -0.5,
  },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  title: {
    fontFamily: 'PlusJakartaSans-ExtraBold',
    fontSize: 28,
    color: AuthColors.onSurface,
    marginBottom: 12,
    textAlign: 'center',
  },
  text: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 16,
    lineHeight: 24,
    color: AuthColors.onSurfaceVariant,
    textAlign: 'center',
    maxWidth: 320,
  },
  timerText: {
    fontFamily: 'Manrope-SemiBold',
    fontSize: 14,
    color: AuthColors.onSurfaceVariant,
    textAlign: 'center',
    marginBottom: 8,
    opacity: 0.7,
  },
  actions: {
    marginTop: 24,
    width: '100%',
    maxWidth: 320,
  },
});
