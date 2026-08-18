import React, { useState, useEffect, useCallback, useRef } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView, RefreshControl, ActivityIndicator, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { useAuthStore } from '@/hooks/use-auth-store';
import { useAppModal } from '@/hooks/use-app-modal';
import { supabase } from '@/lib/supabase';
import { isValidUUID } from '@/lib/uuid';
import { ChildAppsModal } from '@/components/ui/child-apps-modal';

const C = {
  primary: '#44674d',
  primaryContainer: '#c5eccc',
  onPrimary: '#e8ffea',
  secondary: '#a0412d',
  secondaryContainer: '#ffdad3',
  tertiary: '#44674e',
  tertiaryContainer: '#d3fbda',
  surface: '#fff8f0',
  surfaceContainerLow: '#faf3e7',
  surfaceContainerHigh: '#efe7da',
  surfaceContainerHighest: '#eae1d2',
  surfaceContainerLowest: '#ffffff',
  surfaceVariant: '#eae1d2',
  onSurface: '#363228',
  onSurfaceVariant: '#645e53',
  outline: '#807a6d',
  error: '#a83836',
  white: '#ffffff',
} as const;

function formatTimeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

interface ChildData {
  id: string;
  child_device_id: string;
  child_user_id: string;
  display_name: string | null;
  is_foreground: boolean;
  last_seen_at: string | null;
  created_at: string;
}

