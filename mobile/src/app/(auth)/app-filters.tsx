import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
  BackHandler,
  ListRenderItem,
} from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { MaterialIcons } from '@expo/vector-icons'
import { useAuthStore } from '@/hooks/use-auth-store'
import { supabase } from '@/lib/supabase'
import { logger } from '@/services/logger'
import { Skeleton } from '@/components/ui/skeleton'
import { AuthColors, AuthFonts, AuthRadius, AuthShadows } from '@/constants/auth-theme'
import { Button } from '@/components/ui/button'
import { AppFilterRow } from '@/components/app-filter-row'
import { EnableDisableToggle } from '@/components/ui/enable-disable-toggle'
import { useAppModal } from '@/hooks/use-app-modal'
import { EdgeFadeFlatList } from '@/components/ui/edge-fade'

interface AppFilter {
  package_name: string
  app_name: string | null
  app_icon_base64: string | null
  is_enabled: boolean
}

export default function AppFiltersScreen() {
  const { pairId: storePairId } = useAuthStore()
  const params = useLocalSearchParams()
  const paramPairId = typeof params.pairId === 'string' ? params.pairId : null
  const pairId = paramPairId ?? storePairId
  const isReentry = !!paramPairId
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [apps, setApps] = useState<AppFilter[]>([])
  const [childDeviceId, setChildDeviceId] = useState<string | null>(null)
  const [childDeviceName, setChildDeviceName] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const { showModal } = useAppModal()

  const load = useCallback(async () => {
    try {
      setError(null)
      if (!pairId) throw new Error('Pairing information is missing.')

      const { data: pair, error: pairErr } = await supabase
        .from('pairs')
        .select('child_device_id, child_user_id')
        .eq('id', pairId)
        .single()

      if (pairErr || !pair?.child_device_id) {
        throw new Error(`Could not find the linked child device. ${pairErr?.message ?? ''}`.trim())
      }
      setChildDeviceId(pair.child_device_id)

      const { data: profile, error: profileErr } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('id', pair.child_user_id)
        .maybeSingle()
      if (!profileErr && profile) {
        setChildDeviceName((profile as any).display_name ?? null)
      }

      const { data: filters, error: filterErr } = await supabase
        .from('child_app_filters')
        .select('package_name, app_name, app_icon_base64, is_enabled')
        .eq('child_device_id', pair.child_device_id)
        .order('app_name', { ascending: true, nullsFirst: false })

      if (filterErr) throw new Error(`Failed to load app filters. ${filterErr.message}`)

      setApps(
        (filters ?? []).map((f) => ({
          package_name: f.package_name,
          app_name: f.app_name,
          app_icon_base64: f.app_icon_base64,
          is_enabled: f.is_enabled,
        })),
      )
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Something went wrong.'
      logger.error('AppFilters: load failed', msg)
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [pairId])

  useEffect(() => {
    load()
  }, [load])

  const childLabel = childDeviceName ? `${childDeviceName}'s` : 'Your child’s'

  const confirmLeave = useCallback(() => {
    if (isReentry) {
      router.back()
      return
    }
    showModal({
      title: 'Finish setup later?',
      message: `${childLabel} device is waiting. You can choose apps now to start monitoring, or come back later from the dashboard.`,
      icon: 'warning',
      primaryButton: 'Stay here',
      secondaryButton: 'Leave',
      onSecondaryPress: () => router.replace('/(tabs)/home'),
    })
  }, [isReentry, childLabel, showModal])

  useEffect(() => {
    const onBack = () => {
      confirmLeave()
      return true
    }
    const sub = BackHandler.addEventListener('hardwareBackPress', onBack)
    return () => sub.remove()
  }, [confirmLeave])

  const toggle = useCallback((pkg: string) => {
    setApps((prev) => prev.map((a) => (a.package_name === pkg ? { ...a, is_enabled: !a.is_enabled } : a)))
  }, [])

  const setAll = (value: boolean) => {
    setApps((prev) => prev.map((a) => ({ ...a, is_enabled: value })))
  }

  const enabledCount = useMemo(() => apps.filter((a) => a.is_enabled).length, [apps])

  const allEnabled = apps.length > 0 && apps.every((a) => a.is_enabled)

  const filteredApps = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return apps
    return apps.filter((a) => {
      const name = (a.app_name || a.package_name).toLowerCase()
      return name.includes(q) || a.package_name.toLowerCase().includes(q)
    })
  }, [apps, searchQuery])

  const renderItem = useCallback<ListRenderItem<AppFilter>>(
    ({ item }) => (
      <AppFilterRow
        packageName={item.package_name}
        name={item.app_name || item.package_name}
        iconBase64={item.app_icon_base64}
        enabled={item.is_enabled}
        onToggle={toggle}
      />
    ),
    [toggle],
  )

  const handleSave = async () => {
    if (!childDeviceId) return
    try {
      setSaving(true)
      const { error: saveErr } = await supabase.functions.invoke('update-app-filters', {
        body: {
          child_device_id: childDeviceId,
          changes: apps.map((a) => ({ package_name: a.package_name, is_enabled: a.is_enabled })),
        },
      })
      if (saveErr) throw saveErr
      if (isReentry) {
        router.back()
      } else {
        router.replace('/onboarding')
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not save your selections.'
      logger.error('AppFilters: save failed', msg)
      showModal({ title: 'Save Failed', message: msg, icon: 'error', primaryButton: 'Got it' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <MaterialIcons name="spa" size={24} color={AuthColors.primary} />
          <Text style={styles.headerTitle}>Choose Apps</Text>
        </View>
        <Text style={styles.headerCount}>
          {enabledCount}/{apps.length} selected
        </Text>
      </View>

      <View style={styles.waitingBanner}>
        <MaterialIcons name="hourglass-top" size={20} color={AuthColors.onPrimary} />
        <Text style={styles.waitingBannerText}>
          {childLabel} device is waiting. Pick at least one app to start monitoring.
        </Text>
      </View>

      {loading ? (
        <View style={{ flex: 1, gap: 16, paddingHorizontal: 24, paddingTop: 16 }}>
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 16, height: 60 }}>
              <Skeleton width={40} height={40} borderRadius={12} />
              <View style={{ flex: 1, gap: 6 }}>
                <Skeleton width={140} height={16} borderRadius={8} />
                <Skeleton width={200} height={12} borderRadius={6} />
              </View>
              <Skeleton width={32} height={20} borderRadius={10} />
            </View>
          ))}
        </View>
      ) : error ? (
        <View style={styles.centerState}>
          <Text style={styles.errorText}>{error}</Text>
          <Button title="Retry" onPress={load} style={styles.retryBtn} />
        </View>
      ) : apps.length === 0 ? (
        <View style={styles.centerState}>
          <Text style={styles.errorText}>No apps were found on the child device yet.</Text>
          <Button
            title="Continue"
            onPress={() => (isReentry ? router.back() : router.replace('/onboarding'))}
            style={styles.retryBtn}
          />
        </View>
      ) : (
        <>
          <View style={styles.controlsRow}>
            <View style={styles.searchCard}>
              <MaterialIcons name="search" size={20} color={AuthColors.onSurfaceVariant} style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search apps…"
                placeholderTextColor={AuthColors.onSurfaceVariant}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')} activeOpacity={0.7} style={styles.searchClear}>
                  <MaterialIcons name="close" size={18} color={AuthColors.onSurfaceVariant} />
                </TouchableOpacity>
              )}
            </View>

            <EnableDisableToggle
              value={allEnabled ? 'enabled' : 'disabled'}
              onChange={(v) => setAll(v === 'enabled')}
            />
          </View>

          {filteredApps.length === 0 ? (
            <View style={styles.centerState}>
              <Text style={styles.errorText}>No apps match “{searchQuery}”.</Text>
            </View>
          ) : (
            <EdgeFadeFlatList
              data={filteredApps}
              keyExtractor={(item) => item.package_name}
              renderItem={renderItem}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              initialNumToRender={20}
              maxToRenderPerBatch={24}
              windowSize={8}
              keyboardShouldPersistTaps="handled"
              getItemLayout={(_, index) => ({
                length: 60,
                offset: 64 * index,
                index,
              })}
              refreshControl={<RefreshControl refreshing={false} onRefresh={load} tintColor={AuthColors.primary} />}
              ListHeaderComponent={
                <Text style={styles.intro}>
                  Select which apps are allowed to send notifications from your child&apos;s device. Apps start
                  disabled, nothing is monitored until you turn it on.
                </Text>
              }
              ItemSeparatorComponent={() => <View style={styles.rowGap} />}
              ListFooterComponent={<View style={styles.bottomSpacer} />}
            />
          )}
        </>
      )}

      <View style={styles.footer}>
        <Button
          title={apps.length === 0 ? 'Save & Continue' : `Save & Continue (${enabledCount})`}
          icon="arrow-forward"
          onPress={handleSave}
          loading={saving}
          disabled={apps.length === 0 || enabledCount === 0}
        />
        {enabledCount === 0 && (
          <Text style={styles.hintText}>Select at least one app to continue. Only chosen apps will be monitored.</Text>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AuthColors.background,
    marginVertical: 30
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    ...AuthFonts.headlineSmall,
    color: AuthColors.primary,
  },
  headerCount: {
    ...AuthFonts.labelMedium,
    color: AuthColors.onSurfaceVariant,
  },
  waitingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 24,
    marginTop: 4,
    marginBottom: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: AuthColors.secondaryContainer,
    borderRadius: AuthRadius.lg,
  },
  waitingBannerText: {
    ...AuthFonts.labelMedium,
    color: AuthColors.onSecondary,
    flex: 1,
    lineHeight: 18,
  },
  scrollContent: {
    paddingHorizontal: 24,
  },
  intro: {
    ...AuthFonts.bodyMedium,
    color: AuthColors.onSurfaceVariant,
    marginBottom: 16,
    lineHeight: 22,
  },
  centerState: {
    paddingVertical: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    ...AuthFonts.bodyMedium,
    color: AuthColors.onSurfaceVariant,
    marginTop: 16,
  },
  errorText: {
    ...AuthFonts.bodyMedium,
    color: AuthColors.onSurfaceVariant,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryBtn: {
    width: 200,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 16,
    marginHorizontal: 20,
  },
  searchCard: {
    flex: 1,
    height: 45,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    backgroundColor: AuthColors.surfaceContainer,
    borderRadius: AuthRadius.xl,
  },
  searchIcon: {
    marginRight: 5,
  },
  searchInput: {
    flex: 1,
    height: 44,
    ...AuthFonts.bodyMedium,
    color: AuthColors.onSurface,
  },
  searchClear: {
    padding: 4,
    marginLeft: 4,
  },
  listCard: {
    backgroundColor: AuthColors.surfaceContainerLow,
    borderRadius: AuthRadius.xl,
    padding: 8,
    ...AuthShadows.ambient,
  },
  rowGap: {
    height: 4,
  },
  bottomSpacer: {
    height: 24,
  },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 16,
    backgroundColor: AuthColors.background,
  },
  hintText: {
    ...AuthFonts.labelMedium,
    color: AuthColors.error,
    textAlign: 'center',
    marginTop: 12,
  },
})
