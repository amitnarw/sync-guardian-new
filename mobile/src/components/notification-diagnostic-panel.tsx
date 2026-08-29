import React, { useState } from 'react';
import { StyleSheet, TouchableOpacity, View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/hooks/use-auth-store';

const C = {
  primary: '#2f4a37',
  primaryContainer: '#c5eccc',
  onPrimary: '#e8ffea',
  onSurface: '#363228',
  onSurfaceVariant: '#645e53',
  error: '#a83836',
  secondary: '#a0412d',
  outlineVariant: '#b9b1a3',
  surfaceContainerLow: '#faf3e7',
} as const;

export function NotificationDiagnosticPanel() {
  const {
    lastCaptureAt,
    lastCapturePackage,
    lastIngestAt,
    lastIngestError,
    lastIngestDropped,
  } = useAuthStore();
  const [expanded, setExpanded] = useState(false);

  if (!lastCaptureAt && !lastIngestAt && !lastIngestError && !lastIngestDropped) {
    return null;
  }

  const captureTime = lastCaptureAt ? new Date(lastCaptureAt).toLocaleTimeString() : '-';
  const ingestTime = lastIngestAt ? new Date(lastIngestAt).toLocaleTimeString() : '-';

  return (
    <TouchableOpacity onPress={() => setExpanded(!expanded)} activeOpacity={0.7} style={s.panel}>
      <View style={s.header}>
        <Ionicons name="pulse-outline" size={16} color={C.primary} />
        <Text style={s.title}>
          {lastCaptureAt ? 'Capture active' : 'No capture yet'}
        </Text>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={C.onSurfaceVariant} />
      </View>
      {expanded && (
        <View style={s.body}>
          <Text style={s.line}>
            Last capture: {captureTime}{lastCapturePackage ? ` (${lastCapturePackage})` : ''}
          </Text>
          <Text style={s.line}>
            Last ingested: {ingestTime}
          </Text>
          {lastIngestError && (
            <Text style={s.error}>Error: {lastIngestError}</Text>
          )}
          {lastIngestDropped && (
            <Text style={s.warn}>Dropped by server: {lastIngestDropped}</Text>
          )}
          <Text style={s.hint}>
            Tip: Keep app open/backgrounded (don&apos;t force-close).{'\n'}
            WhatsApp must be backgrounded when msg arrives.
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  panel: {
    marginTop: 16,
    backgroundColor: C.surfaceContainerLow,
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: C.outlineVariant,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    flex: 1,
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 13,
    color: C.onSurface,
  },
  body: {
    marginTop: 10,
    gap: 6,
  },
  line: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 12,
    color: C.onSurfaceVariant,
  },
  error: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 12,
    color: C.error,
  },
  warn: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 12,
    color: C.secondary,
  },
  hint: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 11,
    color: C.onSurfaceVariant,
    lineHeight: 16,
    marginTop: 4,
    opacity: 0.7,
  },
});