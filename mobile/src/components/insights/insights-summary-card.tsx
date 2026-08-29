import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { AuthColors, AuthFonts, AuthRadius, AuthSpacing, AuthShadows, AuthGradients } from '@/constants/auth-theme';
import type { SummaryStats } from '@/lib/notification-analytics';

interface InsightsSummaryCardProps {
  stats: SummaryStats;
  childLabel: string | null;
}

function formatTrendLabel(deltaPercent: number, direction: 'up' | 'down' | 'flat'): string {
  if (direction === 'flat') return 'Same as before';
  const abs = Math.abs(deltaPercent);
  return `${abs}%`;
}

function TrendIcon({ direction }: { direction: 'up' | 'down' | 'flat' }) {
  const color = direction === 'down' ? '#2f4a37' : direction === 'up' ? '#a83836' : AuthColors.onSurfaceVariant;
  const name = direction === 'flat' ? 'remove' : direction === 'up' ? 'trending-up' : 'trending-down';
  return <Ionicons name={name} size={12} color={color} />;
}

export function InsightsSummaryCard({ stats, childLabel }: InsightsSummaryCardProps) {
  const subjectLabel = childLabel ? `${childLabel}'s activity` : 'Across all children';
  const topAppName = stats.topApp?.name ?? '—';
  const peakLabel = stats.peakBucket?.label ?? '—';

  return (
    <View style={s.card}>
      <LinearGradient
        colors={AuthGradients.primaryButton}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />

      <View style={s.headerRow}>
        <View style={s.pill}>
          <Ionicons name="sparkles" size={12} color={AuthColors.onPrimary} />
          <Text style={s.pillText}>Executive Summary</Text>
        </View>
        <View style={s.subjectRow}>
          <Ionicons name="person-circle-outline" size={14} color={AuthColors.onPrimary} />
          <Text style={s.subjectText} numberOfLines={1}>
            {subjectLabel}
          </Text>
        </View>
      </View>

      <View style={s.heroStats}>
        <View style={s.heroStat}>
          <Text style={s.heroValue}>{stats.total.toLocaleString()}</Text>
          <Text style={s.heroLabel}>notifications</Text>
        </View>
        <View style={s.heroDivider} />
        <View style={s.heroStat}>
          <Text style={s.heroValue}>{stats.uniqueApps}</Text>
          <Text style={s.heroLabel}>apps</Text>
        </View>
        <View style={s.heroDivider} />
        <View style={s.heroStat}>
          <Text style={s.heroValue}>{stats.velocity.perHour}</Text>
          <Text style={s.heroLabel}>pings/hour</Text>
        </View>
      </View>

      <View style={s.microRow}>
        <View style={s.microItem}>
          <View style={s.microIcon}>
            <Ionicons name="apps" size={12} color={AuthColors.onPrimary} />
          </View>
          <View style={s.microText}>
            <Text style={s.microLabel}>Top app</Text>
            <Text style={s.microValue} numberOfLines={1}>
              {topAppName}
            </Text>
          </View>
        </View>
        <View style={s.microItem}>
          <View style={s.microIcon}>
            <Ionicons name="time" size={12} color={AuthColors.onPrimary} />
          </View>
          <View style={s.microText}>
            <Text style={s.microLabel}>Peak window</Text>
            <Text style={s.microValue} numberOfLines={1}>
              {peakLabel}
            </Text>
          </View>
        </View>
        <View style={s.microItem}>
          <View style={s.microIcon}>
            <TrendIcon direction={stats.trend.direction} />
          </View>
          <View style={s.microText}>
            <Text style={s.microLabel}>vs prior</Text>
            <Text style={s.microValue} numberOfLines={1}>
              {formatTrendLabel(stats.trend.deltaPercent, stats.trend.direction)}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    borderRadius: AuthRadius.xl,
    padding: AuthSpacing.lg,
    overflow: 'hidden',
    backgroundColor: AuthColors.primary,
    ...AuthShadows.float,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: AuthSpacing.md,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: AuthRadius.full,
  },
  pillText: {
    ...AuthFonts.labelSmall,
    color: AuthColors.onPrimary,
    fontFamily: 'PlusJakartaSans-Bold',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  subjectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  subjectText: {
    ...AuthFonts.labelMedium,
    color: AuthColors.onPrimary,
  },
  heroStats: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: AuthSpacing.md,
  },
  heroStat: {
    flex: 1,
    alignItems: 'center',
  },
  heroValue: {
    fontFamily: 'PlusJakartaSans-ExtraBold',
    fontSize: 32,
    lineHeight: 36,
    color: AuthColors.onPrimary,
    letterSpacing: -0.5,
  },
  heroLabel: {
    ...AuthFonts.labelSmall,
    color: AuthColors.onPrimary,
    opacity: 0.85,
    marginTop: 2,
  },
  heroDivider: {
    width: 1,
    height: 36,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
  },
  microRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: AuthRadius.lg,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  microItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  microIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  microText: { flex: 1 },
  microLabel: {
    ...AuthFonts.labelSmall,
    color: AuthColors.onPrimary,
    opacity: 0.78,
  },
  microValue: {
    ...AuthFonts.labelMedium,
    color: AuthColors.onPrimary,
    fontFamily: 'PlusJakartaSans-Bold',
  },
});
