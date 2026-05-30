import React from 'react';
import { StyleSheet, ScrollView, View, TouchableOpacity, Image, Dimensions, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { ThemedView } from '@/components/themed-view';

const { width: SCREEN_W } = Dimensions.get('window');

// ============================================================
// EXACT STITCH COLORS (from HTML Tailwind config)
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

export default function ActivityScreen() {
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
            <TouchableOpacity style={s.iconButton}>
              <Ionicons name="search-outline" size={22} color={C.onSurface} />
            </TouchableOpacity>
            <View style={s.profileWrap}>
              <Image
                source={require('@/assets/images/mother_avatar.jpg')}
                style={s.profileAvatar}
              />
            </View>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={s.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* ========== HERO "HEARTH" HEADER ========== */}
          <View style={s.heroSection}>
            {/* Blurry Background Hearth Gradient Blob */}
            <View style={s.gradientBlobContainer}>
              <LinearGradient
                colors={['rgba(68,103,77,0.08)', 'rgba(197,236,204,0.15)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={s.hearthBlob}
              />
            </View>

            <View style={s.heroContent}>
              <View style={s.heroBadgePill}>
                <Text style={s.heroBadgeText}>Today's Journey</Text>
              </View>
              <Text style={s.heroTitle}>Activity Flow</Text>
              <Text style={s.heroDescription}>
                A calm reflection of recent discoveries, milestones, and gentle boundaries.
              </Text>
            </View>
          </View>

          {/* ========== TIMELINE FEED ========== */}
          <View style={s.timelineContainer}>
            {/* Left timeline path line */}
            <View style={s.timelineLine} />

            {/* Date Marker: Today */}
            <View style={s.dateMarkerRow}>
              <View style={s.dateMarkerPill}>
                <Text style={s.dateMarkerText}>Today, Oct 24</Text>
              </View>
            </View>

            {/* Activity 1: Creative Milestone (Sage Theme) */}
            <View style={s.activityRow}>
              {/* Timeline Icon Node */}
              <View style={s.iconNodeWrap}>
                <View style={[s.iconNodeInner, { backgroundColor: C.primaryContainer }]}>
                  <Ionicons name="color-palette" size={22} color={C.primary} />
                </View>
              </View>

              {/* Activity Card */}
              <View style={s.activityCard}>
                <View style={s.cardHeader}>
                  <Text style={[s.cardSubLabel, { color: C.primary }]}>Creative Milestone</Text>
                  <View style={s.timeBadgePill}>
                    <Text style={s.timeBadgeText}>10:30 AM</Text>
                  </View>
                </View>
                <Text style={s.cardTitle}>Art Studio Pro</Text>
                <Text style={s.cardDesc}>
                  Spent 45 minutes exploring watercolor techniques. A new digital canvas was completed, showing excellent focus and color coordination.
                </Text>
                <View style={s.cardActions}>
                  <TouchableOpacity style={s.actionBtn}>
                    <Text style={s.actionBtnText}>View Artwork</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* Activity 2: Educational Peak (Sage/Cream Theme) */}
            <View style={s.activityRow}>
              {/* Timeline Icon Node */}
              <View style={s.iconNodeWrap}>
                <View style={[s.iconNodeInner, { backgroundColor: C.tertiaryContainer }]}>
                  <Ionicons name="book" size={20} color={C.primary} />
                </View>
              </View>

              {/* Activity Card */}
              <View style={s.activityCard}>
                <View style={s.cardHeader}>
                  <Text style={[s.cardSubLabel, { color: C.primary }]}>Educational Peak</Text>
                  <View style={s.timeBadgePill}>
                    <Text style={s.timeBadgeText}>1:15 PM</Text>
                  </View>
                </View>
                <Text style={s.cardTitle}>StoryTime Academy</Text>
                <Text style={s.cardDesc}>
                  Completed the 'Deep Sea Explorers' reading module. Comprehension scores indicate high engagement with narrative structures.
                </Text>

                {/* Remote Illustration Image */}
                <View style={s.illustrationWrapper}>
                  <Image
                    source={{ uri: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAcUL_qSzwBS1Ow3NG_4KJoDAcoX6W9VUIkrcUF3R0wye_Qkeql7C2FUxGp2dPlbcPVsWbBnudSNhW1AqEh6EthW9HwuFlJdTSynYC1agbmqdB7q9a7U3KCwqFSMT7nFkS5FU1f3BISvvwh_kxXc7OtMIZtj6o2UhbYO7znclxCJmjOUF4lipU9Bw4i6supDl_r6SV95w4qNw7rNqvyQszy9XMsUn1IC0CeA6N61mxHXtMOnfhHbBIEWGdgBBkfca1eijWnQ6Bapg4' }}
                    style={s.illustrationImage}
                  />
                </View>
              </View>
            </View>

            {/* Activity 3: Balanced Boundary (Terracotta Theme) */}
            <View style={s.activityRow}>
              {/* Timeline Icon Node */}
              <View style={s.iconNodeWrap}>
                <View style={[s.iconNodeInner, { backgroundColor: C.secondaryContainer }]}>
                  <Ionicons name="moon" size={20} color={C.secondary} />
                </View>
              </View>

              {/* Activity Card - Surface low bg, outlined border */}
              <View style={[s.activityCard, s.activityCardOutlined]}>
                <View style={s.cardHeader}>
                  <Text style={[s.cardSubLabel, { color: C.secondary }]}>Balanced Boundary</Text>
                  <View style={s.timeBadgePill}>
                    <Text style={s.timeBadgeText}>4:00 PM</Text>
                  </View>
                </View>
                <Text style={s.cardTitle}>Social Media Wind-down</Text>
                <Text style={s.cardDesc}>
                  Daily allocation for social applications was gently concluded. Device successfully transitioned to focus mode.
                </Text>
              </View>
            </View>

            {/* Date Marker: Yesterday */}
            <View style={[s.dateMarkerRow, { marginTop: 24 }]}>
              <View style={[s.dateMarkerPill, s.dateMarkerPillYesterday]}>
                <Text style={[s.dateMarkerText, { color: C.onSurfaceVariant }]}>Yesterday, Oct 23</Text>
              </View>
            </View>

            {/* Activity 4: Neutral (Cream Theme) */}
            <View style={[s.activityRow, s.activityRowYesterday]}>
              {/* Timeline Icon Node */}
              <View style={s.iconNodeWrap}>
                <View style={[s.iconNodeInner, { backgroundColor: C.surfaceContainer }]}>
                  <Ionicons name="headset" size={20} color={C.onSurfaceVariant} />
                </View>
              </View>

              {/* Minimal Activity Item */}
              <View style={s.activityCardMinimal}>
                <View style={s.cardHeaderMinimal}>
                  <Text style={s.cardTitleMinimal}>Audio Listening</Text>
                  <Text style={s.timeTextMinimal}>2:30 PM</Text>
                </View>
                <Text style={s.cardDescMinimal}>Listened to 'Classical Focus' playlist for 30 mins.</Text>
              </View>
            </View>
          </View>

          {/* Bottom padding spacing */}
          <View style={s.bottomSpacer} />
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

// ============================================================
// STYLES — mapped precisely from Stitch Tailwinds
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
    backgroundColor: C.surfaceContainerLow,
    justifyContent: 'center',
    alignItems: 'center',
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

  /* ---------- Hero Hearth Header ---------- */
  heroSection: {
    position: 'relative',
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 16,
    marginBottom: 24,
  },
  gradientBlobContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    zIndex: 0,
  },
  hearthBlob: {
    width: SCREEN_W * 1.1,
    height: 180,
    borderRadius: 90,
    opacity: 0.7,
  },
  heroContent: {
    zIndex: 1,
    alignItems: 'center',
    gap: 12,
  },
  heroBadgePill: {
    backgroundColor: C.surfaceContainer,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 9999,
    shadowColor: '#363228',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 16,
  },
  heroBadgeText: {
    fontFamily: 'PlusJakartaSans-SemiBold',
    fontSize: 12,
    lineHeight: 16,
    color: C.primary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  heroTitle: {
    fontFamily: 'PlusJakartaSans-ExtraBold',
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
    textAlign: 'center',
    maxWidth: 280,
  },

  /* ---------- Timeline Feed ---------- */
  timelineContainer: {
    position: 'relative',
    marginLeft: 8,
    paddingLeft: 24,
  },
  timelineLine: {
    position: 'absolute',
    left: 2,
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: C.surfaceContainerHigh,
    zIndex: 0,
  },
  dateMarkerRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    marginLeft: -44,
    marginBottom: 24,
    zIndex: 2,
  },
  dateMarkerPill: {
    backgroundColor: 'rgba(255, 248, 240, 0.75)',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 9999,
    shadowColor: '#363228',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 32,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  dateMarkerPillYesterday: {
    shadowColor: '#363228',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 16,
  },
  dateMarkerText: {
    fontFamily: 'PlusJakartaSans-SemiBold',
    fontSize: 14,
    lineHeight: 20,
    color: C.onSurface,
  },

  /* Activity Row */
  activityRow: {
    flexDirection: 'row',
    marginBottom: 32,
    position: 'relative',
  },
  activityRowYesterday: {
    opacity: 0.7,
    marginBottom: 24,
  },
  iconNodeWrap: {
    position: 'absolute',
    left: -44,
    top: 4,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: C.surfaceContainerLowest,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
    shadowColor: '#363228',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 32,
  },
  iconNodeInner: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },

  /* Activity Card */
  activityCard: {
    flex: 1,
    backgroundColor: C.surfaceContainerLowest,
    borderRadius: 28,
    padding: 20,
    shadowColor: '#363228',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.04,
    shadowRadius: 40,
    elevation: 2,
  },
  activityCardOutlined: {
    backgroundColor: C.surfaceContainerLow,
    borderWidth: 1,
    borderColor: 'rgba(245, 237, 224, 0.5)',
    shadowColor: '#363228',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.02,
    shadowRadius: 24,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardSubLabel: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 12,
    lineHeight: 16,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  timeBadgePill: {
    backgroundColor: C.surfaceContainerLow,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 9999,
  },
  timeBadgeText: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 12,
    lineHeight: 16,
    color: C.onSurfaceVariant,
  },
  cardTitle: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 20,
    lineHeight: 26,
    color: C.onSurface,
    marginBottom: 8,
  },
  cardDesc: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 15,
    lineHeight: 22,
    color: C.onSurfaceVariant,
  },
  cardActions: {
    marginTop: 16,
    flexDirection: 'row',
  },
  actionBtn: {
    backgroundColor: C.surfaceContainerLow,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 9999,
  },
  actionBtnText: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 13,
    lineHeight: 18,
    color: C.onSurface,
  },

  /* Remote Illustration */
  illustrationWrapper: {
    marginTop: 16,
    borderRadius: 16,
    overflow: 'hidden',
    height: 120,
    backgroundColor: C.surfaceContainerLow,
  },
  illustrationImage: {
    width: '100%',
    height: '100%',
    opacity: 0.85,
  },

  /* Minimal activity card */
  activityCardMinimal: {
    flex: 1,
    paddingVertical: 8,
    paddingLeft: 8,
  },
  cardHeaderMinimal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  cardTitleMinimal: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 16,
    lineHeight: 22,
    color: C.onSurface,
  },
  timeTextMinimal: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 12,
    color: C.onSurfaceVariant,
  },
  cardDescMinimal: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 14,
    lineHeight: 20,
    color: C.onSurfaceVariant,
  },

  /* Bottom Spacer */
  bottomSpacer: {
    height: 130,
  },
});