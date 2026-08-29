import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AuthColors, AuthFonts } from '@/constants/auth-theme';
import { AppIcon } from '@/components/app-icon';
import { CATEGORY_LABELS, type NewAppEntry } from '@/lib/notification-analytics';
import { InsightCard } from './insight-card';

interface InsightsNewAppsProps {
  newApps: NewAppEntry[];
}

export function InsightsNewApps({ newApps }: InsightsNewAppsProps) {
  return (
    <InsightCard
      title="New apps this window"
      subtitle={
        newApps.length === 0
          ? 'No new apps detected'
          : `${newApps.length} new app${newApps.length === 1 ? '' : 's'} surfaced for the first time`
      }
      icon="sparkles-outline"
    >
      {newApps.length === 0 ? (
        <View style={s.empty}>
          <Ionicons name="leaf-outline" size={28} color={AuthColors.onSurfaceVariant} />
          <Text style={s.emptyText}>Everything in this window was seen before.</Text>
        </View>
      ) : (
        <View style={s.list}>
          {newApps.map((app) => (
            <View key={app.package} style={s.row}>
              <View style={s.iconWrap}>
                <AppIcon iconBase64={app.icon} size={36} fallbackSize={18} />
                <View style={s.newBadge}>
                  <Ionicons name="sparkles" size={9} color="#fff" />
                </View>
              </View>
              <View style={s.info}>
                <Text style={s.appName} numberOfLines={1}>
                  {app.name}
                </Text>
                <Text style={s.appMeta}>
                  {CATEGORY_LABELS[app.category]} · {app.count} ping{app.count === 1 ? '' : 's'}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </InsightCard>
  );
}

const s = StyleSheet.create({
  list: {
    gap: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconWrap: {
    position: 'relative',
  },
  newBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#a83836',
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    flex: 1,
  },
  appName: {
    ...AuthFonts.labelLarge,
    color: AuthColors.onSurface,
    fontFamily: 'PlusJakartaSans-SemiBold',
  },
  appMeta: {
    ...AuthFonts.labelSmall,
    color: AuthColors.onSurfaceVariant,
    marginTop: 2,
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
