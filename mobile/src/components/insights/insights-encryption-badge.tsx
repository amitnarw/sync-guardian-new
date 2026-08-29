import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AuthColors, AuthFonts } from '@/constants/auth-theme';

export function InsightsEncryptionBadge() {
  return (
    <View style={s.row}>
      <Ionicons name="shield-checkmark" size={13} color={AuthColors.primary} />
      <Text style={s.text}>All notification contents are securely encrypted at rest</Text>
    </View>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  text: {
    ...AuthFonts.labelSmall,
    color: AuthColors.primary,
  },
});
