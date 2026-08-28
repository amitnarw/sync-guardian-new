import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { StyleSheet, View, Dimensions, Text, BackHandler, RefreshControl, Platform } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, withSequence } from 'react-native-reanimated';
import { SymbolView } from 'expo-symbols';
import { BlurView, BlurTargetView } from 'expo-blur';
import { ThemedView } from '@/components/themed-view';
import { EdgeFadeScrollView } from '@/components/ui/edge-fade';
import { useAuthStore } from '@/hooks/use-auth-store';
import { useAppModal } from '@/hooks/use-app-modal';
import { useSubscriptionStore } from '@/hooks/use-subscription-store';
import { SyncAnimation } from '@/components/ui/sync-animation';
import { supabase } from '@/lib/supabase';
import { isValidUUID } from '@/lib/uuid';
import { logger } from '@/services/logger';
import { usePermissionStatus } from '@/hooks/use-permission-status';


const { width: SCREEN_W } = Dimensions.get('window');

// ============================================================
// EXACT STITCH COLORS (from v1 + v2 HTML Tailwind config)
// ============================================================
const C = {
  primary: '#44674d',
  primaryContainer: '#c5eccc',
  onPrimary: '#e8ffea',
  secondary: '#a0412d',
  secondaryContainer: '#ffdad3',
  onSecondary: '#fff7f6',
  tertiary: '#44674e',
  tertiaryContainer: '#d3fbda',
  surface: '#fff8f0',
  surfaceBright: '#fff8f0',
  surfaceContainer: '#f5ede0',
  surfaceContainerLow: '#faf3e7',
  surfaceContainerHigh: '#efe7da',
  surfaceContainerHighest: '#eae1d2',
  surfaceContainerLowest: '#ffffff',
  surfaceVariant: '#eae1d2',
  onSurface: '#363228',
  onSurfaceVariant: '#645e53',
  outline: '#807a6d',
  outlineVariant: '#b9b1a3',
  error: '#a83836',
  white: '#ffffff',
} as const;

