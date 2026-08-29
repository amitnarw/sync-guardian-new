import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AuthColors, AuthFonts, AuthRadius, AuthShadows, AuthSpacing } from '@/constants/auth-theme';

interface InsightsNarrativeProps {
  text: string;
  childLabel: string | null;
}

export function InsightsNarrative({ text, childLabel }: InsightsNarrativeProps) {
  return (
    <View style={s.card}>
      <View style={s.header}>
        <View style={s.iconWrap}>
          <Ionicons name="chatbubble-ellipses-outline" size={14} color={AuthColors.primary} />
        </View>
        <Text style={s.label}>
          {childLabel ? `${childLabel}'s story` : 'Family story'}
        </Text>
      </View>
      <Text style={s.body}>{text}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: AuthColors.primaryContainer,
    borderRadius: AuthRadius.xl,
    padding: AuthSpacing.md,
    ...AuthShadows.ambient,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  iconWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: AuthColors.onPrimaryContainer,
  },
  body: {
    ...AuthFonts.bodyMedium,
    color: AuthColors.onPrimaryContainer,
    lineHeight: 22,
  },
});
