import React from 'react';
import { StyleSheet, View, Text, Image } from 'react-native';
import { AuthColors, AuthFonts } from '@/constants/auth-theme';
import { InsightCard } from './insight-card';

interface PerChildEntry {
  childUserId: string;
  displayName: string | null;
  count: number;
}

interface InsightsPerChildProps {
  entries: PerChildEntry[];
}

export function InsightsPerChild({ entries }: InsightsPerChildProps) {
  const sorted = [...entries].sort((a, b) => b.count - a.count);
  const max = Math.max(...sorted.map((e) => e.count), 1);

  return (
    <InsightCard
      title="Activity by child"
      subtitle="Comparison across all paired devices"
      icon="people-outline"
    >
      <View style={s.list}>
        {sorted.map((entry) => {
          const widthPct = Math.max((entry.count / max) * 100, 4);
          return (
            <View key={entry.childUserId} style={s.row}>
              <View style={s.avatar}>
                <Image
                  source={require('@/assets/images/leo_avatar.jpg')}
                  style={s.avatarImg}
                />
              </View>
              <View style={s.info}>
                <View style={s.nameRow}>
                  <Text style={s.name} numberOfLines={1}>
                    {entry.displayName || 'Child Device'}
                  </Text>
                  <Text style={s.count}>{entry.count}</Text>
                </View>
                <View style={s.barBg}>
                  <View style={[s.barFill, { width: `${widthPct}%` }]} />
                </View>
              </View>
            </View>
          );
        })}
      </View>
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
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: AuthColors.primaryContainer,
    overflow: 'hidden',
  },
  avatarImg: {
    width: '100%',
    height: '100%',
  },
  info: { flex: 1, gap: 6 },
  nameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  name: {
    ...AuthFonts.labelLarge,
    color: AuthColors.onSurface,
    fontFamily: 'PlusJakartaSans-SemiBold',
    flex: 1,
  },
  count: {
    ...AuthFonts.titleSmall,
    color: AuthColors.onSurface,
    fontFamily: 'PlusJakartaSans-Bold',
  },
  barBg: {
    height: 8,
    borderRadius: 4,
    backgroundColor: AuthColors.surfaceContainer,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: AuthColors.primary,
  },
});
