import React from 'react';
import { StyleSheet, View, Text, Pressable, Switch } from 'react-native';
import { AppIcon } from '@/components/app-icon';
import { AuthColors, AuthFonts, AuthRadius } from '@/constants/auth-theme';

interface AppFilterRowProps {
  name: string;
  iconBase64: string | null;
  enabled: boolean;
  onToggle: () => void;
}

export function AppFilterRow({ name, iconBase64, enabled, onToggle }: AppFilterRowProps) {
  return (
    <View style={styles.row}>
      <AppIcon iconBase64={iconBase64} size={40} fallbackSize={20} />
      <Text style={styles.name} numberOfLines={1} ellipsizeMode="tail">
        {name}
      </Text>
      <Switch
        value={enabled}
        onValueChange={onToggle}
        trackColor={{ false: AuthColors.surfaceContainer, true: AuthColors.primaryContainer }}
        thumbColor={enabled ? AuthColors.primary : '#ffffff'}
        ios_backgroundColor={AuthColors.surfaceContainer}
        style={styles.switch}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: AuthColors.surfaceContainerLowest,
    borderRadius: AuthRadius.lg,
  },
  name: {
    ...AuthFonts.titleMedium,
    color: AuthColors.onSurface,
    flex: 1,
  },
  switch: {
    transform: [{ scale: 0.9 }],
  },
});
