import React from 'react';
import { StyleSheet, View, Text, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AuthColors, AuthFonts, AuthRadius, AuthShadows, AuthSpacing } from '@/constants/auth-theme';

interface InsightCardProps {
  title: string;
  subtitle?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  children: React.ReactNode;
  variant?: 'default' | 'accent' | 'sunken';
  style?: ViewStyle;
  rightAccessory?: React.ReactNode;
}

export function InsightCard({
  title,
  subtitle,
  icon,
  children,
  variant = 'default',
  style,
  rightAccessory,
}: InsightCardProps) {
  const containerStyles = [
    s.card,
    variant === 'accent' && s.cardAccent,
    variant === 'sunken' && s.cardSunken,
    style,
  ];

  return (
    <View style={containerStyles}>
      <View style={s.header}>
        {icon ? (
          <View style={s.iconWrap}>
            <Ionicons name={icon} size={14} color={AuthColors.primary} />
          </View>
        ) : null}
        <Text style={s.title} numberOfLines={1}>
          {title}
        </Text>
        {rightAccessory ?? <View style={s.flex} />}
      </View>
      {subtitle ? <Text style={s.subtitle}>{subtitle}</Text> : null}
      <View style={s.body}>{children}</View>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: AuthColors.surfaceContainerLowest,
    borderRadius: AuthRadius.xl,
    padding: AuthSpacing.lg,
    ...AuthShadows.ambient,
  },
  cardAccent: {
    backgroundColor: AuthColors.primary,
  },
  cardSunken: {
    backgroundColor: AuthColors.surfaceContainerLow,
    ...AuthShadows.ambient,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 4,
  },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: AuthColors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...AuthFonts.titleSmall,
    color: AuthColors.onSurface,
    fontFamily: 'PlusJakartaSans-Bold',
  },
  flex: { flex: 1 },
  subtitle: {
    ...AuthFonts.bodySmall,
    color: AuthColors.onSurfaceVariant,
    marginTop: 2,
    marginBottom: AuthSpacing.md,
  },
  body: {
    marginTop: AuthSpacing.sm,
  },
});
