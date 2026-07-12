import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { AuthColors } from '@/constants/auth-theme';
import { SyncAnimation } from '@/components/ui/sync-animation';
import { getOnboardingState } from '@/services/onboarding-api';
import { useAuthStore } from '@/hooks/use-auth-store';

/**
 * Shown to a child device while it is in the `app_selection` onboarding step
 * (i.e. the parent hasn't finished choosing apps yet). The child has already
 * granted permissions; it just waits here until the parent completes setup.
 * When the parent saves, the DB marks onboarding completed and we advance.
 */
export default function OnboardingChildWait() {
  const userId = useAuthStore((state) => state.userId);
  const [parentName, setParentName] = useState('your parent');

  useEffect(() => {
    (async () => {
      const { data: pair } = await supabase
        .from('pairs')
        .select('parent_user_id')
        .eq('child_user_id', userId)
        .maybeSingle();
      if (pair?.parent_user_id) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('display_name')
          .eq('id', pair.parent_user_id)
          .maybeSingle();
        const name = (profile as any)?.display_name;
        if (name) setParentName(name);
      }
    })();
  }, [userId]);

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      const state = await getOnboardingState();
      if (!cancelled && state.onboarding_completed) {
        router.replace('/(child)/home');
      }
    };

    check();

    const channel = supabase
      .channel(`onboarding_wait_${userId}_${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'user_onboarding_state',
          filter: `user_id=eq.${userId}`,
        },
        () => check(),
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [userId]);

  return (
    <SafeAreaView style={s.safeArea} edges={['top']}>
      <View style={s.header}>
        <MaterialCommunityIcons name="spa" size={24} color={AuthColors.primary} style={s.headerIcon} />
        <Text style={s.headerTitle}>Sync Guardian</Text>
      </View>
      <View style={s.body}>
        <SyncAnimation />
        <Text style={s.title}>Almost there</Text>
        <Text style={s.text}>
          {parentName} is choosing which apps to monitor. Your dashboard will appear as soon as they finish setup.
        </Text>
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
