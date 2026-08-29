import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { AuthColors, AuthFonts, AuthRadius } from '@/constants/auth-theme';
import type { NotificationWindow } from '@/lib/notification-analytics';

interface InsightsWindowSelectorProps {
  window: NotificationWindow;
  onChange: (w: NotificationWindow) => void;
  disabled?: boolean;
}

const OPTIONS: { key: NotificationWindow; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
  { key: 'year', label: 'Year' },
];

export function InsightsWindowSelector({ window, onChange, disabled }: InsightsWindowSelectorProps) {
  return (
    <View style={[s.container, disabled && s.containerDisabled]}>
      {OPTIONS.map((o) => {
        const active = window === o.key;
        return (
          <TouchableOpacity
            key={o.key}
            style={[s.pill, active && s.pillActive]}
            onPress={() => onChange(o.key)}
            activeOpacity={0.7}
            disabled={disabled}
            accessibilityRole="tab"
            accessibilityState={{ selected: active, disabled: !!disabled }}
          >
            <Text style={[s.pillText, active && s.pillTextActive]}>{o.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 8,
    padding: 4,
    backgroundColor: AuthColors.surfaceContainerLow,
    borderRadius: AuthRadius.full,
  },
  containerDisabled: {
    opacity: 0.5,
  },
  pill: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: AuthRadius.full,
    alignItems: 'center',
  },
  pillActive: {
    backgroundColor: AuthColors.primary,
    shadowColor: AuthColors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 3,
  },
  pillText: {
    ...AuthFonts.labelMedium,
    color: AuthColors.onSurfaceVariant,
    fontFamily: 'PlusJakartaSans-SemiBold',
  },
  pillTextActive: {
    color: AuthColors.onPrimary,
  },
});
