import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const C = {
  primary: '#2f4a37',
  surfaceContainerLow: '#faf3e7',
  outline: '#807a6d',
  onSurface: '#363228',
  warningBg: '#fff3e0',
  warningText: '#8a5300',
  warningBorder: '#ffe0b2',
} as const;

interface OfflineBannerProps {
  onRetry?: () => void;
  message?: string;
}

export function OfflineBanner({ onRetry, message = "You're offline · Showing cached activity" }: OfflineBannerProps) {
  return (
    <View style={s.container}>
      <View style={s.content}>
        <Ionicons name="cloud-offline-outline" size={16} color={C.warningText} />
        <Text style={s.text} numberOfLines={1}>
          {message}
        </Text>
      </View>
      {onRetry && (
        <TouchableOpacity style={s.retryBtn} onPress={onRetry} activeOpacity={0.7} hitSlop={6}>
          <Text style={s.retryText}>Retry</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: C.warningBg,
    borderWidth: 1,
    borderColor: C.warningBorder,
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 14,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginRight: 8,
  },
  text: {
    fontFamily: 'PlusJakartaSans-SemiBold',
    fontSize: 12,
    color: C.warningText,
    flexShrink: 1,
  },
  retryBtn: {
    backgroundColor: 'rgba(138, 83, 0, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  retryText: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 11,
    color: C.warningText,
  },
});
