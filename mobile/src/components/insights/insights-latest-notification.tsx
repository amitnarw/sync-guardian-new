import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AuthColors, AuthFonts, AuthRadius, AuthShadows, AuthSpacing } from '@/constants/auth-theme';
import { AppIcon } from '@/components/app-icon';

interface InsightsLatestNotificationProps {
  appName: string | null;
  iconBase64: string | null;
  title: string;
  timeAgo: string;
}

export function InsightsLatestNotification({
  appName,
  iconBase64,
  title,
  timeAgo,
}: InsightsLatestNotificationProps) {
  return (
    <View style={s.card}>
      <AppIcon iconBase64={iconBase64} size={40} fallbackSize={20} />
      <View style={s.body}>
        <Text style={s.label}>LATEST NOTIFICATION</Text>
        <Text style={s.title} numberOfLines={1}>
          {title}
        </Text>
      </View>
      <View style={s.right}>
        {appName ? (
          <View style={s.appPill}>
            <Ionicons name="notifications-outline" size={11} color={AuthColors.primary} />
            <Text style={s.appPillText} numberOfLines={1}>
              {appName}
            </Text>
          </View>
        ) : null}
        <Text style={s.time}>{timeAgo}</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: AuthColors.surfaceContainerLow,
    borderRadius: AuthRadius.lg,
    paddingVertical: AuthSpacing.md,
    paddingHorizontal: AuthSpacing.md,
    ...AuthShadows.ambient,
  },
  body: { flex: 1, gap: 2 },
  label: {
    ...AuthFonts.labelSmall,
    color: AuthColors.onSurfaceVariant,
    letterSpacing: 0.8,
  },
  title: {
    ...AuthFonts.labelLarge,
    color: AuthColors.onSurface,
    fontFamily: 'PlusJakartaSans-SemiBold',
  },
  right: {
    alignItems: 'flex-end',
    gap: 4,
  },
  appPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 9999,
    backgroundColor: AuthColors.primaryContainer,
    maxWidth: 110,
  },
  appPillText: {
    ...AuthFonts.labelSmall,
    color: AuthColors.primary,
    fontFamily: 'PlusJakartaSans-Bold',
  },
  time: {
    ...AuthFonts.labelSmall,
    color: AuthColors.onSurfaceVariant,
  },
});
