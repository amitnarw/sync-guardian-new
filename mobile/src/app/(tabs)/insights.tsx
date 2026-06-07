import React from 'react';
import { StyleSheet, ScrollView, View, TouchableOpacity, Image, Dimensions, Text, Alert, TouchableWithoutFeedback } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, runOnJS } from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import Svg, { Circle } from 'react-native-svg';
import { router } from 'expo-router';
import { ThemedView } from '@/components/themed-view';
import { SymbolView } from 'expo-symbols';

const { width: SCREEN_W } = Dimensions.get('window');

// ============================================================
// EXACT STITCH COLORS (from v3 HTML Tailwind config)
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

// Donut dimensions
const SVG_SIZE = 96;
const RADIUS = 38;
const STROKE_WIDTH = 6;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS; // ~238.76
const PERCENTAGE = 0.72;
const STROKE_OFFSET = CIRCUMFERENCE * (1 - PERCENTAGE);

export default function InsightsScreen() {
  const [isDropdownVisible, setIsDropdownVisible] = React.useState(false);
  const [isDropdownRendered, setIsDropdownRendered] = React.useState(false);
  const dropdownProgress = useSharedValue(0);

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
  return (
    <ThemedView style={s.container}>
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
          {/* ========== HERO: GROWTH NARRATIVE ========== */}
          <View style={s.heroSection}>
            <View style={s.badgePill}>
              <Text style={s.badgeText}>Weekly Narrative</Text>
            </View>
            <Text style={s.heroTitle}>
              A week of <Text style={s.heroTitleAccent}>gentle</Text> focus.
            </Text>
            <Text style={s.heroDescription}>
              Leo's digital presence felt balanced this week. Screen time drifted toward creative tools, reflecting a peak in curiosity.
            </Text>
          </View>

          {/* ========== BENTO SECTION: HIGH-LEVEL STATS ========== */}
          <View style={s.bentoGrid}>
            {/* Usage Balance Card (Donut) */}
            <View style={s.donutCard}>
              <View style={s.donutTextWrap}>
                <Text style={s.donutLabel}>Usage Balance</Text>
                <Text style={s.donutValue}>72%</Text>
                <Text style={s.donutSub}>Target reach: Optimal</Text>
              </View>

              {/* Polished SVG Circle Donut */}
              <View style={s.donutSvgContainer}>
                <Svg width={SVG_SIZE} height={SVG_SIZE} viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`} style={s.donutSvg}>
                  {/* Track Circle */}
                  <Circle
                    cx={SVG_SIZE / 2}
                    cy={SVG_SIZE / 2}
                    r={RADIUS}
                    fill="transparent"
                    stroke={C.surfaceContainer}
                    strokeWidth={STROKE_WIDTH}
                  />
                  {/* Animated Progress Circle */}
                  <Circle
                    cx={SVG_SIZE / 2}
                    cy={SVG_SIZE / 2}
                    r={RADIUS}
                    fill="transparent"
                    stroke={C.primary}
                    strokeWidth={STROKE_WIDTH}
                    strokeDasharray={`${CIRCUMFERENCE} ${CIRCUMFERENCE}`}
                    strokeDashoffset={STROKE_OFFSET}
                    strokeLinecap="round"
                  />
                </Svg>
                {/* Central Leaf Indicator */}
                <View style={s.donutIconCenter}>
                  <Ionicons name="leaf" size={20} color={C.primary} />
                </View>
              </View>
            </View>

            {/* Small Growth Insight Card */}
            <View style={s.growthInsightCard}>
              <Ionicons name="sparkles" size={24} color={C.secondary} style={s.growthIcon} />
              <Text style={s.growthInsightTitle}>Deep Focus</Text>
              <Text style={s.growthInsightDesc}>3.2 hours of uninterrupted learning logged today.</Text>
            </View>
          </View>

          {/* ========== BELOVED SPACES: APP ITEMS ========== */}
          <View style={s.spacesSection}>
            <View style={s.spacesHeader}>
              <Text style={s.spacesTitle}>Beloved Spaces</Text>
              <TouchableOpacity>
                <Text style={s.viewHistoryBtn}>View History</Text>
              </TouchableOpacity>
            </View>

            <View style={s.spacesList}>
              {/* App Item 1: Canvas Kids */}
              <View style={s.spaceItem}>
                <View style={[s.appIconContainer, { backgroundColor: '#E8F1EB' }]}>
                  <Ionicons name="color-palette-outline" size={26} color={C.primary} />
                </View>
                <View style={s.appTextContainer}>
                  <Text style={s.appNameText}>Canvas Kids</Text>
                  <Text style={s.appCategoryText}>Creativity • 2h 15m</Text>
                </View>
                <View style={s.trendContainer}>
                  <View style={[s.trendBadgePill, { backgroundColor: C.primaryContainer }]}>
                    <Text style={[s.trendBadgeText, { color: C.primary }]}>+12%</Text>
                  </View>
                  <Text style={s.trendCaption}>vs last week</Text>
                </View>
              </View>

              {/* App Item 2: StoryTime Academy */}
              <View style={s.spaceItem}>
                <View style={[s.appIconContainer, { backgroundColor: '#FDF1EE' }]}>
                  <Ionicons name="book-outline" size={26} color={C.secondary} />
                </View>
                <View style={s.appTextContainer}>
                  <Text style={s.appNameText}>StoryTime Academy</Text>
                  <Text style={s.appCategoryText}>Education • 1h 45m</Text>
                </View>
                <View style={s.trendContainer}>
                  <View style={[s.trendBadgePill, { backgroundColor: C.surfaceVariant }]}>
                    <Text style={[s.trendBadgeText, { color: C.onSurfaceVariant }]}>Stable</Text>
                  </View>
                  <Text style={s.trendCaption}>consistent growth</Text>
                </View>
              </View>

              {/* App Item 3: Logic Puzzles */}
              <View style={s.spaceItem}>
                <View style={[s.appIconContainer, { backgroundColor: '#F5F1E9' }]}>
                  <Ionicons name="grid-outline" size={26} color={C.onSurfaceVariant} />
                </View>
                <View style={s.appTextContainer}>
                  <Text style={s.appNameText}>Logic Puzzles</Text>
                  <Text style={s.appCategoryText}>Problem Solving • 45m</Text>
                </View>
                <View style={s.trendContainer}>
                  <View style={[s.trendBadgePill, { backgroundColor: C.secondaryContainer }]}>
                    <Text style={[s.trendBadgeText, { color: C.secondary }]}>-5%</Text>
                  </View>
                  <Text style={s.trendCaption}>evening dip</Text>
                </View>
              </View>
            </View>
          </View>

          {/* ========== NARRATIVE INSIGHT CARD ========== */}
          <View style={s.narrativeCard}>
            {/* Hearth Shape watermark blob behind */}
            <View style={s.watermarkHearthShape} />

            <View style={s.narrativeLabelRow}>
              <Ionicons name="bulb" size={20} color={C.primary} />
              <Text style={s.narrativeLabelText}>A Maker's Observation</Text>
            </View>
            <Text style={s.narrativeTitle}>Digital creation is outweighing consumption.</Text>
            <Text style={s.narrativeDesc}>
              Most of the activity this week was concentrated in creative "Sandbox" mode. This suggests a transition from passive viewing to active building. Consider introducing a new drawing tool.
            </Text>
            <TouchableOpacity style={s.exploreBtn}>
              <Text style={s.exploreBtnText}>Explore Creative Tools</Text>
            </TouchableOpacity>
          </View>

          {/* Spacer to avoid bottom custom tab bar overlay */}
          <View style={s.bottomSpacer} />
        </ScrollView>
      </SafeAreaView>
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

  /* ---------- Hero Section ---------- */
  heroSection: {
    marginTop: 16,
    marginBottom: 32,
    alignItems: 'flex-start',
    gap: 12,
  },
  badgePill: {
    backgroundColor: C.primaryContainer,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 9999,
  },
  badgeText: {
    fontFamily: 'PlusJakartaSans-SemiBold',
    fontSize: 12,
    lineHeight: 16,
    color: C.primary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  heroTitle: {
    fontFamily: 'PlusJakartaSans-ExtraBold',
    fontSize: 36,
    lineHeight: 44,
    color: C.onSurface,
    letterSpacing: -0.8,
  },
  heroTitleAccent: {
    fontFamily: 'PlusJakartaSans-ExtraBoldItalic',
    color: C.primary,
  },
  heroDescription: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 16,
    lineHeight: 24,
    color: C.onSurfaceVariant,
    maxWidth: SCREEN_W - 64,
  },

  /* ---------- Bento Grid ---------- */
  bentoGrid: {
    flexDirection: 'column',
    gap: 16,
    marginBottom: 40,
  },
  donutCard: {
    backgroundColor: C.surfaceContainerLowest,
    borderRadius: 32,
    padding: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#363228',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  donutTextWrap: {
    flex: 1,
    gap: 4,
  },
  donutLabel: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 12,
    lineHeight: 16,
    color: C.onSurfaceVariant,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  donutValue: {
    fontFamily: 'PlusJakartaSans-ExtraBold',
    fontSize: 36,
    lineHeight: 44,
    color: C.onSurface,
  },
  donutSub: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 13,
    lineHeight: 18,
    color: C.onSurfaceVariant,
  },
  donutSvgContainer: {
    position: 'relative',
    width: SVG_SIZE,
    height: SVG_SIZE,
  },
  donutSvg: {
    transform: [{ rotate: '-90deg' }],
  },
  donutIconCenter: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  growthInsightCard: {
    backgroundColor: 'rgba(255, 218, 211, 0.3)', // bg-secondary-container/30
    borderRadius: 32,
    padding: 24,
    justifyContent: 'center',
  },
  growthIcon: {
    marginBottom: 8,
  },
  growthInsightTitle: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 18,
    lineHeight: 24,
    color: C.secondary,
    marginBottom: 4,
  },
  growthInsightDesc: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 14,
    lineHeight: 20,
    color: 'rgba(160, 65, 45, 0.8)', // secondary text opacity
  },

  /* ---------- Beloved Spaces ---------- */
  spacesSection: {
    marginBottom: 40,
  },
  spacesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 16,
  },
  spacesTitle: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 22,
    lineHeight: 28,
    color: C.onSurface,
  },
  viewHistoryBtn: {
    fontFamily: 'PlusJakartaSans-SemiBold',
    fontSize: 14,
    lineHeight: 20,
    color: C.primary,
  },
  spacesList: {
    gap: 12,
  },
  spaceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: C.surfaceContainerLow,
    borderRadius: 24,
  },
  appIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  appTextContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  appNameText: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 16,
    lineHeight: 22,
    color: C.onSurface,
    marginBottom: 2,
  },
  appCategoryText: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 13,
    lineHeight: 18,
    color: C.onSurfaceVariant,
  },
  trendContainer: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  trendBadgePill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 4,
  },
  trendBadgeText: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 11,
    lineHeight: 14,
  },
  trendCaption: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 11,
    lineHeight: 14,
    color: C.onSurfaceVariant,
  },

  /* ---------- Narrative Insight Card ---------- */
  narrativeCard: {
    backgroundColor: C.surfaceContainerHigh,
    borderRadius: 32,
    padding: 24,
    position: 'relative',
    overflow: 'hidden',
  },
  watermarkHearthShape: {
    position: 'absolute',
    top: -24,
    right: -24,
    width: 144,
    height: 144,
    borderTopLeftRadius: 85,
    borderTopRightRadius: 55,
    borderBottomLeftRadius: 45,
    borderBottomRightRadius: 100,
    backgroundColor: 'rgba(68, 103, 77, 0.08)', // primary with low opacity
  },
  narrativeLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  narrativeLabelText: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 13,
    lineHeight: 18,
    color: C.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  narrativeTitle: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 22,
    lineHeight: 28,
    color: C.onSurface,
    marginBottom: 12,
  },
  narrativeDesc: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 14,
    lineHeight: 20,
    color: C.onSurfaceVariant,
    marginBottom: 20,
  },
  exploreBtn: {
    backgroundColor: C.primary,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 9999,
    alignSelf: 'flex-start',
    shadowColor: C.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 3,
  },
  exploreBtnText: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 14,
    lineHeight: 20,
    color: C.onPrimary,
  },

  /* ---------- Spacer ---------- */
  bottomSpacer: {
    height: 130,
  },
});