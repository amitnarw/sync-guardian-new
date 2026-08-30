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
  primary: '#2f4a37',
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
          useAuthStore.getState().markPairRevoked();
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
      setDropdownRight(24);
      setShowChildSelector(true);
    });
  };

  const child = children[selectedIndex];
  const isOnline = child?.is_foreground || (child?.last_seen_at && (Date.now() - new Date(child.last_seen_at).getTime() < 120000));
  const lastSeenText = isOnline ? 'Online' : child?.last_seen_at ? `Last seen ${formatTimeAgo(new Date(child.last_seen_at).getTime())}` : 'Offline';
  const pairedDate = child?.created_at ? new Date(child.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : ', ';
  const hasMultiple = children.length > 1;

  return (
    <SafeAreaView style={s.container} edges={['top', 'bottom']}>
      {/* Top Bar with back arrow and Centered Title (Matching Image 2) */}
      <View style={s.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={10}
          style={s.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Ionicons name="chevron-back" size={24} color={C.onSurface} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Profile & Family</Text>
        {hasMultiple ? (
          <TouchableOpacity ref={selectorRef} onPress={openChildDropdown} activeOpacity={0.7} style={s.selectorTrigger}>
            <Text style={s.selectorText} numberOfLines={1}>{child?.display_name || 'Child'}</Text>
            <Ionicons name="chevron-down" size={14} color={C.onSurfaceVariant} />
          </TouchableOpacity>
        ) : (
          <View style={s.headerRightSpacer} />
        )}
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
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} colors={[C.primary]} tintColor={C.primary} />
        }
      >
        {children.length === 0 ? (
          <View style={s.emptyCard}>
            <Ionicons name="people-outline" size={48} color={C.outline} />
            <Text style={s.emptyTitle}>No Family Members Connected</Text>
            <Text style={s.emptyDesc}>Pair a child device to start monitoring and manage family settings.</Text>
            <TouchableOpacity style={s.pairBtn} onPress={() => router.push('/pairing')} activeOpacity={0.7}>
              <Ionicons name="add-circle-outline" size={18} color={C.onPrimary} />
              <Text style={s.pairBtnText}>Pair New Device</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={s.mainLayout}>
            {/* Top Cards Stack */}
            <View style={s.topContent}>
              {/* Child Profile Card */}
              <View style={s.profileCard}>
                <Image source={require('@/assets/images/leo_avatar.jpg')} style={s.profileAvatar} />
                <Text style={s.profileName}>{child?.display_name || 'Child Device'}</Text>
                <View style={s.statusPill}>
                  <View style={[s.statusDot, { backgroundColor: isOnline ? C.primary : C.outline }]} />
                  <Text style={s.statusPillText}>{lastSeenText}</Text>
                </View>
              </View>

              {/* Quick Actions Grid */}
              <View style={s.actionsGrid}>
                <TouchableOpacity
                  style={s.actionGridCard}
                  onPress={() => child && setAppsModalChild({ childDeviceId: child.child_device_id, name: child.display_name })}
                  activeOpacity={0.7}
                >
                  <View style={[s.actionIconWrap, { backgroundColor: C.primaryContainer }]}>
                    <Ionicons name="apps" size={22} color={C.primary} />
                  </View>
                  <Text style={s.actionGridTitle}>App Controls</Text>
                  <Text style={s.actionGridDesc}>Filter monitored apps</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={s.actionGridCard}
                  onPress={() => child && handlePingChild(child.child_device_id, child.id)}
                  disabled={pingingId === child?.id}
                  activeOpacity={0.7}
                >
                  <View style={[s.actionIconWrap, { backgroundColor: C.surfaceContainerHighest }]}>
                    {pingingId === child?.id ? (
                      <ActivityIndicator size="small" color={C.primary} />
                    ) : (
                      <Ionicons name="pulse" size={22} color={C.primary} />
                    )}
                  </View>
                  <Text style={s.actionGridTitle}>Ping Device</Text>
                  <Text style={s.actionGridDesc}>Send wake-up check</Text>
                </TouchableOpacity>
              </View>

              {/* Device Info Card */}
              <View style={s.infoCard}>
                <Text style={s.infoSectionTitle}>Device Details</Text>
                <View style={s.infoRow}>
                  <Text style={s.infoLabel}>Paired Since</Text>
                  <Text style={s.infoValue}>{pairedDate}</Text>
                </View>
                <View style={s.infoDivider} />
                <View style={s.infoRow}>
                  <Text style={s.infoLabel}>Status</Text>
                  <Text style={[s.infoValue, { color: isOnline ? C.primary : C.onSurfaceVariant }]}>{isOnline ? 'Online' : 'Offline'}</Text>
                </View>
              </View>
            </View>

            {/* Bottom Actions Section (Pushed to extreme bottom) */}
            <View style={s.bottomActionsSection}>
              {/* Add New Device Button */}
              <TouchableOpacity style={s.addDeviceBtn} onPress={() => router.push('/pairing')} activeOpacity={0.7}>
                <Ionicons name="add-circle-outline" size={20} color={C.primary} />
                <Text style={s.addDeviceBtnText}>Pair Another Device</Text>
              </TouchableOpacity>

              {/* Disconnect Danger Button */}
              <TouchableOpacity
                style={s.disconnectCard}
                onPress={() => child && handleDisconnectChild(child.id, child.display_name)}
                activeOpacity={0.7}
              >
                <Ionicons name="trash-outline" size={20} color={C.secondary} />
                <Text style={s.disconnectText}>Unpair This Device</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>

      {/* App filter modal */}
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 18,
    color: C.onSurface,
    textAlign: 'center',
    flex: 1,
  },
  headerRightSpacer: { width: 40 },
  selectorTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: C.surfaceContainerLowest,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: 'rgba(68, 103, 77, 0.15)',
  },
  selectorText: { fontFamily: 'PlusJakartaSans-SemiBold', fontSize: 13, color: C.onSurface, maxWidth: 100 },
  dropdownOverlay: { ...StyleSheet.absoluteFillObject, zIndex: 100 },
  dropdownMenu: {
    position: 'absolute',
    backgroundColor: C.surfaceContainerLowest,
    borderRadius: 20,
    padding: 8,
    shadowColor: '#363228',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 8,
    width: 200,
    borderWidth: 1,
    borderColor: 'rgba(68, 103, 77, 0.12)',
  },
  dropdownItem: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12 },
  dropdownItemActive: { backgroundColor: C.primaryContainer },
  dropdownAvatar: { width: 24, height: 24, borderRadius: 12 },
  dropdownItemText: { fontFamily: 'PlusJakartaSans-Medium', fontSize: 13, color: C.onSurface },
  dropdownItemTextActive: { fontFamily: 'PlusJakartaSans-Bold', color: C.primary },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 24,
    paddingTop: 8,
  },
  mainLayout: {
    flex: 1,
    justifyContent: 'space-between',
  },
  topContent: {
    gap: 16,
  },

  emptyCard: {
    backgroundColor: C.surfaceContainerLowest,
    borderRadius: 28,
    padding: 32,
    alignItems: 'center',
    gap: 12,
    shadowColor: '#363228',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
    marginTop: 20,
  },
  emptyTitle: { fontFamily: 'PlusJakartaSans-Bold', fontSize: 16, color: C.onSurface },
  emptyDesc: { fontFamily: 'PlusJakartaSans-Regular', fontSize: 13, color: C.onSurfaceVariant, textAlign: 'center', lineHeight: 18 },
  pairBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: C.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 9999,
    marginTop: 8,
  },
  pairBtnText: { fontFamily: 'PlusJakartaSans-Bold', fontSize: 14, color: C.onPrimary },

  profileCard: {
    backgroundColor: C.surfaceContainerLowest,
    borderRadius: 28,
    padding: 24,
    alignItems: 'center',
    gap: 8,
    shadowColor: '#363228',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
  },
  profileAvatar: { width: 72, height: 72, borderRadius: 36, marginBottom: 4 },
  profileName: { fontFamily: 'PlusJakartaSans-Bold', fontSize: 20, color: C.onSurface },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: C.surfaceContainerLow,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 9999,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusPillText: { fontFamily: 'PlusJakartaSans-Medium', fontSize: 12, color: C.onSurfaceVariant },

  actionsGrid: { flexDirection: 'row', gap: 12 },
  actionGridCard: {
    flex: 1,
    backgroundColor: C.surfaceContainerLowest,
    borderRadius: 24,
    padding: 16,
    gap: 6,
    shadowColor: '#363228',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 1,
  },
  actionIconWrap: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
  actionGridTitle: { fontFamily: 'PlusJakartaSans-Bold', fontSize: 14, color: C.onSurface },
  actionGridDesc: { fontFamily: 'PlusJakartaSans-Regular', fontSize: 11, color: C.onSurfaceVariant },

  infoCard: {
    backgroundColor: C.surfaceContainerLowest,
    borderRadius: 24,
    padding: 20,
    gap: 12,
    shadowColor: '#363228',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 1,
  },
  infoSectionTitle: { fontFamily: 'PlusJakartaSans-Bold', fontSize: 14, color: C.onSurface },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  infoLabel: { fontFamily: 'PlusJakartaSans-Regular', fontSize: 13, color: C.onSurfaceVariant },
  infoValue: { fontFamily: 'PlusJakartaSans-SemiBold', fontSize: 13, color: C.onSurface },
  infoDivider: { height: 1, backgroundColor: C.surfaceContainerHigh },

  bottomActionsSection: {
    marginTop: 24,
    gap: 12,
  },
  addDeviceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: C.surfaceContainerLowest,
    paddingVertical: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(68, 103, 77, 0.15)',
  },
  addDeviceBtnText: { fontFamily: 'PlusJakartaSans-SemiBold', fontSize: 14, color: C.primary },

  disconnectCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: C.secondaryContainer,
    paddingVertical: 14,
    borderRadius: 20,
  },
  disconnectText: { fontFamily: 'PlusJakartaSans-Bold', fontSize: 14, color: C.secondary },
});
