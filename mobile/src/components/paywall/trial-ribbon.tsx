import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AuthColors as C, AuthRadius as R } from '@/constants/auth-theme';

interface TrialRibbonProps {
  daysRemaining: number;
}

export function TrialRibbon({ daysRemaining }: TrialRibbonProps) {
  if (daysRemaining <= 0) return null;

  const label =
    daysRemaining === 1
      ? '1 day left in your free trial'
      : `${daysRemaining} days left in your free trial`;

  return (
    <View style={s.ribbon}>
      <View style={s.iconWrap}>
        <Ionicons name="hourglass-outline" size={16} color={C.onTertiaryContainer} />
      </View>
      <Text style={s.text}>{label}</Text>
      <View style={s.pulse} />
    </View>
  );
}

const s = StyleSheet.create({
  ribbon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: C.tertiaryContainer,
    borderRadius: R.full,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignSelf: 'flex-start',
  },
  iconWrap: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontFamily: 'PlusJakartaSans-SemiBold',
    fontSize: 13,
    color: C.onTertiaryContainer,
    letterSpacing: 0.1,
  },
  pulse: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: C.secondary,
  },
});