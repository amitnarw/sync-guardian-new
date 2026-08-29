import React, { useMemo } from 'react';
import { StyleSheet, View, Text } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { CATEGORY_COLORS, CATEGORY_LABELS, type CategorySlice } from '@/lib/notification-analytics';
import { InsightCard } from './insight-card';

interface InsightsCategoryDonutProps {
  slices: CategorySlice[];
  total: number;
}

const GAUGE_SIZE = 92;
const STROKE_WIDTH = 9;
const RADIUS = (GAUGE_SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function InsightsCategoryDonut({ slices, total }: InsightsCategoryDonutProps) {
  const topCategory = slices[0];
  const topPercent = topCategory ? topCategory.percent : 0;

  // Usage balance score (healthy balance between communication vs passive distraction)
  const balancePercentage = useMemo(() => {
    if (total === 0 || !topCategory) return 0;
    return topPercent;
  }, [total, topCategory, topPercent]);

  const strokeDashoffset = useMemo(() => {
    const fraction = Math.min(1, Math.max(0, balancePercentage / 100));
    return CIRCUMFERENCE * (1 - fraction);
  }, [balancePercentage]);

  const targetLabel = useMemo(() => {
    if (balancePercentage <= 40) return 'Target reach: Balanced';
    if (balancePercentage <= 75) return 'Target reach: Optimal';
    return 'Target reach: High Concentration';
  }, [balancePercentage]);

  return (
    <InsightCard
      title="Where attention goes"
      subtitle={topCategory ? `${CATEGORY_LABELS[topCategory.category]} represents ${topCategory.percent}% of activity` : 'Category breakdown'}
      icon="pie-chart-outline"
    >
      <View style={s.cardBody}>
        {/* Top Hero Row (Exact Layout of Image 2) */}
        <View style={s.heroRow}>
          <View style={s.metricBlock}>
            <Text style={s.categoryUppercase}>USAGE BALANCE</Text>
            <Text style={s.metricValue}>{balancePercentage}%</Text>
            <Text style={s.targetReachText}>{targetLabel}</Text>
          </View>

          {/* Circular Ring Gauge */}
          <View style={s.gaugeWrap}>
            <Svg width={GAUGE_SIZE} height={GAUGE_SIZE}>
              <G rotation="-90" origin={`${GAUGE_SIZE / 2}, ${GAUGE_SIZE / 2}`}>
                {/* Background sand circle */}
                <Circle
                  cx={GAUGE_SIZE / 2}
                  cy={GAUGE_SIZE / 2}
                  r={RADIUS}
                  stroke="#eae1d2"
                  strokeWidth={STROKE_WIDTH}
                  fill="transparent"
                />
                {/* Active forest green arc */}
                {balancePercentage > 0 && (
                  <Circle
                    cx={GAUGE_SIZE / 2}
                    cy={GAUGE_SIZE / 2}
                    r={RADIUS}
                    stroke="#2f4a37"
                    strokeWidth={STROKE_WIDTH}
                    strokeDasharray={`${CIRCUMFERENCE} ${CIRCUMFERENCE}`}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                    fill="transparent"
                  />
                )}
              </G>
            </Svg>

            {/* Center Leaf Icon */}
            <View style={s.gaugeCenterIcon}>
              <Ionicons name="leaf-outline" size={20} color="#2f4a37" />
            </View>
          </View>
        </View>

        {/* Category Pill Badges Breakdown */}
        <View style={s.pillList}>
          {slices.slice(0, 4).map((slice) => (
            <View key={slice.category} style={s.categoryPill}>
              <View style={[s.pillDot, { backgroundColor: CATEGORY_COLORS[slice.category] }]} />
              <Text style={s.pillName} numberOfLines={1}>
                {CATEGORY_LABELS[slice.category]}
              </Text>
              <Text style={s.pillPercent}>{slice.percent}%</Text>
            </View>
          ))}
        </View>
      </View>
    </InsightCard>
  );
}

const s = StyleSheet.create({
  cardBody: {
    gap: 16,
    paddingTop: 4,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingRight: 8,
  },
  metricBlock: {
    flex: 1,
    gap: 4,
  },
  categoryUppercase: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 12,
    color: '#363228',
    letterSpacing: 0.8,
  },
  metricValue: {
    fontFamily: 'PlusJakartaSans-ExtraBold',
    fontSize: 32,
    color: '#2f4a37',
    letterSpacing: -0.5,
  },
  targetReachText: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 13,
    color: '#645e53',
  },
  gaugeWrap: {
    width: GAUGE_SIZE,
    height: GAUGE_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  gaugeCenterIcon: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: 'rgba(47, 74, 55, 0.08)',
  },
  categoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#faf3e7',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 9999,
  },
  pillDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  pillName: {
    fontFamily: 'PlusJakartaSans-SemiBold',
    fontSize: 12,
    color: '#363228',
  },
  pillPercent: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 12,
    color: '#645e53',
  },
});
