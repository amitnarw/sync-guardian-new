import React, { useMemo } from 'react';
import { StyleSheet, View, Text } from 'react-native';
import type { InsightsNotification } from '@/hooks/use-insights-data';
import { InsightCard } from './insight-card';

interface InsightsHeatmapProps {
  notifications: InsightsNotification[];
}

const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const SLOTS = [
  { key: 'AM', label: 'AM' },
  { key: 'Noon', label: 'Noon' },
  { key: 'PM', label: 'PM' },
];

export function InsightsHeatmap({ notifications }: InsightsHeatmapProps) {
  // Compute 7 days x 3 time slots grid
  const { grid, maxCell, total } = useMemo(() => {
    // 7 columns (0=Mon, 1=Tue ... 6=Sun) x 3 rows (0=AM, 1=Noon, 2=PM)
    const matrix: number[][] = [
      [0, 0, 0, 0, 0, 0, 0], // AM (00:00 - 11:59)
      [0, 0, 0, 0, 0, 0, 0], // Noon (12:00 - 16:59)
      [0, 0, 0, 0, 0, 0, 0], // PM (17:00 - 23:59)
    ];

    let max = 0;
    for (const n of notifications) {
      const d = new Date(n.notification_posted_at);
      // JS getDay(): 0=Sun, 1=Mon, ..., 6=Sat
      const jsDay = d.getDay();
      const col = jsDay === 0 ? 6 : jsDay - 1; // Mon=0 .. Sun=6
      const hour = d.getHours();

      let row = 0;
      if (hour >= 17) {
        row = 2; // PM
      } else if (hour >= 12) {
        row = 1; // Noon
      } else {
        row = 0; // AM
      }

      matrix[row][col]++;
      if (matrix[row][col] > max) max = matrix[row][col];
    }

    return { grid: matrix, maxCell: Math.max(max, 1), total: notifications.length };
  }, [notifications]);

  // Map cell count to exact colors from Image 3
  const getCellColor = (count: number, isWeekendPM: boolean) => {
    if (count === 0) return '#ebf0ec';
    const ratio = count / maxCell;

    // Red/Terracotta surge for peak / weekend late hours (matching Image 3)
    if (isWeekendPM && ratio > 0.4) {
      if (ratio > 0.75) return '#9e3828';
      return '#c4715f';
    }

    if (ratio > 0.75) return '#2f4a37'; // Deep forest green
    if (ratio > 0.45) return '#577d63'; // Medium dark sage
    if (ratio > 0.2) return '#8bb397';  // Medium sage
    return '#c8dfcf';                  // Light sage
  };

  return (
    <InsightCard
      title="Activity Heatmap"
      subtitle={
        total > 0
          ? 'Weekly notification density across mornings, noons, and evenings'
          : 'Weekly activity distribution'
      }
    >
      <View style={s.cardBody}>
        {/* Days Header */}
        <View style={s.headerRow}>
          <View style={s.rowLabelSpacer} />
          <View style={s.daysColumns}>
            {DAYS.map((day, i) => (
              <Text key={`day-hdr-${i}`} style={s.dayHeader}>
                {day}
              </Text>
            ))}
          </View>
        </View>

        {/* Heatmap Rows */}
        {SLOTS.map((slot, rowIndex) => (
          <View key={slot.key} style={s.gridRow}>
            {/* Slot Label (AM / Noon / PM) */}
            <Text style={s.slotLabel}>{slot.label}</Text>

            {/* 7 Day Tiles */}
            <View style={s.tilesRow}>
              {DAYS.map((_, colIndex) => {
                const count = grid[rowIndex][colIndex];
                const isWeekend = colIndex >= 4; // Fri, Sat, Sun
                const isWeekendPM = isWeekend && rowIndex === 2;
                const cellBg = getCellColor(count, isWeekendPM);

                return (
                  <View
                    key={`tile-${rowIndex}-${colIndex}`}
                    style={[s.tile, { backgroundColor: cellBg }]}
                  />
                );
              })}
            </View>
          </View>
        ))}
      </View>
    </InsightCard>
  );
}

const s = StyleSheet.create({
  cardBody: {
    paddingTop: 8,
    gap: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowLabelSpacer: {
    width: 44,
  },
  daysColumns: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  dayHeader: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 12,
    color: '#645e53',
    width: 32,
    textAlign: 'center',
  },
  gridRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  slotLabel: {
    width: 44,
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 12,
    color: '#645e53',
  },
  tilesRow: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  tile: {
    width: 32,
    height: 32,
    borderRadius: 8,
  },
});
