import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'

const colors = {
  primary: '#486730',
  primaryContainer: '#87a96b',
  secondary: '#9f402d',
  surface: '#fff8f0',
  surfaceContainerLow: '#f5ede0',
  surfaceContainerLowest: '#ffffff',
  onSurface: '#1b1d0e',
  onSurfaceVariant: '#43483d',
  error: '#9f402d',
}

interface PermissionStatusRowProps {
  label: string
  granted: boolean
  onRequest?: () => void
}

export function PermissionStatusRow({ label, granted, onRequest }: PermissionStatusRowProps) {
  return (
    <View style={styles.row}>
      <View style={styles.left}>
        <View style={[styles.dot, granted ? styles.dotGranted : styles.dotDenied]} />
        <Text style={styles.label}>{label}</Text>
      </View>
      <View style={styles.right}>
        <Text style={[styles.status, granted ? styles.statusGranted : styles.statusDenied]}>
          {granted ? 'Granted' : 'Missing'}
        </Text>
        {!granted && onRequest && (
          <TouchableOpacity onPress={onRequest} style={styles.fixBtn}>
            <Text style={styles.fixText}>Fix</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: 16,
    padding: 16,
    marginBottom: 6,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  dotGranted: {
    backgroundColor: colors.primary,
  },
  dotDenied: {
    backgroundColor: colors.error,
  },
  label: {
    fontFamily: 'PlusJakartaSans-SemiBold',
    fontSize: 14,
    color: colors.onSurface,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  status: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 12,
    lineHeight: 16,
  },
  statusGranted: {
    color: colors.primary,
  },
  statusDenied: {
    color: colors.error,
  },
  fixBtn: {
    backgroundColor: colors.secondary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
  },
  fixText: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 12,
    color: colors.surface,
  },
})
