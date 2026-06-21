import React from 'react';
import { StyleSheet, ScrollView, View, TouchableOpacity, Image, Dimensions, Text, Alert, TouchableWithoutFeedback, BackHandler } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, withSequence, runOnJS } from 'react-native-reanimated';
import { router } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { SymbolView } from 'expo-symbols';
import { BlurView, BlurTargetView } from 'expo-blur';

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
  { key: 'home', icon: 'grid' as const, label: 'Home', active: true },
  { key: 'activity', icon: 'analytics' as const, label: 'Activity', active: false },
  { key: 'insights', icon: 'bulb' as const, label: 'Insights', active: false },
  { key: 'rules', icon: 'shield-checkmark' as const, label: 'Rules', active: false },
  { key: 'settings', icon: 'settings' as const, label: 'Settings', active: false },
];

export default function HomeScreen() {
  const [isDropdownVisible, setIsDropdownVisible] = React.useState(false);
  const [isDropdownRendered, setIsDropdownRendered] = React.useState(false);
  const dropdownProgress = useSharedValue(0);

  React.useEffect(() => {
    const backAction = () => {
      Alert.alert('Exit App', 'Are you sure you want to exit?', [
        { text: 'Cancel', onPress: () => null, style: 'cancel' },
        { text: 'YES', onPress: () => BackHandler.exitApp() },
      ]);
      return true; // Prevents default behavior
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => backHandler.remove();
  }, []);

  React.useEffect(() => {
    if (isDropdownVisible) {
      setIsDropdownRendered(true);
      dropdownProgress.value = withTiming(1, { duration: 250 });
    } else {
      dropdownProgress.value = withTiming(0, { duration: 200 }, (finished) => {
        if (finished) {
          runOnJS(setIsDropdownRendered)(false);
        }
      });
    }
  }, [isDropdownVisible]);

  const handleProfilePress = () => {
    setIsDropdownVisible(!isDropdownVisible);
  };

  const dropdownAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: dropdownProgress.value,
      transform: [
        { scale: dropdownProgress.value * 0.08 + 0.92 },
        { translateY: (1 - dropdownProgress.value) * -12 },
      ],
    };
  });

  const backdropAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: dropdownProgress.value,
    };
  });

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

  return (
    <ThemedView style={s.container}>
      <BlurTargetView ref={blurTargetRef} style={{ flex: 1 }}>
        <SafeAreaView style={s.safeArea} edges={['top']}>
          {/* Floating Glass Header */}
          <View style={s.header}>
            <View style={s.headerLeft}>
              <MaterialCommunityIcons name="spa" size={24} color={C.primary} style={s.headerIcon} />
              <Text style={s.headerTitle}>Nurturing Atelier</Text>
            </View>
            <View style={s.headerRight}>
              <TouchableOpacity
                onPress={handleProfilePress}
                activeOpacity={0.8}
              >
                <View style={s.profileWrap}>
                  <Image
                    source={require('@/assets/images/mother_avatar.jpg')}
                    style={s.profileAvatar}
                  />
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                style={s.iconButton}
                onPress={() => router.push('/notifications')}
                activeOpacity={0.8}
              >
                <Ionicons name="notifications-outline" size={22} color={C.primary} />
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView
            contentContainerStyle={s.scrollContent}
            showsVerticalScrollIndicator={false}
            onScrollBeginDrag={() => setIsDropdownVisible(false)}
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
                      <SymbolView name="timer" size={20} tintColor={C.secondary} />
                      <Text style={s.timerText}>1h 12m Remaining</Text>
                    </View>
                    <View style={s.timerTrack}>
                      <View style={s.timerFill} />
                    </View>
                  </BlurView>
                </View>
              </View>
            </View>

            {/* ========== LEO STATUS CARD (v1) ========== */}
            <View style={s.leoCard}>
              <View style={s.leoRow}>
                <View style={s.leoAvatarWrap}>
                  <Image
                    source={require('@/assets/images/leo_avatar.jpg')}
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
                    <View style={s.appIconBox}>
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
              </View>
              <Text style={s.insightsTitle}>Healthy Balance{'\n'}Achieved Today.</Text>
              <Text style={s.insightsDesc}>
                Educational content outpaced entertainment by 3:1 today. Great job guiding Leo's journey!
              </Text>
              <TouchableOpacity style={s.insightsCta}>
                <Text style={s.insightsCtaText}>Explore Detailed Insights</Text>
              </TouchableOpacity>

              {/* Decorative blurred blob */}
              <Animated.View style={[s.insightsBlob, animatedInsightsBlobStyle]} />
              {/* Icon watermark */}
              <View style={s.insightsWatermark}>
                <MaterialCommunityIcons name="chart-bell-curve" size={96} color={C.primary} />
              </View>
            </View>

            <View style={s.bottomSpacer} />
          </ScrollView>
        </SafeAreaView>
      </BlurTargetView>
      {isDropdownRendered && (
        <>
          <TouchableWithoutFeedback onPress={() => setIsDropdownVisible(false)}>
            <Animated.View style={[s.dropdownBackdrop, backdropAnimatedStyle]} />
          </TouchableWithoutFeedback>
          <Animated.View style={[s.dropdownMenuContainer, dropdownAnimatedStyle]}>
            <View style={s.dropdownMenu}>
              <BlurView intensity={90} tint="light" style={s.dropdownBlur}>
                <View style={s.dropdownHeaderInfo}>
                  <Text style={s.dropdownUserTitle}>Mother's Space</Text>
                  <Text style={s.dropdownUserRole}>Atelier Curator</Text>
                </View>

                <View style={s.dropdownDivider} />

                <TouchableOpacity
                  style={s.dropdownItem}
                  onPress={() => {
                    setIsDropdownVisible(false);
                    console.log("Profile");
                  }}
                  activeOpacity={0.7}
                >
                  <View style={s.dropdownItemLeft}>
                    <Ionicons name="person-outline" size={18} color={C.primary} />
                    <Text style={s.dropdownItemText}>View Profile</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={14} color={C.primary} style={{ opacity: 0.3 }} />
                </TouchableOpacity>

                <View style={s.dropdownDivider} />

                <TouchableOpacity
                  style={s.dropdownItem}
                  onPress={() => {
                    setIsDropdownVisible(false);
                    router.push('/notifications');
                  }}
                  activeOpacity={0.7}
                >
                  <View style={s.dropdownItemLeft}>
                    <Ionicons name="notifications-outline" size={18} color={C.primary} />
                    <Text style={s.dropdownItemText}>Daily Pulse</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={14} color={C.primary} style={{ opacity: 0.3 }} />
                </TouchableOpacity>

                <View style={s.dropdownDivider} />

                <TouchableOpacity
                  style={s.dropdownItem}
                  onPress={() => {
                    setIsDropdownVisible(false);
                    router.push('/(tabs)/settings');
                  }}
                  activeOpacity={0.7}
                >
                  <View style={s.dropdownItemLeft}>
                    <Ionicons name="settings-outline" size={18} color={C.primary} />
                    <Text style={s.dropdownItemText}>Sanctuary Settings</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={14} color={C.primary} style={{ opacity: 0.3 }} />
                </TouchableOpacity>
              </BlurView>
            </View>
          </Animated.View>
        </>
      )}
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
    gap: 8,
  },
  headerIcon: {
    marginRight: 2,
  },
  headerTitle: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 18,
    lineHeight: 24,
    color: C.primary,
    letterSpacing: -0.5,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
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
  dropdownBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(54, 50, 40, 0.08)',
    zIndex: 99,
  },
  dropdownMenuContainer: {
    position: 'absolute',
    top: 95,
    right: 24,
    width: 240,
    zIndex: 100,
    shadowColor: '#363228',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 10,
  },
  dropdownMenu: {
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(68, 103, 77, 0.12)',
  },
  dropdownBlur: {
    padding: 8,
    backgroundColor: 'rgba(255, 248, 240, 0.95)',
  },
  dropdownHeaderInfo: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 2,
  },
  dropdownUserTitle: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 15,
    color: C.onSurface,
  },
  dropdownUserRole: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 12,
    color: C.primary,
    opacity: 0.8,
  },
  dropdownDivider: {
    height: 1,
    backgroundColor: 'rgba(68, 103, 77, 0.08)',
    marginVertical: 4,
    marginHorizontal: 8,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 16,
  },
  dropdownItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dropdownItemText: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 14,
    color: C.onSurface,
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
    gap: 10,
  },
  appItem: {
    backgroundColor: C.surfaceContainerLow,
    padding: 20,
    borderRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  appIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: C.surfaceContainerHighest,
    justifyContent: 'center',
    alignItems: 'center',
  },
  appDetails: {
    flex: 1,
    gap: 6,
  },
  appMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  appName: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 14,
    color: C.onSurface,
  },
  appDuration: {
    fontFamily: 'PlusJakartaSans-SemiBold',
    fontSize: 12,
    color: 'rgba(54,50,40,0.5)',
  },
  appTrack: {
    height: 6,
    backgroundColor: C.surfaceContainerHigh,
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
