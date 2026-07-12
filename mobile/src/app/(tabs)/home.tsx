import React from 'react';
import { StyleSheet, View, TouchableOpacity, Image, Text, BackHandler, ActivityIndicator, RefreshControl } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, withSequence } from 'react-native-reanimated';
import { router } from 'expo-router';
import { ThemedView } from '@/components/themed-view';
import { EdgeFadeScrollView } from '@/components/ui/edge-fade';
import { SymbolView } from 'expo-symbols';
import { BlurView, BlurTargetView } from 'expo-blur';
import { usePairData } from '@/hooks/use-pair-data';
import { useAppModal } from '@/hooks/use-app-modal';
import { useSetupStatus } from '@/hooks/use-setup-status';
import { AppIcon } from '@/components/app-icon';
import { AuthRadius } from '@/constants/auth-theme';
import { Skeleton } from '@/components/ui/skeleton';

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

function groupNotificationsByApp(notifs: { source_package: string | null; source_app_name: string | null; app_icon_base64: string | null }[]) {
  const groups: Record<string, { name: string; package: string; count: number; icon: string | null }> = {};
  for (const n of notifs) {
    const pkg = n.source_package?.trim() || 'unknown';
    if (!groups[pkg]) groups[pkg] = { name: n.source_app_name?.trim() || pkg, package: pkg, count: 0, icon: n.app_icon_base64 };
    groups[pkg].count++;
  }
  const sorted = Object.values(groups).sort((a, b) => b.count - a.count);
  const max = sorted[0]?.count || 1;
  return sorted.map((g) => ({ ...g, percentage: Math.round((g.count / max) * 100) }));
}

function HomeScreenBanner({ onPress, title, subtitle, cta }: { onPress: () => void; title: string; subtitle: string; cta: string }) {
  return (
    <View style={s.setupBanner}>
      <View style={s.setupBannerIconWrap}>
        <Ionicons name="sparkles" size={20} color={C.onPrimary} />
      </View>
      <View style={s.setupBannerText}>
        <Text style={s.setupBannerTitle}>{title}</Text>
        <Text style={s.setupBannerSubtitle}>{subtitle}</Text>
      </View>
      <TouchableOpacity style={s.setupBannerCta} onPress={onPress} activeOpacity={0.7}>
        <Text style={s.setupBannerCtaText}>{cta}</Text>
      </TouchableOpacity>
    </View>
  );
}

