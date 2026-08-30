import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { AuthColors, AuthFonts, AuthRadius, AuthShadows, AuthSpacing } from '@/constants/auth-theme';
import { AppIcon } from '@/components/app-icon';
import type { SocialMediaStats, SleepDisruptionStats } from '@/lib/notification-analytics';

interface InsightsSocialSleepProps {
  social: SocialMediaStats;
  sleep: SleepDisruptionStats;
}

function severity(pct: number): { label: string; color: string } {
  if (pct < 15) return { label: 'Calm', color: '#2f4a37' };
  if (pct < 30) return { label: 'Moderate', color: '#a8732b' };
  if (pct < 50) return { label: 'High', color: '#a83836' };
  return { label: 'Very high', color: '#7a1d1d' };
}

export function InsightsSocialSleep({ social, sleep }: InsightsSocialSleepProps) {
  const socialSeverity = severity(social.socialPercent);
  const sleepSeverity = severity(sleep.lateNightPercent);

  return (
    <View style={s.row}>
      <View style={[s.tile, s.tileLeft]}>
        <View style={s.tileHeader}>
          <Text style={s.tileTitle}>Social</Text>
        </View>
        <Text style={s.tileValue}>{social.socialCount}</Text>
        <Text style={s.tileSub}>{social.socialPercent}% of all pings</Text>
        <View style={[s.severityPill, { backgroundColor: hexBg(socialSeverity.color) }]}>
          <View style={[s.severityDot, { backgroundColor: socialSeverity.color }]} />
          <Text style={[s.severityText, { color: socialSeverity.color }]}>{socialSeverity.label}</Text>
        </View>
        {social.topSocialApp ? (
          <View style={s.appRow}>
            <AppIcon iconBase64={social.topSocialApp.icon} size={24} fallbackSize={12} />
            <Text style={s.appName} numberOfLines={1}>
              {social.topSocialApp.name}
            </Text>
          </View>
        ) : null}
        <View style={s.divider} />
        <Text style={s.metricLabel}>Late-night social</Text>
        <Text style={s.metricValue}>
          {social.lateNightSocialCount} <Text style={s.metricUnit}>after 10 PM</Text>
        </Text>
      </View>

      <View style={[s.tile, s.tileRight]}>
        <View style={s.tileHeader}>
          <Text style={s.tileTitle}>Sleep</Text>
        </View>
        <Text style={s.tileValue}>{sleep.lateNightCount}</Text>
        <Text style={s.tileSub}>{sleep.lateNightPercent}% after 10 PM</Text>
        <View style={[s.severityPill, { backgroundColor: hexBg(sleepSeverity.color) }]}>
          <View style={[s.severityDot, { backgroundColor: sleepSeverity.color }]} />
          <Text style={[s.severityText, { color: sleepSeverity.color }]}>{sleepSeverity.label}</Text>
        </View>
        {sleep.topLateApp ? (
          <View style={s.appRow}>
            <AppIcon iconBase64={sleep.topLateApp.icon} size={24} fallbackSize={12} />
            <Text style={s.appName} numberOfLines={1}>
              {sleep.topLateApp.name}
            </Text>
          </View>
        ) : null}
        <View style={s.divider} />
        <Text style={s.metricLabel}>Quiet hours</Text>
        <Text style={s.metricValue}>
          10 PM <Text style={s.metricUnit}>·</Text> 6 AM
        </Text>
      </View>
    </View>
  );
}

function hexBg(hex: string): string {
  if (hex.length !== 7) return `${hex}22`;
  return `${hex}1F`;
}

const s = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  tile: {
    flex: 1,
    backgroundColor: AuthColors.surfaceContainerLowest,
    borderRadius: AuthRadius.xl,
    padding: AuthSpacing.md,
    ...AuthShadows.ambient,
  },
  tileLeft: {},
  tileRight: {},
  tileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  tileIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: AuthColors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileTitle: {
    ...AuthFonts.labelLarge,
    color: AuthColors.onSurface,
    fontFamily: 'PlusJakartaSans-Bold',
  },
  tileValue: {
    fontFamily: 'PlusJakartaSans-ExtraBold',
    fontSize: 32,
    color: AuthColors.onSurface,
    letterSpacing: -0.5,
  },
  tileSub: {
    ...AuthFonts.labelMedium,
    color: AuthColors.onSurfaceVariant,
    marginTop: 2,
  },
  severityPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 9999,
    marginTop: 10,
  },
  severityDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  severityText: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 10,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  appRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
  appName: {
    ...AuthFonts.labelMedium,
    color: AuthColors.onSurface,
    flex: 1,
  },
  divider: {
    height: 1,
    backgroundColor: AuthColors.surfaceContainer,
    marginVertical: 12,
  },
  metricLabel: {
    ...AuthFonts.labelSmall,
    color: AuthColors.onSurfaceVariant,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  metricValue: {
    ...AuthFonts.titleMedium,
    color: AuthColors.onSurface,
    fontFamily: 'PlusJakartaSans-Bold',
    marginTop: 2,
  },
  metricUnit: {
    ...AuthFonts.bodySmall,
    color: AuthColors.onSurfaceVariant,
    fontFamily: 'Manrope-Regular',
    fontWeight: '400',
  },
});
