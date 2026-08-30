import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AuthColors, AuthFonts } from '@/constants/auth-theme';
import { AppIcon } from '@/components/app-icon';
import { CATEGORY_COLORS, CATEGORY_LABELS, type TopApp } from '@/lib/notification-analytics';
import { InsightCard } from './insight-card';

interface InsightsTopAppsProps {
  apps: TopApp[];
  childLabel: string | null;
}

export function InsightsTopApps({ apps, childLabel }: InsightsTopAppsProps) {
  const subject = childLabel ? childLabel : 'this child';
  return (
    <InsightCard
      title="Top apps"
      subtitle={`Most-notifying apps for ${subject}`}
    >
      {apps.length === 0 ? (
        <View style={s.empty}>
          <Ionicons name="apps-outline" size={28} color={AuthColors.onSurfaceVariant} />
          <Text style={s.emptyText}>No app activity in this window.</Text>
        </View>
      ) : (
        <View style={s.list}>
          {apps.map((app, i) => (
            <View key={app.package + i} style={s.row}>
              <View style={s.rank}>
                <Text style={s.rankText}>{i + 1}</Text>
              </View>
              <AppIcon iconBase64={app.icon} size={36} fallbackSize={18} />
              <View style={s.appInfo}>
                <View style={s.nameRow}>
                  <Text style={s.appName} numberOfLines={1}>
                    {app.name}
                  </Text>
                  <View style={[s.catBadge, { backgroundColor: hexToBg(CATEGORY_COLORS[app.category]) }]}>
                    <Text style={[s.catBadgeText, { color: CATEGORY_COLORS[app.category] }]}>
                      {CATEGORY_LABELS[app.category]}
                    </Text>
                  </View>
                </View>
                <View style={s.barBg}>
                  <View
                    style={[
                      s.barFill,
                      {
                        width: `${Math.max((app.count / Math.max(apps[0].count, 1)) * 100, 6)}%`,
                        backgroundColor: i === 0 ? AuthColors.primary : CATEGORY_COLORS[app.category],
                      },
                    ]}
                  />
                </View>
              </View>
              <View style={s.countWrap}>
                <Text style={s.count}>{app.count}</Text>
                <Text style={s.percent}>{app.percent}%</Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </InsightCard>
  );
}

function hexToBg(hex: string): string {
  if (hex.length !== 7) return `${hex}22`;
  return `${hex}1F`;
}

const s = StyleSheet.create({
  list: {
    gap: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  rank: {
    width: 18,
    alignItems: 'center',
  },
  rankText: {
    ...AuthFonts.labelSmall,
    color: AuthColors.onSurfaceVariant,
    fontFamily: 'PlusJakartaSans-Bold',
  },
  appInfo: {
    flex: 1,
    gap: 6,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  appName: {
    ...AuthFonts.labelLarge,
    color: AuthColors.onSurface,
    fontFamily: 'PlusJakartaSans-SemiBold',
    flexShrink: 1,
  },
  catBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 9999,
  },
  catBadgeText: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 9,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  barBg: {
    height: 9,
    width: '100%',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 9999,
  },
  countWrap: {
    width: 48,
    alignItems: 'flex-end',
  },
  count: {
    ...AuthFonts.titleSmall,
    color: AuthColors.onSurface,
    fontFamily: 'PlusJakartaSans-Bold',
  },
  percent: {
    ...AuthFonts.labelSmall,
    color: AuthColors.onSurfaceVariant,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 8,
  },
  emptyText: {
    ...AuthFonts.bodySmall,
    color: AuthColors.onSurfaceVariant,
  },
});