function formatTimeAgo(timestamp: number): string {
  if (isNaN(timestamp) || timestamp <= 0) return 'Unknown';
  const diff = Date.now() - timestamp;
  if (diff < 0) return 'Just now';
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function HomeScreen() {
  const { childDevice, childName: childNameFromPair, latestNotification, notifications, isOnline, isLoading, isRefreshing, error, refresh } = usePairData();
  const { showModal } = useAppModal();
  const { loading: setupLoading, hasPair, setupComplete, incompletePairId } = useSetupStatus();

  const childName = childNameFromPair || 'Child';
  const groupedApps = groupNotificationsByApp(notifications);
  const uniqueAppCount = groupedApps.length;
  const lastSeenTime = childDevice?.last_seen_at ? new Date(childDevice.last_seen_at).getTime() : null;

  React.useEffect(() => {
    const backAction = () => {
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
  }, []);

  const blurTargetRef = React.useRef<View>(null);
  const scale = useSharedValue(1);
  const topLeft = useSharedValue(110);
  const topRight = useSharedValue(130);
  const bottomLeft = useSharedValue(90);
  const bottomRight = useSharedValue(140);
  const rotation = useSharedValue(0);

  // Slow morphing variables for insights card decoration blob
  const insTopLeft = useSharedValue(96);
  const insTopRight = useSharedValue(96);
  const insBottomLeft = useSharedValue(96);
  const insBottomRight = useSharedValue(96);

  React.useEffect(() => {
    // Smooth pulsing scale animation
    scale.value = withRepeat(
      withSequence(
        withTiming(1.02, { duration: 4000 }),
        withTiming(0.98, { duration: 4000 })
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

    // Slow organic morphing for insights blob
    insTopLeft.value = withRepeat(
      withSequence(
        withTiming(120, { duration: 5000 }),
        withTiming(60, { duration: 6000 }),
        withTiming(96, { duration: 5500 })
      ),
      -1,
      true
    );

    insTopRight.value = withRepeat(
      withSequence(
        withTiming(70, { duration: 5500 }),
        withTiming(130, { duration: 4800 }),
        withTiming(96, { duration: 5200 })
      ),
      -1,
      true
    );

    insBottomLeft.value = withRepeat(
      withSequence(
        withTiming(110, { duration: 5200 }),
        withTiming(60, { duration: 5800 }),
        withTiming(96, { duration: 5000 })
      ),
      -1,
      true
    );

    insBottomRight.value = withRepeat(
      withSequence(
        withTiming(70, { duration: 5600 }),
        withTiming(120, { duration: 5200 }),
        withTiming(96, { duration: 6000 })
      ),
      -1,
      true
    );
  }, []);

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

  const animatedInsightsBlobStyle = useAnimatedStyle(() => {
    return {
      borderTopLeftRadius: insTopLeft.value,
      borderTopRightRadius: insTopRight.value,
      borderBottomLeftRadius: insBottomLeft.value,
      borderBottomRightRadius: insBottomRight.value,
    };
  });

  const renderSetupBanner = () => {
    if (setupLoading || setupComplete) return null;

    if (!hasPair) {
      return (
        <HomeScreenBanner
          onPress={() => router.push('/parent-setup')}
          title="Let's connect a child device"
          subtitle="To start monitoring, link your child's phone in a few taps."
          cta="Add Child"
        />
      );
    }

    if (incompletePairId) {
      return (
        <HomeScreenBanner
          onPress={() => router.push(`/app-filters?pairId=${incompletePairId}`)}
          title={`${childNameFromPair || 'Your child'}'s device is waiting`}
          subtitle="Choose which apps to monitor so monitoring can start."
          cta="Choose Apps"
        />
      );
    }

    return null;
  };

  return (
    <ThemedView style={s.container}>
      <BlurTargetView ref={blurTargetRef} style={{ flex: 1 }}>
        {renderSetupBanner()}

        <EdgeFadeScrollView
          contentContainerStyle={s.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={refresh} colors={[C.primary]} tintColor={C.primary} />
          }
        >
          {/* ========== HERO SECTION (v2) ========== */}
          <View style={s.heroSection}>
            {/* Text block */}
            <View style={s.heroTextBlock}>
              <Text style={s.flowLabel}>{getGreeting()}</Text>
              <Text style={s.heroTitle}>
                Welcome back
              </Text>
              <Text style={s.heroDescription}>
                You&apos;re keeping an eye on {childName}. They&apos;re {isOnline ? 'online' : 'away'} right now.
              </Text>
              <View style={s.heroButtons}>
                <TouchableOpacity style={s.primaryBtn} onPress={() => router.push('/(tabs)/activity')}>
                  <Text style={s.primaryBtnText}>View Activity</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.secondaryBtn} onPress={() => router.push('/(tabs)/insights')}>
                  <Text style={s.secondaryBtnText}>View Insights</Text>
                </TouchableOpacity>
              </View>
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

              {/* Floating Presence Card */}
              <View style={s.timerCardContainer}>
                <BlurView
                  intensity={80}
                  tint="light"
                  style={s.timerCard}
                >
                  <View style={s.timerHeader}>
                    <View style={[s.presenceDot, { backgroundColor: isOnline ? C.primary : C.outline }]} />
                    <Text style={s.timerText}>
                      {isOnline
                        ? 'Online now'
                        : lastSeenTime
                          ? `Last seen ${formatTimeAgo(lastSeenTime)}`
                          : 'No activity yet'}
                    </Text>
                  </View>
                </BlurView>
              </View>
            </View>
          </View>

          <View style={s.leoCard}>
            {isLoading ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, padding: 12 }}>
                <Skeleton width={52} height={52} borderRadius={26} />
                <View style={{ flex: 1, gap: 8 }}>
                  <Skeleton width={140} height={16} borderRadius={8} />
                  <Skeleton width={200} height={12} borderRadius={6} />
                </View>
                <View style={{ alignItems: 'flex-end', gap: 6 }}>
                  <Skeleton width={12} height={12} borderRadius={6} style={{ alignSelf: 'center' }} />
                  <Skeleton width={40} height={12} borderRadius={6} />
                </View>
              </View>
            ) : error && !childDevice ? (
              <View style={{ padding: 32, alignItems: 'center' }}>
                <Text style={{ fontFamily: 'PlusJakartaSans-Medium', fontSize: 14, color: C.error }}>{error}</Text>
              </View>
            ) : !childDevice ? (
              <View style={{ padding: 32, alignItems: 'center' }}>
                <Ionicons name="phone-portrait-outline" size={40} color={C.outline} />
                <Text style={{ fontFamily: 'PlusJakartaSans-Medium', fontSize: 14, color: C.outline, marginTop: 12 }}>No child connected yet</Text>
              </View>
            ) : (
              <View style={s.leoRow}>
                <View style={s.leoAvatarWrap}>
                  <Image
                    source={require('@/assets/images/leo_avatar.jpg')}
                    style={s.leoAvatar}
                  />
                  {isOnline && (
                    <View style={s.leoOnlineDot}>
                      <View style={s.leoOnlineDotInner} />
                    </View>
                  )}
                </View>
                <View style={s.leoInfo}>
                  <Text style={s.leoName}>
                    {childNameFromPair || 'Child'} is {isOnline ? 'Online' : 'Away'}
                  </Text>
                  <Text style={s.leoActivity}>
                    {latestNotification ? (
                      <>Currently using <Text style={s.leoAppName}>{latestNotification.source_app_name || 'an app'}</Text></>
                    ) : (
                      'No recent activity'
                    )}
                  </Text>
                  {childDevice.last_seen_at && (
                    <View style={s.leoBadges}>
                      <View style={s.badge}>
                        <Ionicons name="time-outline" size={14} color={C.primary} />
                        <Text style={s.badgeText}>
                          {formatTimeAgo(new Date(childDevice.last_seen_at).getTime())}
                        </Text>
                      </View>
                    </View>
                  )}
                </View>
                <View style={s.harmonyBlock}>
                  <View style={[s.harmonyDot, { backgroundColor: isOnline ? C.primary : C.outline }]} />
                  <Text style={s.harmonyLabel}>{isOnline ? 'Online' : 'Away'}</Text>
                </View>
              </View>
            )}
          </View>

          {/* ========== LATEST ACTIVITY CARD ========== */}
          <View style={s.bedtimeCard}>
            <Ionicons name="sparkles" size={28} color={C.onPrimary} />
            <View style={s.bedtimeTextBlock}>
              <Text style={s.bedtimeTitle}>
                {latestNotification
                  ? `${latestNotification.source_app_name || 'App'} activity`
                  : 'No recent activity'}
              </Text>
              <Text style={s.bedtimeSub}>
                {latestNotification
                  ? (latestNotification.notification_title || latestNotification.notification_body || `via ${latestNotification.source_app_name || 'app'}`)
                  : 'Waiting for child device activity...'}
              </Text>
            </View>
          </View>

          {/* ========== MOST ACTIVE APPS (live) ========== */}
          <View style={s.appsSection}>
            <View style={s.appsHeader}>
              <Text style={s.appsTitle}>Most active apps</Text>
              <TouchableOpacity onPress={() => router.push('/(tabs)/activity')}>
                <Text style={s.viewAll}>View all</Text>
              </TouchableOpacity>
            </View>
            <View style={s.appsList}>
              {groupNotificationsByApp(notifications).slice(0, 3).map((app, i) => (
                <View key={app.name} style={s.appItem}>
                  <View style={s.appIconBox}>
                    <AppIcon iconBase64={app.icon} size={28} fallbackSize={16} />
                  </View>
                  <View style={s.appDetails}>
                    <View style={s.appMeta}>
                      <Text style={s.appName} numberOfLines={1} ellipsizeMode="tail">{app.name}</Text>
                      <Text style={s.appDuration}>{app.count} notification{app.count !== 1 ? 's' : ''}</Text>
                    </View>
                    <Text style={s.appSubtitle} numberOfLines={1}>
                      {app.percentage === 100 ? 'Most active app today' : `${app.percentage}% relative activity`}
                    </Text>
                  </View>
                </View>
              ))}
              {!isLoading && notifications.length === 0 && (
                <View style={{ padding: 24, alignItems: 'center' }}>
                  <Text style={{ fontFamily: 'PlusJakartaSans-Medium', fontSize: 14, color: C.outline }}>No notifications yet</Text>
                </View>
              )}
            </View>
          </View>

          {/* ========== APP VARIETY CARD ========== */}
          <View style={s.insightsCard}>
            <View style={s.insightsLabelRow}>
              <View style={s.insightsLabelPill}>
                <Text style={s.insightsLabelText}>App Variety</Text>
              </View>
            </View>
            <Text style={s.insightsTitle}>
              {uniqueAppCount > 0 ? `${uniqueAppCount} app${uniqueAppCount !== 1 ? 's' : ''}` : 'No activity yet'}
            </Text>
            <Text style={s.insightsDesc}>
              {uniqueAppCount > 0
                ? `${childName} used ${uniqueAppCount} different app${uniqueAppCount !== 1 ? 's' : ''} today`
                : 'App diversity will appear here once the child device is active.'}
            </Text>
            <TouchableOpacity style={s.insightsCta} onPress={() => router.push('/(tabs)/insights')}>
              <Text style={s.insightsCtaText}>Explore Insights</Text>
            </TouchableOpacity>

            {/* Decorative blurred blob */}
            <Animated.View style={[s.insightsBlob, animatedInsightsBlobStyle]} />
            {/* Icon watermark */}
            <View style={s.insightsWatermark}>
              <MaterialCommunityIcons name="chart-bell-curve" size={96} color={C.primary} />
            </View>
          </View>

          <View style={s.bottomSpacer} />
        </EdgeFadeScrollView>
      </BlurTargetView>

    </ThemedView>
  );
}