export default function ChildAccountScreen() {
  const { deviceId } = useAuthStore();
  const { showModal } = useAppModal();
  const [children, setChildren] = useState<ChildData[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pingingId, setPingingId] = useState<string | null>(null);
  const [appsModalChild, setAppsModalChild] = useState<{ childDeviceId: string; name: string | null } | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showChildSelector, setShowChildSelector] = useState(false);
  const [dropdownTop, setDropdownTop] = useState(0);
  const [dropdownRight, setDropdownRight] = useState(0);
  const selectorRef = useRef<View>(null);

  const fetchChildren = useCallback(async () => {
    if (!isValidUUID(deviceId)) return;
    const { data } = await supabase
      .from('pairs')
      .select('id, child_device_id, child_user_id, created_at, child_device:devices!child_device_id(is_foreground, last_seen_at)')
      .eq('parent_device_id', deviceId)
      .in('status', ['active', 'pending']);

    if (data) {
      const mapped = data.map((d: any) => ({
        id: d.id,
        child_device_id: d.child_device_id,
        child_user_id: d.child_user_id,
        display_name: null as string | null,
        is_foreground: d.child_device?.is_foreground || false,
        last_seen_at: d.child_device?.last_seen_at || null,
        created_at: d.created_at,
      }));

      setChildren(mapped);

      await Promise.all(
        mapped.map(async (child) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('display_name')
            .eq('id', child.child_user_id)
            .maybeSingle();
          setChildren((prev) =>
            prev.map((c) =>
              c.id === child.id
                ? { ...c, display_name: (profile as any)?.display_name ?? null }
                : c,
            ),
          );
        }),
      );
    }
  }, [deviceId]);

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await fetchChildren();
    } finally {
      setIsRefreshing(false);
    }
  }, [fetchChildren]);

  useEffect(() => {
    fetchChildren();
  }, [fetchChildren]);

  // Clamp selection when children array shrinks
  useEffect(() => {
    if (selectedIndex >= children.length) {
      setSelectedIndex(Math.max(0, children.length - 1));
    }
  }, [children.length, selectedIndex]);

  const handlePingChild = async (childDeviceId: string, pairId: string) => {
    setPingingId(pairId);
    try {
      const { error } = await supabase.functions.invoke('ping-child', {
        body: { child_device_id: childDeviceId },
      });
      if (error) {
        let realMsg = error.message;
        try {
          const ctx = (error as any)?.context;
          if (ctx) {
            const body = await ctx.clone().json();
            if (body?.error) realMsg = body.error;
          }
        } catch {}
        showModal({ title: 'Ping Failed', message: realMsg || 'Could not reach the child device.', icon: 'error' });
        return;
      }
      showModal({ title: 'Ping Sent', message: 'Wake-up ping sent to child device.', icon: 'success' });
    } catch (e: any) {
      showModal({ title: 'Ping Failed', message: e.message || 'Could not reach the child device.', icon: 'error' });
    } finally {
      setPingingId(null);
    }
  };

  const handleDisconnectChild = (pairId: string, name: string | null) => {
    const childName = name || 'this child';
    showModal({
      title: 'Disconnect',
      message: `Are you sure you want to unpair ${childName}?`,
      icon: 'warning',
      primaryButton: 'Unpair',
      primaryVariant: 'destructive',
      onPrimaryPress: async () => {
        try {
          const { error } = await supabase.functions.invoke('revoke-pair', { body: { pair_id: pairId } });
          if (error) {
            let realMsg = error.message;
            try {
              const body = error.context && await error.context.json();
              if (body?.error) realMsg = body.error;
            } catch {}
            throw new Error(realMsg);
          }
          setChildren(children.filter(c => c.id !== pairId));
          router.back();
        } catch (e: any) {
          showModal({ title: 'Unpair Failed', message: e?.message || 'Could not unpair the child device.', icon: 'error' });
        }
      },
      secondaryButton: 'Cancel',
    });
  };

  const openChildDropdown = () => {
    selectorRef.current?.measureInWindow((_x, y, _width, height) => {
      setDropdownTop(y + height + 4);
      setDropdownRight(24); // align right edge to scrollContent paddingHorizontal
      setShowChildSelector(true);
    });
  };

  const child = children[selectedIndex];
  const isOnline = child?.is_foreground || (child?.last_seen_at && (Date.now() - new Date(child.last_seen_at).getTime() < 120000));
  const lastSeenText = isOnline ? 'Online' : child?.last_seen_at ? `Last seen ${formatTimeAgo(new Date(child.last_seen_at).getTime())}` : 'Offline';
  const pairedDate = child?.created_at ? new Date(child.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
  const hasMultiple = children.length > 1;

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={24} color={C.onSurface} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Child Account</Text>
        {hasMultiple && (
          <TouchableOpacity ref={selectorRef} onPress={openChildDropdown} activeOpacity={0.7} style={s.selectorTrigger}>
            <Text style={s.selectorText} numberOfLines={1}>{child?.display_name || 'Child'}</Text>
            <Ionicons name="chevron-down" size={14} color={C.onSurfaceVariant} />
          </TouchableOpacity>
        )}
        {!hasMultiple && <View style={s.headerSpacer} />}
      </View>

      {/* Child Selector Dropdown */}
      {hasMultiple && showChildSelector && (
        <Pressable style={s.dropdownOverlay} onPress={() => setShowChildSelector(false)}>
          <View style={[s.dropdownMenu, { top: dropdownTop, right: dropdownRight }]}>
            <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled showsVerticalScrollIndicator>
              {children.map((c, idx) => (
                <TouchableOpacity
                  key={c.id}
                  style={[s.dropdownItem, idx === selectedIndex && s.dropdownItemActive]}
                  onPress={() => { setSelectedIndex(idx); setShowChildSelector(false); }}
                >
                  <Image source={require('@/assets/images/leo_avatar.jpg')} style={s.dropdownAvatar} />
                  <Text style={[s.dropdownItemText, idx === selectedIndex && s.dropdownItemTextActive]} numberOfLines={1}>
                    {c.display_name || 'Child Device'}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      )}

      <ScrollView
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} colors={[C.primary]} tintColor={C.primary} />}
      >
        {children.length === 0 ? (
          <View style={s.emptyState}>
            <Ionicons name="person-outline" size={48} color={C.outline} />
            <Text style={s.emptyStateText}>No child devices paired yet.</Text>
            <TouchableOpacity style={s.pairBtn} onPress={() => router.push('/pairing')}>
              <Text style={s.pairBtnText}>Pair New Device</Text>
            </TouchableOpacity>
          </View>
        ) : child ? (
          <>
            <View style={s.heroCard}>
              <Image source={require('@/assets/images/leo_avatar.jpg')} style={s.heroAvatar} />
              <Text style={s.heroName}>{child.display_name || 'Child Device'}</Text>
              <View style={s.heroStatusRow}>
                <View style={[s.heroStatusDot, { backgroundColor: isOnline ? C.primary : C.outline }]} />
                <Text style={s.heroStatusText}>{lastSeenText}</Text>
              </View>
            </View>

            <View style={s.infoGrid}>
              <View style={[s.infoCard, { borderLeftWidth: 3, borderLeftColor: C.primary }]}>
                <View style={[s.infoIconWrapper, { backgroundColor: C.primaryContainer }]}>
                  <Ionicons name="person" size={20} color={C.primary} />
                </View>
                <View style={s.infoContent}>
                  <Text style={s.infoLabel}>Guardian</Text>
                  <Text style={s.infoValue}>Connected to your device</Text>
                </View>
              </View>

              <View style={[s.infoCard, { borderLeftWidth: 3, borderLeftColor: C.surfaceVariant }]}>
                <View style={[s.infoIconWrapper, { backgroundColor: C.surfaceVariant }]}>
                  <Ionicons name="phone-portrait" size={20} color={C.onSurfaceVariant} />
                </View>
                <View style={s.infoContent}>
                  <Text style={s.infoLabel}>Device</Text>
                  <Text style={s.infoValue} numberOfLines={1}>{child.child_device_id.slice(0, 8)}…</Text>
                </View>
              </View>

              <View style={[s.infoCard, { borderLeftWidth: 3, borderLeftColor: C.tertiaryContainer }]}>
                <View style={[s.infoIconWrapper, { backgroundColor: C.tertiaryContainer }]}>
                  <Ionicons name="calendar" size={20} color={C.tertiary} />
                </View>
                <View style={s.infoContent}>
                  <Text style={s.infoLabel}>Paired</Text>
                  <Text style={s.infoValue}>{pairedDate}</Text>
                </View>
              </View>

              <View style={[s.infoCard, { borderLeftWidth: 3, borderLeftColor: C.secondaryContainer }]}>
                <View style={[s.infoIconWrapper, { backgroundColor: C.secondaryContainer }]}>
                  <Ionicons name="apps" size={20} color={C.secondary} />
                </View>
                <View style={s.infoContent}>
                  <Text style={s.infoLabel}>App Filters</Text>
                  <TouchableOpacity onPress={() => setAppsModalChild({ childDeviceId: child.child_device_id, name: child.display_name })}>
                    <Text style={[s.infoValue, { color: C.primary }]}>Manage</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            <View style={s.actionsSection}>
              <TouchableOpacity
                style={s.pingBtn}
                onPress={() => handlePingChild(child.child_device_id, child.id)}
                disabled={pingingId === child.id}
              >
                {pingingId === child.id ? (
                  <ActivityIndicator size="small" color={C.primary} />
                ) : (
                  <Ionicons name="pulse-outline" size={18} color={C.primary} />
                )}
                <Text style={s.pingBtnText}>Ping Child Device</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={s.disconnectBtn}
                onPress={() => handleDisconnectChild(child.id, child.display_name)}
              >
                <Ionicons name="close-circle-outline" size={18} color={C.secondary} />
                <Text style={s.disconnectBtnText}>Disconnect</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : null}
      </ScrollView>

      <ChildAppsModal
        visible={!!appsModalChild}
        childDeviceId={appsModalChild?.childDeviceId ?? ''}
        childName={appsModalChild?.name}
        onClose={() => setAppsModalChild(null)}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.surface },
  header: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, gap: 12,
  },
  headerTitle: { fontFamily: 'PlusJakartaSans-Bold', fontSize: 18, color: C.onSurface, flex: 1 },
  headerSpacer: { width: 24 },
  selectorTrigger: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: C.surfaceContainerHighest, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 9999,
  },
  selectorText: { fontFamily: 'PlusJakartaSans-SemiBold', fontSize: 13, color: C.onSurface, maxWidth: 100 },
  scrollContent: { paddingHorizontal: 24, paddingBottom: 120 },
  emptyState: { alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyStateText: { fontFamily: 'PlusJakartaSans-Medium', fontSize: 14, color: C.outline },
  pairBtn: { backgroundColor: C.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 9999 },
  pairBtnText: { fontFamily: 'PlusJakartaSans-Bold', fontSize: 13, color: C.onPrimary },

  heroCard: {
    alignItems: 'center', backgroundColor: C.surfaceContainerLowest, borderRadius: 28, padding: 24, marginBottom: 20,
    shadowColor: '#363228', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 12, elevation: 2,
  },
  heroAvatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: C.surfaceContainerHigh, marginBottom: 12 },
  heroName: { fontFamily: 'PlusJakartaSans-Bold', fontSize: 20, color: C.onSurface, marginBottom: 4 },
  heroStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  heroStatusDot: { width: 8, height: 8, borderRadius: 4 },
  heroStatusText: { fontFamily: 'PlusJakartaSans-Regular', fontSize: 13, color: C.onSurfaceVariant },

  infoGrid: { gap: 12, marginBottom: 24 },
  infoCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: C.surfaceContainerLowest, borderRadius: 20, padding: 16, gap: 14,
    shadowColor: '#363228', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.03, shadowRadius: 8, elevation: 1,
  },
  infoIconWrapper: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  infoContent: { flex: 1, gap: 2 },
  infoLabel: { fontFamily: 'PlusJakartaSans-Bold', fontSize: 13, color: C.onSurface },
  infoValue: { fontFamily: 'PlusJakartaSans-Regular', fontSize: 12, color: C.onSurfaceVariant },

  actionsSection: { gap: 12 },
  pingBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: C.primaryContainer,
    paddingVertical: 14, borderRadius: 9999, gap: 8,
  },
  pingBtnText: { fontFamily: 'PlusJakartaSans-Bold', fontSize: 13, color: C.primary },
  disconnectBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: C.secondaryContainer,
    paddingVertical: 14, borderRadius: 9999, gap: 8,
  },
  disconnectBtnText: { fontFamily: 'PlusJakartaSans-Bold', fontSize: 13, color: C.secondary },

  /* Dropdown */
  dropdownOverlay: { flex: 1, backgroundColor: 'rgba(54, 50, 40, 0.15)' },
  dropdownMenu: {
    position: 'absolute', backgroundColor: C.surface, borderRadius: 24, padding: 12,
    borderWidth: 1, borderColor: 'rgba(68, 103, 77, 0.12)',
    shadowColor: '#363228', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.15, shadowRadius: 20, elevation: 8,
    width: 200,
  },
  dropdownItem: {
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8,
  },
  dropdownItemActive: { backgroundColor: C.primaryContainer },
  dropdownAvatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: C.surfaceContainerHigh },
  dropdownItemText: { fontFamily: 'PlusJakartaSans-SemiBold', fontSize: 13, color: C.onSurface, flex: 1 },
  dropdownItemTextActive: { color: C.primary },
});
