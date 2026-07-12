import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { AppIcon } from '@/components/app-icon';
import { Toggle } from '@/components/ui/toggle';
import { AuthColors, AuthFonts, AuthRadius } from '@/constants/auth-theme';

interface AppFilterRowProps {
  packageName: string;
  name: string;
  iconBase64: string | null;
  enabled: boolean;
  onToggle: (packageName: string) => void;
}

function AppFilterRowImpl({ packageName, name, iconBase64, enabled, onToggle }: AppFilterRowProps) {
  return (
    <View style={styles.row}>
      <AppIcon iconBase64={iconBase64} size={40} fallbackSize={20} />
      <Text style={styles.name} numberOfLines={1} ellipsizeMode="tail">
        {name}
      </Text>
      <Toggle size='sm' value={enabled} onValueChange={() => onToggle(packageName)} />
    </View>
  );
}

export const AppFilterRow = React.memo(AppFilterRowImpl);

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
});
