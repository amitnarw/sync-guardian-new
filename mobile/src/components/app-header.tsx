import React from 'react'
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { usePathname } from 'expo-router'
import { UserAvatar } from './user-avatar'
import { useHeaderRefresh } from '@/contexts/HeaderRefreshContext'

const C = {
  primary: '#2f4a37',
  primaryContainer: '#c5eccc',
  onPrimary: '#e8ffea',
  surface: '#fff8f0',
  surfaceContainer: '#f5ede0',
} as const

interface AppHeaderProps {
  role: 'parent' | 'child'
}

export default function AppHeader({ role }: AppHeaderProps) {
  const { refreshMap } = useHeaderRefresh()
  const pathname = usePathname()
  const key = pathname.split('/').filter(Boolean).pop() ?? ''
  const refresh = refreshMap[key] ?? null

  const avatarSource = role === 'parent'
    ? require('@/assets/images/mother_avatar.jpg')
    : require('@/assets/images/leo_avatar.jpg')

  return (
    <View style={s.header}>
      <View style={s.headerLeft}>
        <MaterialCommunityIcons name="spa" size={24} color={C.primary} style={s.headerIcon} />
        <Text style={s.headerTitle}>Sync Guardian</Text>
      </View>
      <View style={s.headerRight}>
        {refresh && (
          <TouchableOpacity onPress={refresh} activeOpacity={0.7} style={s.headerRefreshBtn}>
            <MaterialCommunityIcons name="refresh" size={20} color={C.primary} />
          </TouchableOpacity>
        )}
        <UserAvatar
          fallbackSource={avatarSource}
          role={role}
        />
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 10,
    backgroundColor: 'rgba(255,248,240,0.80)',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerIcon: {
    marginRight: 2,
  },
  headerTitle: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 18,
    lineHeight: 24,
    color: C.primary,
    letterSpacing: -0.5,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  headerRefreshBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: C.surfaceContainer,
    justifyContent: 'center',
    alignItems: 'center',
  },
})
