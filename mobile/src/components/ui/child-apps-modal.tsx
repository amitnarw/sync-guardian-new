import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Modal,
  StyleSheet,
  View,
  Text,
  TextInput,
  ActivityIndicator,
  TouchableWithoutFeedback,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ListRenderItem,
  BackHandler,
} from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import { supabase } from '@/lib/supabase'
import { logger } from '@/services/logger'
import { AuthColors, AuthFonts, AuthRadius, AuthShadows } from '@/constants/auth-theme'
import { Button } from '@/components/ui/button'
import { AppFilterRow } from '@/components/app-filter-row'
import { EnableDisableToggle, EnableDisableValue } from '@/components/ui/enable-disable-toggle'
import { EdgeFadeFlatList } from '@/components/ui/edge-fade'

interface AppFilter {
  package_name: string
  app_name: string | null
  app_icon_base64: string | null
  is_enabled: boolean
}

interface ChildAppsModalProps {
  visible: boolean
  onClose: () => void
  childDeviceId: string
  childName?: string | null
}

export function ChildAppsModal({ visible, onClose, childDeviceId, childName }: ChildAppsModalProps) {
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [apps, setApps] = useState<AppFilter[]>([])
  const [searchQuery, setSearchQuery] = useState('')

  const childLabel = childName ? `${childName}'s` : 'Your child’s'

  const load = useCallback(async () => {
    if (!childDeviceId) return
    try {
      setLoading(true)
      setError(null)
      const { data, error: filterErr } = await supabase
        .from('child_app_filters')
        .select('package_name, app_name, app_icon_base64, is_enabled')
        .eq('child_device_id', childDeviceId)
        .order('app_name', { ascending: true, nullsFirst: false })

      if (filterErr) throw new Error(`Failed to load app filters. ${filterErr.message}`)

      setApps(
        (data ?? []).map((f: any) => ({
          package_name: f.package_name,
          app_name: f.app_name,
          app_icon_base64: f.app_icon_base64,
          is_enabled: f.is_enabled,
        })),
      )
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Something went wrong.'
      logger.error('ChildAppsModal: load failed', msg)
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [childDeviceId])

  useEffect(() => {
    if (visible) {
      setSearchQuery('')
      load()
    }
  }, [visible, load])

  useEffect(() => {
    if (!visible) return
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose()
      return true
    })
    return () => sub.remove()
  }, [visible, onClose])

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
    if (!childDeviceId || apps.length === 0 || enabledCount === 0) return
    try {
      setSaving(true)
      const { error: saveErr } = await supabase.functions.invoke('update-app-filters', {
        body: {
          child_device_id: childDeviceId,
          changes: apps.map((a) => ({ package_name: a.package_name, is_enabled: a.is_enabled })),
        },
      })
      if (saveErr) throw saveErr
      onClose()
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not save your selections.'
      logger.error('ChildAppsModal: save failed', msg)
      setError(msg)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={styles.backdrop} />
        </TouchableWithoutFeedback>

        <KeyboardAvoidingView
          style={styles.sheet}
          behavior="padding"
        >
          <View style={styles.grabber} />

          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <MaterialIcons name="apps" size={22} color={AuthColors.primary} />
              <Text style={styles.headerTitle}>{childLabel} Apps</Text>
            </View>
            <TouchableOpacity onPress={onClose} activeOpacity={0.7} style={styles.closeButton}>
              <MaterialIcons name="close" size={22} color={AuthColors.onSurfaceVariant} />
            </TouchableOpacity>
          </View>

          <Text style={styles.headerCount}>
            {enabledCount}/{apps.length} selected
          </Text>

          {loading ? (
            <View style={styles.centerState}>
              <ActivityIndicator size="large" color={AuthColors.primary} />
              <Text style={styles.loadingText}>Loading installed apps…</Text>
            </View>
          ) : error ? (
            <View style={styles.centerState}>
              <Text style={styles.errorText}>{error}</Text>
              <Button title="Retry" onPress={load} style={styles.retryBtn} />
            </View>
          ) : apps.length === 0 ? (
            <View style={styles.centerState}>
              <Text style={styles.errorText}>No apps were found on the child device yet.</Text>
              <Button title="Close" onPress={onClose} style={styles.retryBtn} />
            </View>
          ) : (
            <View style={styles.body}>
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
                  onChange={(v: EnableDisableValue) => setAll(v === 'enabled')}
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
                  style={{ flex: 1 }}
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
                  ListHeaderComponent={
                    <Text style={styles.intro}>
                      Select which apps are allowed to send notifications from your child&apos;s device.
                    </Text>
                  }
                  ItemSeparatorComponent={() => <View style={styles.rowGap} />}
                  ListFooterComponent={<View style={styles.bottomSpacer} />}
                />
              )}
            </View>
          )}

          {!loading && !error && apps.length > 0 && (
            <View style={styles.footer}>
              <Button
                title={`Save & Continue (${enabledCount})`}
                icon="arrow-forward"
                onPress={handleSave}
                loading={saving}
                disabled={enabledCount === 0}
              />
              {enabledCount === 0 && (
                <Text style={styles.hintText}>Select at least one app to continue. Only chosen apps will be monitored.</Text>
              )}
            </View>
          )}
        </KeyboardAvoidingView>
        </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(27, 29, 14, 0.45)',
  },
  sheet: {
    height: '80%',
    backgroundColor: AuthColors.background,
    borderTopLeftRadius: AuthRadius.xl,
    borderTopRightRadius: AuthRadius.xl,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 24 : 16,
    ...AuthShadows.ambient,
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: AuthColors.outlineVariant,
    marginBottom: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 4,
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
  closeButton: {
    padding: 4,
  },
  headerCount: {
    ...AuthFonts.labelMedium,
    color: AuthColors.onSurfaceVariant,
    paddingHorizontal: 24,
    paddingBottom: 12,
  },
  body: {
    flex: 1,
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
  rowGap: {
    height: 4,
  },
  bottomSpacer: {
    height: 24,
  },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 16,
    marginBottom: 70,
    backgroundColor: AuthColors.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: AuthColors.surfaceContainer,
  },
  hintText: {
    ...AuthFonts.labelMedium,
    color: AuthColors.error,
    textAlign: 'center',
    marginTop: 12,
  },
})
