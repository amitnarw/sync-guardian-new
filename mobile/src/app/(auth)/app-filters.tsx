import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, View, Text, ScrollView, ActivityIndicator, TouchableOpacity, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuthStore } from '@/hooks/use-auth-store';
import { supabase } from '@/lib/supabase';
import { logger } from '@/services/logger';
import { AuthColors, AuthFonts, AuthRadius, AuthShadows } from '@/constants/auth-theme';
import { Button } from '@/components/ui/button';
import { AppFilterRow } from '@/components/app-filter-row';
import { ErrorModal } from '@/components/ui/error-modal';

interface AppFilter {
  package_name: string;
  app_name: string | null;
  app_icon_base64: string | null;
  is_enabled: boolean;
}

export default function AppFiltersScreen() {
  const { pairId: storePairId } = useAuthStore();
  const params = useLocalSearchParams();
  const paramPairId = typeof params.pairId === 'string' ? params.pairId : null;
  const pairId = paramPairId ?? storePairId;
  const isReentry = !!paramPairId;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [apps, setApps] = useState<AppFilter[]>([]);
  const [childDeviceId, setChildDeviceId] = useState<string | null>(null);
  const [errorModalVisible, setErrorModalVisible] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const load = useCallback(async () => {
    try {
      setError(null);
      if (!pairId) throw new Error('Pairing information is missing.');

      const { data: pair, error: pairErr } = await supabase
        .from('pairs')
        .select('child_device_id')
        .eq('id', pairId)
        .single();

      if (pairErr || !pair?.child_device_id) {
        throw new Error(`Could not find the linked child device. ${pairErr?.message ?? ''}`.trim());
      }
      setChildDeviceId(pair.child_device_id);

      const { data: filters, error: filterErr } = await supabase
        .from('child_app_filters')
        .select('package_name, app_name, app_icon_base64, is_enabled')
        .eq('child_device_id', pair.child_device_id)
        .order('app_name', { ascending: true, nullsFirst: false });

      if (filterErr) throw new Error(`Failed to load app filters. ${filterErr.message}`);

      setApps(
        (filters ?? []).map((f) => ({
          package_name: f.package_name,
          app_name: f.app_name,
          app_icon_base64: f.app_icon_base64,
          is_enabled: f.is_enabled,
        })),
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Something went wrong.';
      logger.error('AppFilters: load failed', msg);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [pairId]);

  useEffect(() => {
    load();
  }, [load]);

  const toggle = (pkg: string) => {
    setApps((prev) => prev.map((a) => (a.package_name === pkg ? { ...a, is_enabled: !a.is_enabled } : a)));
  };

  const setAll = (value: boolean) => {
    setApps((prev) => prev.map((a) => ({ ...a, is_enabled: value })));
  };

  const enabledCount = apps.filter((a) => a.is_enabled).length;

  const handleSave = async () => {
    if (!childDeviceId) return;
    try {
      setSaving(true);
      const { error: saveErr } = await supabase.functions.invoke('update-app-filters', {
        body: {
          child_device_id: childDeviceId,
          changes: apps.map((a) => ({ package_name: a.package_name, is_enabled: a.is_enabled })),
        },
      });
      if (saveErr) throw saveErr;
      if (isReentry) {
        router.back();
      } else {
        router.replace('/onboarding');
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not save your selections.';
      logger.error('AppFilters: save failed', msg);
      setErrorMessage(msg);
      setErrorModalVisible(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <MaterialIcons name="spa" size={24} color={AuthColors.primary} />
          <Text style={styles.headerTitle}>Choose Apps</Text>
        </View>
        <Text style={styles.headerCount}>
          {enabledCount}/{apps.length} selected
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={loading ? undefined : <RefreshControl refreshing={false} onRefresh={load} tintColor={AuthColors.primary} />}
      >
        <Text style={styles.intro}>
          Select which apps are allowed to send notifications from your child&apos;s device. Apps start disabled, nothing is monitored until you turn it on.
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
            <Button title="Continue" onPress={() => (isReentry ? router.back() : router.replace('/onboarding'))} style={styles.retryBtn} />
          </View>
        ) : (
          <>
            <View style={styles.bulkRow}>
              <TouchableOpacity style={styles.bulkBtn} onPress={() => setAll(true)} activeOpacity={0.7}>
                <Text style={styles.bulkBtnText}>Enable All</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.bulkBtn} onPress={() => setAll(false)} activeOpacity={0.7}>
                <Text style={styles.bulkBtnText}>Disable All</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.listCard}>
              {apps.map((app) => (
                <AppFilterRow
                  key={app.package_name}
                  name={app.app_name || app.package_name}
                  iconBase64={app.app_icon_base64}
                  enabled={app.is_enabled}
                  onToggle={() => toggle(app.package_name)}
                />
              ))}
            </View>
          </>
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>

      <View style={styles.footer}>
        {enabledCount === 0 && (
          <Text style={styles.hintText}>
            Select at least one app to continue. Only chosen apps will be monitored.
          </Text>
        )}
        <Button
          title="Save & Continue"
          icon="arrow-forward"
          onPress={handleSave}
          loading={saving}
          disabled={apps.length === 0 || enabledCount === 0}
        />
      </View>

      <ErrorModal
        visible={errorModalVisible}
        message={errorMessage}
        onClose={() => setErrorModalVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AuthColors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
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
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 8,
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
  bulkRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  bulkBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    backgroundColor: AuthColors.surfaceContainer,
    borderRadius: AuthRadius.full,
  },
  bulkBtnText: {
    ...AuthFonts.labelLarge,
    color: AuthColors.primary,
  },
  listCard: {
    backgroundColor: AuthColors.surfaceContainerLow,
    borderRadius: AuthRadius.xl,
    padding: 8,
    gap: 4,
    ...AuthShadows.ambient,
  },
  bottomSpacer: {
    height: 24,
  },
  footer: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: AuthColors.background,
  },
  hintText: {
    ...AuthFonts.labelMedium,
    color: AuthColors.error,
    textAlign: 'center',
    marginBottom: 12,
  },
});
