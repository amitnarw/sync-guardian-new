import React from 'react';
import { View, Image, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const C = {
  primary: '#44674d',
  surfaceContainerHighest: '#eae1d2',
} as const;

interface AppIconProps {
  iconBase64: string | null | undefined;
  size?: number;
  fallbackSize?: number;
}

export function AppIcon({ iconBase64, size = 40, fallbackSize = 20 }: AppIconProps) {
  if (iconBase64) {
    return (
      <View style={[s.iconBox, { width: size, height: size, borderRadius: size / 2 }]}>
        <Image
          source={{ uri: iconBase64 }}
          style={{ width: size, height: size, borderRadius: size / 2 }}
          resizeMode="cover"
        />
      </View>
    );
  }

  return (
    <View style={[s.iconBox, s.fallback, { width: size, height: size, borderRadius: size / 2 }]}>
      <Ionicons name="apps-outline" size={fallbackSize} color={C.primary} />
    </View>
  );
}

const s = StyleSheet.create({
  iconBox: {
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  fallback: {
    backgroundColor: C.surfaceContainerHighest,
  },
});
