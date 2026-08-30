import React from 'react';
import { StyleSheet, View, Text, ScrollView, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { SummaryStats, SleepDisruptionStats, TopApp } from '@/lib/notification-analytics';

interface InsightsHighlightsCarouselProps {
  stats: SummaryStats;
  sleep: SleepDisruptionStats;
  topApps: TopApp[];
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = Math.min(SCREEN_WIDTH * 0.76, 300);

export function InsightsHighlightsCarousel({
  stats,
  sleep,
  topApps,
}: InsightsHighlightsCarouselProps) {
  // Estimated quiet / focused screen-free hours recovered
  const quietHoursRecovered = Math.max(
    4,
    Math.round(24 - (stats.total > 0 ? (stats.total / 15) : 0))
  );

  // Active apps count
  const activeAppsCount = topApps.length > 0 ? topApps.length : 1;
  const totalMonitoredApps = Math.max(activeAppsCount, 8);
  const appRatioPercent = Math.min(100, Math.round((activeAppsCount / totalMonitoredApps) * 100));

  // Distraction reduction trend
  const trendPercent = stats.trend?.deltaPercent ?? 0;
  const trendIsDown = trendPercent < 0;
  const trendDisplay = stats.total === 0
    ? '0% change'
    : trendIsDown
    ? `${trendPercent}% pings`
    : `+${trendPercent}% pings`;

  return (
    <View style={s.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.scrollContent}
        decelerationRate="fast"
        snapToInterval={CARD_WIDTH + 14}
      >
        {/* Card 1: Soft Mint ,  Time Recovered */}
        <View style={[s.card, s.cardMint, { width: CARD_WIDTH }]}>
          <View style={s.topRow}>
            <View style={s.iconCircle}>
              <Ionicons name="time-outline" size={18} color="#2f4a37" />
            </View>
          </View>

          <View style={s.cardBody}>
            <Text style={s.titleMint}>Time Recovered</Text>
            <Text style={s.subMint}>Estimated quiet & screen-free hours this window.</Text>
            <Text style={s.statMint}>{quietHoursRecovered} hrs / wk</Text>
          </View>

          {/* Decorative background circle */}
          <View pointerEvents="none" style={s.decorativeCircleMint} />
        </View>

        {/* Card 2: Warm Sand ,  App Variety */}
        <View style={[s.card, s.cardSand, { width: CARD_WIDTH }]}>
          <View style={s.topRow}>
            <View style={s.iconCircle}>
              <Ionicons name="apps-outline" size={18} color="#4a3e2c" />
            </View>
            <View style={s.pillSand}>
              <Text style={s.pillTextSand}>{appRatioPercent}% Active</Text>
            </View>
          </View>

          <View style={s.cardBody}>
            <Text style={s.titleSand}>App Footprint</Text>
            <Text style={s.subSand}>Distribution across monitored child applications.</Text>

            <View style={s.progressSection}>
              <View style={s.progressTrackSand}>
                <View style={[s.progressFillSand, { width: `${appRatioPercent}%` }]} />
              </View>
              <Text style={s.progressLabelSand}>
                {activeAppsCount} Active / {totalMonitoredApps} Monitored
              </Text>
            </View>
          </View>
        </View>

        {/* Card 3: Blush Coral ,  Distraction Reduction */}
        <View style={[s.card, s.cardBlush, { width: CARD_WIDTH }]}>
          <View style={s.topRow}>
            <View style={s.iconCircle}>
              <Ionicons
                name={trendIsDown ? 'trending-down-outline' : 'shield-checkmark-outline'}
                size={18}
                color="#70362b"
              />
            </View>
            <View style={s.pillBlush}>
              <Text style={s.pillTextBlush}>{sleep.lateNightCount} night pings</Text>
            </View>
          </View>

          <View style={s.cardBody}>
            <Text style={s.titleBlush}>Distraction Trend</Text>
            <Text style={s.subBlush}>Volume movement compared to previous period.</Text>
            <Text style={s.statBlush}>{trendDisplay}</Text>
          </View>

          {/* Decorative background circle */}
          <View pointerEvents="none" style={s.decorativeCircleBlush} />
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    marginHorizontal: -20,
    marginVertical: 4,
  },
  scrollContent: {
    paddingHorizontal: 20,
    gap: 14,
    paddingVertical: 4,
  },
  card: {
    borderRadius: 24,
    padding: 18,
    minHeight: 180,
    justifyContent: 'space-between',
    position: 'relative',
    overflow: 'hidden',
  },
  cardMint: {
    backgroundColor: '#d8ebd9',
  },
  cardSand: {
    backgroundColor: '#faefe0',
  },
  cardBlush: {
    backgroundColor: '#fae2dc',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 2,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  pillSand: {
    backgroundColor: '#e6dac7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 9999,
  },
  pillTextSand: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 11,
    color: '#4a3e2c',
  },
  pillBlush: {
    backgroundColor: '#ebd0c8',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 9999,
  },
  pillTextBlush: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 11,
    color: '#70362b',
  },
  cardBody: {
    gap: 4,
    zIndex: 2,
  },
  titleMint: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 16,
    color: '#1f3a28',
  },
  subMint: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 12,
    color: '#44614e',
    lineHeight: 16,
  },
  statMint: {
    fontFamily: 'PlusJakartaSans-ExtraBold',
    fontSize: 22,
    color: '#1f3a28',
    marginTop: 6,
    letterSpacing: -0.5,
  },
  titleSand: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 16,
    color: '#3b3222',
  },
  subSand: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 12,
    color: '#695e4d',
    lineHeight: 16,
  },
  progressSection: {
    gap: 6,
    marginTop: 6,
  },
  progressTrackSand: {
    height: 8,
    backgroundColor: '#e8dcce',
    borderRadius: 9999,
    overflow: 'hidden',
  },
  progressFillSand: {
    height: '100%',
    backgroundColor: '#3b3222',
    borderRadius: 9999,
  },
  progressLabelSand: {
    fontFamily: 'PlusJakartaSans-SemiBold',
    fontSize: 11,
    color: '#4a3e2c',
  },
  titleBlush: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 16,
    color: '#452119',
  },
  subBlush: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 12,
    color: '#704b43',
    lineHeight: 16,
  },
  statBlush: {
    fontFamily: 'PlusJakartaSans-ExtraBold',
    fontSize: 22,
    color: '#452119',
    marginTop: 6,
    letterSpacing: -0.5,
  },
  decorativeCircleMint: {
    position: 'absolute',
    right: -25,
    bottom: -25,
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
  },
  decorativeCircleBlush: {
    position: 'absolute',
    right: -25,
    bottom: -25,
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
  },
});
