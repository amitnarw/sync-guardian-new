import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { AuthColors, AuthFonts } from '@/constants/auth-theme';
import { ChildSelector, type ChildOption } from '@/components/ui/child-selector';

interface InsightsHeaderProps {
  childOptions: ChildOption[];
  selectedChildId: string | null;
  onSelect: (childId: string | null) => void;
  subtitle: string;
  disabled?: boolean;
}

export function InsightsHeader({
  childOptions,
  selectedChildId,
  onSelect,
  subtitle,
  disabled,
}: InsightsHeaderProps) {
  return (
    <View style={[s.row, disabled && s.rowDisabled]}>
      <View style={s.text}>
        <Text style={s.title}>Insights</Text>
        <Text style={s.subtitle} numberOfLines={2}>
          {subtitle}
        </Text>
      </View>
      {childOptions.length > 0 ? (
        <ChildSelector
          options={childOptions}
          selectedChildUserId={selectedChildId}
          onSelect={onSelect}
          showAllOption
          allLabel={`All Children (${childOptions.length})`}
          variant="icon"
          disabled={disabled}
        />
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 16,
  },
  rowDisabled: {
    opacity: 0.5,
  },
  text: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontFamily: 'PlusJakartaSans-ExtraBold',
    fontSize: 36,
    lineHeight: 42,
    letterSpacing: -0.5,
    color: AuthColors.onSurface,
  },
  subtitle: {
    ...AuthFonts.bodyMedium,
    color: AuthColors.onSurfaceVariant,
    maxWidth: 320,
  },
});
