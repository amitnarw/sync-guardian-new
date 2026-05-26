import React from 'react';
import { StyleSheet, ScrollView, View, TouchableOpacity, Image, Dimensions, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, withSequence } from 'react-native-reanimated';
import { router } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { SymbolView } from 'expo-symbols';

const AnimatedLinearGradient = Animated.createAnimatedComponent(LinearGradient);

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

const apps = [
  { name: 'Khan Academy', duration: '45m', color: C.primary, icon: 'school-outline' as const, width: '85%' },
  { name: 'YouTube Kids', duration: '20m', color: C.secondary, icon: 'logo-youtube' as const, width: '40%' },
  { name: 'Duolingo', duration: '15m', color: '#87a96b', icon: 'language-outline' as const, width: '30%' },
];

const navItems = [
  { key: 'dashboard', icon: 'grid' as const, label: 'Dashboard', active: true },
  { key: 'activity', icon: 'analytics' as const, label: 'Activity', active: false },
  { key: 'insights', icon: 'bulb' as const, label: 'Insights', active: false },
  { key: 'rules', icon: 'shield-checkmark' as const, label: 'Rules', active: false },
  { key: 'settings', icon: 'settings' as const, label: 'Settings', active: false },
];

export default function HomeScreen() {
  const scale = useSharedValue(1);

  React.useEffect(() => {
    scale.value = withRepeat(
      withSequence(
        withTiming(1.03, { duration: 3000 }),
        withTiming(1, { duration: 3000 })
      ),
      -1,
      true
    );
  }, []);

  const animatedBlobStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
    };
  });

  return (
    <ThemedView style={s.container}>
      <SafeAreaView style={s.safeArea} edges={['top']}>
        {/* Floating Glass Header */}
        <View style={s.header}>
          <View style={s.headerLeft}>
            <Image
              source={require('@/assets/images/mother_avatar.png')}
              style={s.headerAvatar}
            />
            <Text style={s.headerTitle}>Nurturing Atelier</Text>
          </View>
          <TouchableOpacity 
            style={s.headerButton}
            onPress={() => router.push('/notifications')}
          >
            <Ionicons name="notifications-outline" size={22} color={C.onSurface} />
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={s.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* ========== HERO SECTION (v2) ========== */}
          <View style={s.heroSection}>
            {/* Text block */}
            <View style={s.heroTextBlock}>
              <Text style={s.flowLabel}>MORNING FLOW</Text>
              <Text style={s.heroTitle}>
                Gentle rhythm for{'\n'}
                <Text style={s.heroTitleAccent}>Leo's Wednesday</Text>
              </Text>
              <Text style={s.heroDescription}>
                Currently in "Creative Exploration" block. The digital sanctuary is maintaining a soft focus environment.
              </Text>
              <View style={s.heroButtons}>
                <TouchableOpacity style={s.primaryBtn}>
                  <Text style={s.primaryBtnText}>Adjust Rhythm</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.secondaryBtn}>
                  <Text style={s.secondaryBtnText}>View Schedule</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Visual block */}
            <View style={s.visualBlock}>
              {/* Decorative blurred blob behind hearth */}
              <View style={s.decoBlobBehind} />

              {/* Hearth Blob */}
              <AnimatedLinearGradient
                colors={[C.primary, C.primaryContainer]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[s.hearthBlob, animatedBlobStyle]}
              >
                <View style={s.hearthInner}>
                  <SymbolView
                    name={"shield_with_heart" as any}
                    size={72}
                    type="monochrome"
                    tintColor="#ffffff"
                  />
                </View>
              </AnimatedLinearGradient>

              {/* Floating Timer Card */}
              <View style={s.timerCard}>
                <View style={s.timerHeader}>
                  <SymbolView name="timer" size={20} tintColor={C.secondary} />
                  <Text style={s.timerText}>1h 12m Remaining</Text>
                </View>
                <View style={s.timerTrack}>
                  <View style={s.timerFill} />
                </View>
              </View>
            </View>
          </View>

          {/* ========== LEO STATUS CARD (v1) ========== */}
          <View style={s.leoCard}>
            <View style={s.leoRow}>
              <View style={s.leoAvatarWrap}>
                <Image
                  source={require('@/assets/images/leo_avatar.png')}
                  style={s.leoAvatar}
                />
                <View style={s.leoOnlineDot}>
                  <View style={s.leoOnlineDotInner} />
                </View>
              </View>
              <View style={s.leoInfo}>
                <Text style={s.leoName}>Leo is Online</Text>
                <Text style={s.leoActivity}>
                  Currently using <Text style={s.leoAppName}>Khan Academy</Text>
                </Text>
                <View style={s.leoBadges}>
                  <View style={s.badge}>
                    <Ionicons name="battery-charging" size={14} color={C.primary} />
                    <Text style={s.badgeText}>84%</Text>
                  </View>
                  <View style={s.badge}>
                    <Ionicons name="location-outline" size={14} color={C.primary} />
                    <Text style={s.badgeText}>Home</Text>
                  </View>
                </View>
              </View>
              <View style={s.harmonyBlock}>
                <Text style={s.harmonyStat}>92%</Text>
                <Text style={s.harmonyLabel}>Harmony Sync</Text>
              </View>
            </View>
          </View>

          {/* ========== BEDTIME ROUTINE CARD (v1) ========== */}
          <View style={s.bedtimeCard}>
            <Ionicons name="sparkles" size={28} color={C.onPrimary} />
            <View style={s.bedtimeTextBlock}>
              <Text style={s.bedtimeTitle}>Bedtime Routine starts in 2h</Text>
              <Text style={s.bedtimeSub}>
                Devices will automatically enter Focus Mode at 8:00 PM.
              </Text>
            </View>
          </View>

          {/* ========== MOST ACTIVE APPS (v1) ========== */}
          <View style={s.appsSection}>
            <View style={s.appsHeader}>
              <Text style={s.appsTitle}>Most active apps</Text>
              <TouchableOpacity>
                <Text style={s.viewAll}>View all</Text>
              </TouchableOpacity>
            </View>
            <View style={s.appsList}>
              {apps.map((app, i) => (
                <View key={i} style={s.appItem}>
                  <View style={[s.appIconBox, { backgroundColor: C.surfaceContainerHighest }]}>
                    <Ionicons name={app.icon} size={20} color={C.primary} />
                  </View>
                  <View style={s.appDetails}>
                    <View style={s.appMeta}>
                      <Text style={s.appName}>{app.name}</Text>
                      <Text style={s.appDuration}>{app.duration}</Text>
                    </View>
                    <View style={s.appTrack}>
                      <View style={[s.appFill, { width: app.width as any, backgroundColor: app.color }]} />
                    </View>
                  </View>
                </View>
              ))}
            </View>
          </View>

          {/* ========== DAILY INSIGHTS CARD (v1) ========== */}
          <View style={s.insightsCard}>
            <View style={s.insightsLabelRow}>
              <View style={s.insightsLabelPill}>
                <Text style={s.insightsLabelText}>Daily Insights</Text>
              </View>
              <MaterialCommunityIcons name="chart-bell-curve" size={24} color={C.tertiary} />
            </View>
            <Text style={s.insightsTitle}>Healthy Balance{'\n'}Achieved Today.</Text>
            <Text style={s.insightsDesc}>
              Educational content outpaced entertainment by 3:1 today. Great job guiding Leo's journey!
            </Text>
            <TouchableOpacity style={s.insightsCta}>
              <Text style={s.insightsCtaText}>Explore Detailed Insights</Text>
            </TouchableOpacity>

            {/* Decorative blurred circle */}
            <View style={s.insightsBlob} />
            {/* Icon watermark */}
            <View style={s.insightsWatermark}>
              <MaterialCommunityIcons name="chart-bell-curve" size={96} color={C.primary} />
            </View>
          </View>

          <View style={s.bottomSpacer} />
        </ScrollView>
      </SafeAreaView>

    </ThemedView>
  );
}

