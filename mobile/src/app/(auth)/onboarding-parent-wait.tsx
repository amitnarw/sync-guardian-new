import React, { useEffect, useState, useRef } from 'react';
import { StyleSheet, View, Text, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { AuthColors } from '@/constants/auth-theme';
import { SyncAnimation } from '@/components/ui/sync-animation';
import { useAuthStore } from '@/hooks/use-auth-store';

export default function OnboardingParentWait() {
  const { pairId, userId } = useAuthStore();
  const [childName, setChildName] = useState('your child');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigated = useRef(false);

  useEffect(() => {
    if (!pairId) {
      setError('Pairing information is missing. Please restart pairing.');
      setLoading(false);
      return;
    }

    let cancelled = false;
    let pollInterval: ReturnType<typeof setInterval>;
    let channel: ReturnType<typeof supabase.channel>;

    (async () => {
      try {
        const { data: pair, error: pairErr } = await supabase
          .from('pairs')
          .select('child_device_id, child_user_id')
          .eq('id', pairId)
          .maybeSingle();

        if (cancelled) return;

        if (pairErr || !pair?.child_device_id) {
          setError('Could not find the linked child device. Please restart pairing.');
          setLoading(false);
          return;
        }

        const { data: profile } = await supabase
          .from('profiles')
          .select('display_name')
          .eq('id', pair.child_user_id)
          .maybeSingle();
        if (!cancelled && profile?.display_name) {
          setChildName(profile.display_name);
        }

        const childDeviceId = pair.child_device_id;

        const check = async () => {
          if (navigated.current) return;
          const { count } = await supabase
            .from('child_app_filters')
            .select('*', { count: 'exact', head: true })
            .eq('child_device_id', childDeviceId);
          if (navigated.current) return;
          if ((count ?? 0) > 0) {
            navigated.current = true;
            router.replace('/app-filters');
          }
        };

        check();

        pollInterval = setInterval(check, 3000);

        channel = supabase
          .channel(`parent_app_wait_${userId}_${Math.random().toString(36).slice(2)}`)
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'child_app_filters',
              filter: `child_device_id=eq.${childDeviceId}`,
            },
            () => check(),
          )
          .subscribe();

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
    };
  }, [pairId, userId]);

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
        ) : (
          <>
            <SyncAnimation />
            <Text style={s.title}>Waiting for {childName}&apos;s apps</Text>
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
  },
  text: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 16,
    lineHeight: 24,
    color: AuthColors.onSurfaceVariant,
    textAlign: 'center',
    maxWidth: 320,
  },
});
