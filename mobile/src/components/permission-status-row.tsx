import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'

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
  description: string
  granted: boolean
  onRequest?: () => void
}

export function PermissionStatusRow({ label, description, granted, onRequest }: PermissionStatusRowProps) {
  const tappable = !granted && !!onRequest

  const content = (
    <View style={styles.inner}>
      <View style={styles.left}>
        <View style={[styles.iconWrap, granted ? styles.iconGranted : styles.iconDenied]}>
          <MaterialIcons
            name={granted ? 'check' : 'warning'}
            size={18}
            color={granted ? '#ffffff' : '#ffffff'}
          />
        </View>
        <View style={styles.textWrap}>
          <Text style={styles.label}>{label}</Text>
          <Text style={styles.description}>{description}</Text>
        </View>
      </View>
      <View style={styles.right}>
        {granted ? (
          <View style={styles.grantedBadge}>
            <Text style={styles.grantedText}>Granted</Text>
          </View>
        ) : (
          <TouchableOpacity onPress={onRequest} activeOpacity={0.8} style={styles.fixBtn}>
            <Text style={styles.fixText}>Fix</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  )

  if (tappable) {
    return (
      <TouchableOpacity onPress={onRequest} activeOpacity={0.8} style={styles.row}>
        {content}
      </TouchableOpacity>
    )
  }

  return <View style={styles.row}>{content}</View>
}

const styles = StyleSheet.create({
  row: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 999,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconGranted: {
    backgroundColor: colors.primary,
  },
  iconDenied: {
    backgroundColor: colors.error,
  },
  textWrap: {
    flex: 1,
  },
  label: {
    fontFamily: 'PlusJakartaSans-SemiBold',
    fontSize: 15,
    color: colors.onSurface,
  },
  description: {
    fontFamily: 'Manrope-Medium',
    fontSize: 12,
    color: colors.onSurfaceVariant,
    marginTop: 2,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: 10
  },
  grantedBadge: {
    backgroundColor: '#e3ecd8',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  grantedText: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 12,
    color: colors.primary,
  },
  fixBtn: {
    backgroundColor: colors.secondary,
    paddingHorizontal: 22,
    paddingVertical: 10,
    borderRadius: 999,
  },
  fixText: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 13,
    color: colors.surface,
  },
})