export default function ChildHome() {
  const { pairId, deviceId } = useAuthStore();
  const { showModal } = useAppModal();
  const [pairStatus, setPairStatus] = useState<'active' | 'pending' | 'revoked' | 'missing' | 'loading'>('loading');
  const [parentName, setParentName] = useState('Parent Device');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [setupCompleted, setSetupCompleted] = useState<boolean | null>(null);
  // Parent-managed access state (server-derived; children never see
  // billing UI — only a gentle paused indicator on their dashboard).
  const subHasAccess = useSubscriptionStore((s) => s.hasAccess);
  const subError = useSubscriptionStore((s) => s.error);
  const [accessChecked, setAccessChecked] = useState(false);
  const permissions = usePermissionStatus('child');
  const { items: permissionItems } = permissions;
  const criticalPermissions = useMemo(
    () => Platform.OS === 'android'
      ? permissionItems.filter(p => (p.key === 'notif_listener' || p.key === 'battery_opt') && !p.granted)
      : [],
    [permissionItems],
  );

  // True only once the server has confirmed the paired parent's access has
  // lapsed — never shown while loading or on transient errors.
  const accessLapsed =
    pairStatus === 'active' &&
    setupCompleted === true &&
    accessChecked &&
    !subError &&
    subHasAccess === false;

  const fetchPairState = useCallback(async () => {
    if (!isValidUUID(pairId)) {
      setPairStatus('missing');
      return;
    }

    const { data: pair, error } = await supabase
      .from('pairs')
      .select('parent_user_id, status, parent_setup_completed')
      .eq('id', pairId)
      .single();

    if (error || !pair) {
      if (error && error.code === 'PGRST116') {
        setPairStatus('missing');
      } else {
        logger.warn('fetchPairState: error', error?.message);
        setPairStatus('loading');
      }
      return;
    }

    setPairStatus(pair.status as 'active' | 'pending' | 'revoked');
    setSetupCompleted(!!pair.parent_setup_completed);

    if (pair.parent_user_id) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('id', pair.parent_user_id)
        .maybeSingle();
      if (profile) {
        setParentName((profile as any).display_name || 'Parent Device');
      }
    }
  }, [pairId]);

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await fetchPairState();
      await useSubscriptionStore.getState().refresh();
      setAccessChecked(true);
    } finally {
      setIsRefreshing(false);
    }
  }, [fetchPairState]);

  // Mirror the paired parent's access state so the dashboard can show a
  // paused indicator when the parent's trial/subscription has lapsed.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      await useSubscriptionStore.getState().refresh();
      if (!cancelled) setAccessChecked(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const isFocused = useIsFocused();
  useEffect(() => {
    if (!isFocused) return;

    const backAction = () => {
      if (router.canGoBack()) {
        router.back();
        return true;
      }
      showModal({
        title: 'Exit App',
        message: 'Are you sure you want to exit?',
        icon: 'warning',
        primaryButton: 'Exit',
        onPrimaryPress: () => BackHandler.exitApp(),
        secondaryButton: 'Cancel',
      });
      return true;
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => backHandler.remove();
  }, [isFocused, showModal]);

  // Fetch pair state + subscribe to all changes on this pair row
  useEffect(() => {
    if (!isValidUUID(pairId)) {
      setPairStatus('missing');
      return;
    }
    let cancelled = false;

    fetchPairState();

    const channel = supabase
      .channel(`child_home_${pairId}_${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'pairs',
          filter: `id=eq.${pairId}`,
        },
        (payload) => {
          if (cancelled) return;
          const newStatus = (payload.new as any)?.status;
          const completed = (payload.new as any)?.parent_setup_completed;
          if (newStatus) setPairStatus(newStatus as 'active' | 'pending' | 'revoked');
          if (typeof completed === 'boolean') setSetupCompleted(completed);
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [pairId, fetchPairState]);

  // Best-effort: keep the parent's app filter list in sync with the apps
  // currently installed on this child device (covers pairs created before
  // the app-selection feature existed).
  useEffect(() => {
    if (!deviceId) return;
    (async () => {
      try {
        const { syncInstalledApps } = await import('@/services/installed-apps-sync');
        await syncInstalledApps(deviceId);
      } catch {
        // Non-fatal: ingestion already drops notifications for unknown apps.
      }
    })();
  }, [deviceId]);

  // Redirect to the blocking /permissions onboarding step when critical
  // Android permissions are missing, so the child can't reach the dashboard
  // until all permissions are granted.
  useEffect(() => {
    if (pairStatus === 'active' && setupCompleted && criticalPermissions.length > 0) {
      router.replace('/permissions');
    }
  }, [pairStatus, setupCompleted, criticalPermissions]);

  const blurTargetRef = React.useRef<View>(null);
  
  // Animation Values
  const scale = useSharedValue(1);
  const topLeft = useSharedValue(110);
  const topRight = useSharedValue(130);
  const bottomLeft = useSharedValue(90);
  const bottomRight = useSharedValue(140);
  const rotation = useSharedValue(0);

  useEffect(() => {
    // Smooth pulsing scale animation
    scale.value = withRepeat(
      withSequence(
        withTiming(1.03, { duration: 4000 }),
        withTiming(0.97, { duration: 4000 })
      ),
      -1,
      true
    );

    // Smooth fluid morphing border radiuses with staggered durations for organic shapes
    topLeft.value = withRepeat(
      withSequence(
        withTiming(150, { duration: 3800 }),
        withTiming(65, { duration: 4500 }),
        withTiming(110, { duration: 4000 })
      ),
      -1,
      true
    );

    topRight.value = withRepeat(
      withSequence(
        withTiming(80, { duration: 4200 }),
        withTiming(160, { duration: 3600 }),
        withTiming(130, { duration: 4000 })
      ),
      -1,
      true
    );

    bottomLeft.value = withRepeat(
      withSequence(
        withTiming(140, { duration: 4000 }),
        withTiming(60, { duration: 4800 }),
        withTiming(90, { duration: 4200 })
      ),
      -1,
      true
    );

    bottomRight.value = withRepeat(
      withSequence(
        withTiming(75, { duration: 3700 }),
        withTiming(160, { duration: 4400 }),
        withTiming(140, { duration: 4600 })
      ),
      -1,
      true
    );

    // Smooth fluid rotation (slower)
    rotation.value = withRepeat(
      withSequence(
        withTiming(10, { duration: 8000 }),
        withTiming(-10, { duration: 8000 })
      ),
      -1,
      true
    );
  }, [bottomLeft, bottomRight, rotation, scale, topLeft, topRight]);

  const animatedBlobStyle = useAnimatedStyle(() => {
    return {
      borderTopLeftRadius: topLeft.value,
      borderTopRightRadius: topRight.value,
      borderBottomLeftRadius: bottomLeft.value,
      borderBottomRightRadius: bottomRight.value,
      transform: [
        { scale: scale.value },
        { rotate: `${rotation.value}deg` }
      ],
    };
  });

  const animatedInnerStyle = useAnimatedStyle(() => {
    return {
      borderTopLeftRadius: topLeft.value * 0.5,
      borderTopRightRadius: topRight.value * 0.5,
      borderBottomLeftRadius: bottomLeft.value * 0.5,
      borderBottomRightRadius: bottomRight.value * 0.5,
      transform: [
        { scale: scale.value },
        { rotate: `${-rotation.value}deg` }
      ],
    };
  });

  if (pairStatus === 'loading') {
    return (
      <ThemedView style={s.container}>
        <View style={s.waitingBody}>
          <SyncAnimation />
          <BlurView intensity={80} tint="light" style={s.loadingCard}>
            <Text style={s.loadingTitle}>Verifying guardian link</Text>
            <Text style={s.loadingDesc}>Confirming your secure connection…</Text>
          </BlurView>
        </View>
      </ThemedView>
    );
  }

  if (pairStatus === 'missing' || pairStatus === 'revoked') {
    // The pair-status guard redirects to /pairing shortly; show a calm
    // placeholder instead of a blank screen in the meantime.
    return (
      <ThemedView style={s.container}>
        <View style={s.waitingBody}>
          <SyncAnimation />
          <Text style={s.waitingTitle}>Not connected</Text>
          <Text style={s.waitingText}>
            You&apos;re not linked to a guardian device right now. Ask your parent to send you a
            new connection invite.
          </Text>
        </View>
      </ThemedView>
    );
  }

  if (pairStatus === 'pending' || (pairStatus === 'active' && !setupCompleted)) {
    return (
      <ThemedView style={s.container}>
          <View style={s.waitingBody}>
            <SyncAnimation />
            <Text style={s.waitingTitle}>Almost there</Text>
            <Text style={s.waitingText}>
              {pairStatus === 'pending'
                ? 'Waiting for your parent to confirm the connection. Ask them to open Sync Guardian and complete the pairing process.'
                : parentName === 'Parent Device'
                  ? 'Your dashboard will appear as soon as your parent finishes setup. Hand them this phone, or ask them to open Sync Guardian and choose which apps to monitor.'
                  : `${parentName} is choosing which apps to monitor. Your dashboard will appear as soon as they finish setup.`}
            </Text>
          </View>
      </ThemedView>
    );
  }

  if (criticalPermissions.length > 0) {
    // Redirect to /permissions runs in the effect above; show progress
    // instead of a blank screen during that transition.
    return (
      <ThemedView style={s.container}>
        <View style={s.waitingBody}>
          <SyncAnimation />
          <BlurView intensity={80} tint="light" style={s.loadingCard}>
            <Text style={s.loadingTitle}>Almost there</Text>
            <Text style={s.loadingDesc}>
              One moment — finishing your setup…
            </Text>
          </BlurView>
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={s.container}>
      <BlurTargetView ref={blurTargetRef} style={{ flex: 1 }}>
          <EdgeFadeScrollView
            contentContainerStyle={s.scrollContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} colors={[C.primary]} tintColor={C.primary} />
            }
          >
            {/* ========== HERO SECTION ========== */}
            <View style={s.heroSection}>
              {/* Text block */}
              <View style={s.heroTextBlock}>
                <Text style={s.flowLabel}>
                  {accessLapsed ? 'ATTENTION NEEDED' : 'SYSTEM SECURED'}
                </Text>
                <Text style={s.heroTitle}>
                  Sync Guardian is{'\n'}
                  <Text style={accessLapsed ? s.heroTitlePaused : s.heroTitleAccent}>
                    {accessLapsed ? 'Paused' : 'Active'}
                  </Text>
                </Text>
                <Text style={s.heroDescription}>
                  {accessLapsed
                    ? 'Your parent\u2019s Sync Guardian plan has ended. Monitoring is paused and will resume automatically once they renew.'
                    : 'Sync Guardian is running quietly in the background, maintaining a safe and focused environment.'}
                </Text>
              </View>

              {/* Visual block */}
              <View style={s.visualBlock}>
                {/* Decorative blurred blob behind hearth */}
                <View style={s.decoBlobBehind} />

                {/* Hearth Blob Container (clipping wrapper) */}
                <Animated.View
                  style={[s.hearthBlob, animatedBlobStyle]}
                >
                  <LinearGradient
                    colors={[C.primary, C.primaryContainer]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={StyleSheet.absoluteFill}
                  />
                  <Animated.View style={[s.hearthInner, animatedInnerStyle]}>
                    <SymbolView
                      name={"shield_with_heart" as any}
                      size={64}
                      type="monochrome"
                      tintColor="#ffffff"
                    />
                  </Animated.View>
                </Animated.View>

                {/* Floating Timer Card */}
                <View style={s.timerCardContainer}>
                  <BlurView
                    intensity={80}
                    tint="light"
                    style={s.timerCard}
                  >
                    <View style={s.timerHeader}>
                      <Ionicons
                        name={accessLapsed ? 'alert-circle' : 'checkmark-circle'}
                        size={20}
                        color={C.secondary}
                      />
                      <Text style={s.timerText}>
                        {accessLapsed ? 'Protection Paused' : 'Protection Enabled'}
                      </Text>
                    </View>
                  </BlurView>
                </View>
              </View>
            </View>

            {/* ========== BENTO GRID SECTION ========== */}
            <View style={s.bentoGrid}>
              
              {/* Card 1: Connection Info (Full Width) */}
              <View style={[s.bentoCard, s.cardConnection]}>
                <View style={[s.iconWrapper, { backgroundColor: C.primaryContainer }]}>
                  <Ionicons name="link" size={24} color={C.primary} />
                </View>
                <View style={s.cardTextWrapper}>
                  <Text style={s.cardTitle}>Guardian Connected</Text>
                  <Text style={s.cardDesc}>Securely linked to {parentName}.</Text>
                </View>
                {/* Background blob */}
                <View style={s.cardBlobConnection} />
              </View>

              {/* Card 2: Today's Activity (Half Width) */}
              <View style={[s.bentoCard, s.cardRhythm, s.halfWidth]}>
                <View style={[s.iconWrapper, { backgroundColor: C.surfaceVariant }]}>
                  <Ionicons name="leaf-outline" size={24} color={C.onSurfaceVariant} />
                </View>
                <Text style={s.cardTitle}>Today&apos;s Activity</Text>
                <Text style={s.cardDesc}>Updates appear as they happen.</Text>
              </View>

              {/* Card 3: Privacy (Half Width) */}
              <View style={[s.bentoCard, s.cardPrivacy, s.halfWidth]}>
                <View style={[s.iconWrapper, { backgroundColor: C.tertiaryContainer }]}>
                  <Ionicons name="lock-closed-outline" size={24} color={C.tertiary} />
                </View>
                <Text style={s.cardTitle}>Data Privacy</Text>
                <Text style={s.cardDesc}>Locally encrypted.</Text>
                {/* Background blob */}
                <View style={s.cardBlobPrivacy} />
              </View>
            </View>

            <View style={s.bottomSpacer} />
          </EdgeFadeScrollView>
      </BlurTargetView>
    </ThemedView>
  );
}

// ============================================================
// STYLES
// ============================================================
const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.surface,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 8,
  },


  /* ---------- Hero Section ---------- */
  heroSection: {
    marginBottom: 48,
    gap: 24,
  },
  heroTextBlock: {
    gap: 16,
  },
  flowLabel: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 12,
    letterSpacing: 2.5,
    color: C.secondary,
    textTransform: 'uppercase',
  },
  heroTitle: {
    fontFamily: 'PlusJakartaSans-ExtraBold',
    fontSize: 40,
    lineHeight: 48,
    color: C.onSurface,
    letterSpacing: -1,
  },
  heroTitleAccent: {
    fontFamily: 'PlusJakartaSans-ExtraBoldItalic',
    fontSize: 40,
    lineHeight: 48,
    color: C.primary,
    letterSpacing: -1,
  },
  heroTitlePaused: {
    fontFamily: 'PlusJakartaSans-ExtraBoldItalic',
    fontSize: 40,
    lineHeight: 48,
    color: C.secondary,
    letterSpacing: -1,
  },
  heroDescription: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 16,
    lineHeight: 24,
    color: C.onSurfaceVariant,
    maxWidth: 320,
  },

  /* Visual block */
  visualBlock: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginTop: 16,
    height: 340,
  },
  decoBlobBehind: {
    position: 'absolute',
    top: -24,
    left: -32,
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(160,65,45,0.10)',
    zIndex: 0,
  },
  hearthBlob: {
    width: 288,
    height: 288,
    borderTopLeftRadius: 144,
    borderTopRightRadius: 144,
    borderBottomLeftRadius: 144,
    borderBottomRightRadius: 144,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
    overflow: 'hidden',
  },
  hearthInner: {
    width: 144,
    height: 144,
    borderRadius: 72,
    backgroundColor: 'rgba(255,255,255,0.20)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.30)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Timer card */
  timerCardContainer: {
    position: 'absolute',
    bottom: 20,
    left: -12,
    zIndex: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.72)',
    borderRadius: 32,
    shadowColor: '#363228',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8,
  },
  timerCard: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 32,
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  timerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timerText: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 14,
    color: C.onSurface,
  },

  /* ---------- Bento Grid ---------- */
  bentoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 32,
  },
  bentoCard: {
    backgroundColor: C.surfaceContainerLowest,
    borderRadius: 24,
    padding: 20,
    position: 'relative',
    overflow: 'hidden',
    shadowColor: '#363228',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.02,
    shadowRadius: 24,
    elevation: 1,
  },
  halfWidth: {
    width: (SCREEN_W - 64) / 2,
  },
  cardConnection: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 24,
  },
  cardRhythm: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 28,
  },
  cardPrivacy: {
    borderRadius: 28,
  },
  iconWrapper: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTextWrapper: {
    flex: 1,
    marginLeft: 16,
    justifyContent: 'center',
  },
  cardTitle: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 16,
    lineHeight: 22,
    color: C.onSurface,
    marginBottom: 4,
  },
  cardDesc: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 13,
    lineHeight: 18,
    color: C.onSurfaceVariant,
  },
  cardBlobConnection: {
    position: 'absolute',
    top: -24,
    right: -24,
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(68,103,77,0.06)',
  },
  cardBlobPrivacy: {
    position: 'absolute',
    bottom: -24,
    right: -24,
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(197,236,204,0.15)',
  },

  bottomSpacer: {
    height: 130,
  },

  waitingBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  waitingTitle: {
    fontFamily: 'PlusJakartaSans-ExtraBold',
    fontSize: 28,
    color: C.onSurface,
    marginBottom: 12,
  },
  waitingText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 16,
    lineHeight: 24,
    color: C.onSurfaceVariant,
    textAlign: 'center',
    maxWidth: 320,
  },
  loadingCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.72)',
    borderRadius: 32,
    paddingVertical: 20,
    paddingHorizontal: 28,
    alignItems: 'center',
    gap: 8,
    shadowColor: '#363228',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8,
    overflow: 'hidden',
  },
  loadingTitle: {
    fontFamily: 'PlusJakartaSans-ExtraBold',
    fontSize: 20,
    color: C.onSurface,
    textAlign: 'center',
  },
  loadingDesc: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 14,
    color: C.onSurfaceVariant,
    textAlign: 'center',
    lineHeight: 20,
  },

});
