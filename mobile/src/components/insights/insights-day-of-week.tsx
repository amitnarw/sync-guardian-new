import React, { useMemo } from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { AuthFonts } from '@/constants/auth-theme';
import type { DayOfWeekBucket } from '@/lib/notification-analytics';
import { InsightCard } from './insight-card';

interface InsightsDayOfWeekProps {
  buckets: DayOfWeekBucket[];
}

const C = {
  primary: '#2f4a37',
  trackBg: '#ebe2d5',
  coral: '#c4715f',
  onSurface: '#363228',
  onSurfaceVariant: '#645e53',
} as const;

export function InsightsDayOfWeek({ buckets }: InsightsDayOfWeekProps) {
  const { maxVal, minNonZeroIdx, mostActiveIndex } = useMemo(() => {
    const max = Math.max(...buckets.map((b) => b.count), 1);
    const nonZeros = buckets.filter((b) => b.count > 0);
    const minCount = nonZeros.length > 0 ? Math.min(...nonZeros.map((b) => b.count)) : 0;
    const minIdx = buckets.findIndex((b) => b.count === minCount && b.count > 0);
    const maxIdx = buckets.reduce((best, b, i) => (b.count > buckets[best].count ? i : best), 0);
    return { maxVal: max, minNonZeroIdx: minIdx, mostActiveIndex: maxIdx };
  }, [buckets]);

  const total = buckets.reduce((s, b) => s + b.count, 0);

  return (
    <InsightCard
      title="Day of week"
      subtitle={
        total > 0
          ? `${buckets[mostActiveIndex].label} is the busiest · ${total} pings`
          : 'No activity recorded yet'
      }
    >
      <View style={s.chartContainer}>
        <View style={s.barsRow}>
          {buckets.map((b, i) => {
            const ratio = b.count > 0 ? Math.max(0.18, b.count / maxVal) : 0;
            const isLowest = i === minNonZeroIdx && b.count > 0 && buckets.length > 1;
            const barColor = isLowest ? C.coral : C.primary;

            return (
              <View key={b.label} style={s.col}>
                {/* Capsule Background Track */}
                <View style={s.capsuleTrack}>
                  {b.count > 0 && (
                    <View
                      style={[
                        s.fillPill,
                        {
                          height: `${Math.round(ratio * 100)}%`,
                          backgroundColor: barColor,
                        },
                      ]}
                    />
                  )}
                </View>

                {/* Day Label (M, T, W, T, F, S, S) */}
                <Text style={[s.dayLabel, i === mostActiveIndex && b.count > 0 && s.dayLabelActive]}>
                  {b.short.charAt(0)}
                </Text>
              </View>
            );
          })}
        </View>
      </View>
    </InsightCard>
  );
}

const s = StyleSheet.create({
  chartContainer: {
    paddingTop: 12,
    paddingBottom: 4,
    alignItems: 'center',
  },
  barsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    width: '100%',
    height: 140,
    paddingHorizontal: 4,
  },
  col: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    height: '100%',
    gap: 10,
  },
  capsuleTrack: {
    width: 34,
    height: 110,
    borderRadius: 9999,
    justifyContent: 'flex-end',
    alignItems: 'center',
    overflow: 'hidden',
  },
  fillPill: {
    width: '100%',
    borderRadius: 9999,
    minHeight: 18,
  },
  dayLabel: {
    ...AuthFonts.labelMedium,
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 13,
    color: C.onSurfaceVariant,
  },
  dayLabelActive: {
    color: C.primary,
    fontFamily: 'PlusJakartaSans-ExtraBold',
  },
});