// ============================================================
// STYLES — mapped precisely from Stitch Tailwind
// ============================================================
const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.surface,
  },
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 8,
  },

  /* ---------- Header ---------- */
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: 'rgba(255,248,240,0.80)',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'rgba(68,103,77,0.12)',
    backgroundColor: C.surfaceContainerHighest,
  },
  headerTitle: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 18,
    lineHeight: 24,
    color: C.onSurface,
    letterSpacing: -0.2,
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: C.surfaceContainerLowest,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#363228',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 24,
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
    borderTopLeftRadius: 170,
    borderTopRightRadius: 110,
    borderBottomLeftRadius: 90,
    borderBottomRightRadius: 200,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: C.primary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.20,
    shadowRadius: 20,
    elevation: 5,
    zIndex: 1,
  },
  hearthInner: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255,255,255,0.20)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.30)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Timer card */
  timerCard: {
    position: 'absolute',
    bottom: 20,
    left: -12,
    backgroundColor: C.surfaceContainerLowest,
    padding: 24,
    borderRadius: 32,
    minWidth: 200,
    shadowColor: C.onSurface,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: 'rgba(234,225,210,0.20)',
    zIndex: 2,
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
  timerTrack: {
    height: 6,
    width: '100%',
    backgroundColor: C.surfaceContainerHigh,
    borderRadius: 3,
    overflow: 'hidden',
  },
  timerFill: {
    height: '100%',
    width: '66%',
    backgroundColor: C.secondary,
    borderRadius: 3,
  },

  /* ---------- Leo Card ---------- */
  leoCard: {
    backgroundColor: C.surfaceContainerLowest,
    borderRadius: 32,
    padding: 32,
    marginBottom: 16,
    shadowColor: '#363228',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
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
  harmonyStat: {
    fontFamily: 'PlusJakartaSans-ExtraBold',
    fontSize: 36,
    lineHeight: 40,
    color: C.secondary,
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
    gap: 16,
  },
  appItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  appIconBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  appDetails: {
    flex: 1,
  },
  appMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  appName: {
    fontFamily: 'PlusJakartaSans-SemiBold',
    fontSize: 14,
    lineHeight: 20,
    color: C.onSurface,
  },
  appDuration: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 14,
    lineHeight: 20,
    color: C.onSurfaceVariant,
  },
  appTrack: {
    height: 6,
    backgroundColor: C.surfaceContainer,
    borderRadius: 3,
    overflow: 'hidden',
  },
  appFill: {
    height: '100%',
    borderRadius: 3,
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
    borderRadius: 96,
    backgroundColor: 'rgba(68,103,77,0.08)',
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