// ============================================================
// STYLES - mapped precisely from Stitch Tailwind
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

  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: C.white,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#363228',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  profileWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: C.surfaceContainerLowest,
    backgroundColor: C.surfaceContainerHighest,
    overflow: 'hidden',
    shadowColor: '#363228',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 32,
  },
  profileAvatar: {
    width: '100%',
    height: '100%',
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
  heroDescription: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 16,
    lineHeight: 24,
    color: C.onSurfaceVariant,
    maxWidth: 320,
  },
  heroButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  primaryBtn: {
    backgroundColor: C.primary,
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 9999,
    shadowColor: C.primary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 6,
  },
  primaryBtnText: {
    fontFamily: 'PlusJakartaSans-SemiBold',
    fontSize: 16,
    lineHeight: 22,
    color: C.onPrimary,
  },
  secondaryBtn: {
    backgroundColor: C.surfaceContainerHigh,
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 9999,
  },
  secondaryBtnText: {
    fontFamily: 'PlusJakartaSans-SemiBold',
    fontSize: 16,
    lineHeight: 22,
    color: C.onSurface,
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
    padding: 24,
    borderRadius: 32,
    minWidth: 200,
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },

  timerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  timerText: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 16,
    lineHeight: 22,
    color: C.onSurface,
  },
  presenceDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },

  /* ---------- Leo Card ---------- */
  leoCard: {
    backgroundColor: C.surfaceContainerLowest,
    borderRadius: 32,
    padding: 32,
    marginBottom: 16,
    shadowColor: '#363228',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 6,
  },
  leoRow: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: 32,
  },
  leoAvatarWrap: {
    position: 'relative',
    padding: 4,
    borderWidth: 4,
    borderColor: C.primaryContainer,
    borderRadius: 64,
  },
  leoAvatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: C.surfaceContainer,
  },
  leoOnlineDot: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: C.primary,
    borderWidth: 2,
    borderColor: C.surfaceContainerLowest,
    justifyContent: 'center',
    alignItems: 'center',
  },
  leoOnlineDotInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#fff',
  },
  leoInfo: {
    alignItems: 'center',
    gap: 16,
  },
  leoName: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 24,
    lineHeight: 32,
    color: C.onSurface,
  },
  leoActivity: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 16,
    lineHeight: 24,
    color: C.onSurfaceVariant,
  },
  leoAppName: {
    fontFamily: 'PlusJakartaSans-SemiBold',
    color: C.primary,
  },
  leoBadges: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'center',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: C.surfaceContainer,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 9999,
  },
  badgeText: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 14,
    lineHeight: 20,
    color: C.primary,
  },
  harmonyBlock: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  harmonyDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginBottom: 8,
  },
  harmonyLabel: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 10,
    lineHeight: 14,
    color: C.onSurfaceVariant,
    opacity: 0.6,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },

  /* ---------- Bedtime Card ---------- */
  bedtimeCard: {
    backgroundColor: C.primary,
    borderRadius: 32,
    padding: 32,
    marginBottom: 48,
    gap: 16,
    shadowColor: C.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10,
    shadowRadius: 12,
    elevation: 2,
  },
  bedtimeTextBlock: {
    gap: 6,
  },
  bedtimeTitle: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 20,
    lineHeight: 26,
    color: C.onPrimary,
  },
  bedtimeSub: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 14,
    lineHeight: 20,
    color: C.primaryContainer,
  },

  /* ---------- Apps Section ---------- */
  appsSection: {
    marginBottom: 48,
  },
  appsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  appsTitle: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 18,
    lineHeight: 24,
    color: C.onSurface,
  },
  viewAll: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 14,
    lineHeight: 20,
    color: C.primary,
  },
  appsList: {
    gap: 12,
  },
  appItem: {
    backgroundColor: C.surfaceContainerLowest,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 30,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    shadowColor: '#36322832',
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 4,
    elevation: 2,
  },
  appIconBox: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: C.surfaceContainerHigh,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  appDetails: {
    flex: 1,
    gap: 4,
  },
  appMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  appName: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 15,
    color: C.onSurface,
    flexShrink: 1,
    marginRight: 8,
  },
  appDuration: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 12,
    color: C.onSurfaceVariant,
    flexShrink: 0,
  },
  appSubtitle: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 13,
    color: C.primary,
    lineHeight: 18,
  },

  /* ---------- Insights Card ---------- */
  insightsCard: {
    backgroundColor: C.surfaceContainerHighest,
    borderRadius: 32,
    padding: 32,
    position: 'relative',
    overflow: 'hidden',
    shadowColor: '#363228',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  insightsLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  insightsLabelPill: {
    backgroundColor: C.surfaceContainerLowest,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 9999,
  },
  insightsLabelText: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 10,
    lineHeight: 14,
    letterSpacing: 1,
    color: C.onSurfaceVariant,
    textTransform: 'uppercase',
  },
  insightsTitle: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 24,
    lineHeight: 30,
    color: C.onSurface,
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  insightsDesc: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 14,
    lineHeight: 20,
    color: C.onSurfaceVariant,
    marginBottom: 20,
  },
  insightsCta: {
    backgroundColor: C.onSurface,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 9999,
    alignSelf: 'flex-start',
  },
  insightsCtaText: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 14,
    lineHeight: 20,
    color: C.surface,
  },
  insightsBlob: {
    position: 'absolute',
    right: -48,
    bottom: -48,
    width: 192,
    height: 192,
    borderTopLeftRadius: 96,
    borderTopRightRadius: 96,
    borderBottomLeftRadius: 96,
    borderBottomRightRadius: 96,
    backgroundColor: 'rgba(68,103,77,0.08)',
    overflow: 'hidden',
  },
  insightsWatermark: {
    position: 'absolute',
    top: 32,
    right: 32,
    opacity: 0.15,
  },

  /* ---------- Bottom Spacer ---------- */
  bottomSpacer: {
    height: 130,
  },

  /* ---------- Setup Banner ---------- */
  setupBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 24,
    marginTop: 12,
    marginBottom: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: C.tertiaryContainer,
    borderRadius: AuthRadius.xl,
    shadowColor: C.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.10,
    shadowRadius: 16,
    elevation: 3,
  },
  setupBannerIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: C.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  setupBannerText: {
    flex: 1,
  },
  setupBannerTitle: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 14,
    lineHeight: 18,
    color: C.onSurface,
  },
  setupBannerSubtitle: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    lineHeight: 16,
    color: C.onSurfaceVariant,
    marginTop: 2,
  },
  setupBannerCta: {
    backgroundColor: C.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: AuthRadius.full,
  },
  setupBannerCtaText: {
    fontFamily: 'PlusJakartaSans-SemiBold',
    fontSize: 13,
    color: C.onPrimary,
  },

  /* ---------- Bottom Nav ---------- */
  navSafeArea: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  bottomNav: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: 20,
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    shadowColor: '#363228',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.06,
    shadowRadius: 32,
    elevation: 8,
  },
  navItem: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 2,
  },
  navItemActive: {
    backgroundColor: C.surfaceContainer,
    borderRadius: 9999,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  navLabel: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 10,
    lineHeight: 14,
    letterSpacing: 0.5,
    color: 'rgba(54,50,40,0.5)',
    textTransform: 'uppercase',
  },
  navLabelActive: {
    color: C.primary,
  },
});
