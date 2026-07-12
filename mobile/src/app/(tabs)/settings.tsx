import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, View, TouchableOpacity, Dimensions, Text, ActivityIndicator, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { ThemedView } from '@/components/themed-view';
import { EdgeFadeScrollView } from '@/components/ui/edge-fade';
import { useAuthStore } from '@/hooks/use-auth-store';
import { useAppModal } from '@/hooks/use-app-modal';
import { usePermissionStatus } from '@/hooks/use-permission-status';
import { PermissionStatusRow } from '@/components/permission-status-row';
import { ChildAppsModal } from '@/components/ui/child-apps-modal';
import { supabase } from '@/lib/supabase';
import Animated, { useSharedValue, useAnimatedStyle } from 'react-native-reanimated';
import { logger } from '@/services/logger';

const { width: SCREEN_W } = Dimensions.get('window');

// ============================================================
// EXACT STITCH COLORS (from HTML Tailwind config)
// ============================================================
const C = {
  primary: '#44674d',
  primaryContainer: '#c5eccc',
  onPrimary: '#e8ffea',
  secondary: '#a0412d',
  secondaryContainer: '#ffdad3',
  onSecondary: '#fff7f6',
  tertiary: '#44674e',
  tertiaryContainer: '#d3fbda',
  surface: '#fff8f0',
  surfaceBright: '#fff8f0',
  surfaceContainer: '#f5ede0',
  surfaceContainerLow: '#faf3e7',
  surfaceContainerHigh: '#efe7da',
  surfaceContainerHighest: '#eae1d2',
  surfaceContainerLowest: '#ffffff',
  surfaceVariant: '#eae1d2',
  onSurface: '#363228',
  onSurfaceVariant: '#645e53',
  outline: '#807a6d',
  outlineVariant: '#b9b1a3',
  error: '#a83836',
  errorLight: '#ffadac',
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

export default function SettingsScreen() {
  const [children, setChildren] = useState<{
    id: string;
    child_device_id: string;
    child_user_id: string;
    display_name: string | null;
    is_foreground: boolean;
    last_seen_at: string | null;
  }[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { deviceId } = useAuthStore();
  const { showModal, updateModal } = useAppModal();

  const fetchChildren = useCallback(async () => {
    if (!deviceId) return;
    const { data } = await supabase
      .from('pairs')
      .select('id, child_device_id, child_user_id, child_device:devices!child_device_id(is_foreground, last_seen_at)')
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
      }));

      setChildren(mapped);

      // Resolve each child's display name from their profile (auth.users sourced).
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

  const [pingingId, setPingingId] = useState<string | null>(null);

  const handlePingChild = async (childDeviceId: string, pairId: string) => {
    setPingingId(pairId);
    try {
      const { data, error } = await supabase.functions.invoke('ping-child', {
        body: { child_device_id: childDeviceId },
      });
      if (error) {
        let status = 0;
        let realMsg = error.message;
        try {
          const ctx = (error as any)?.context;
          if (ctx) {
            status = ctx.status;
            const body = await ctx.clone().json();
            if (body?.error) realMsg = body.error;
          }
        } catch { }
        logger.warn('ping-child failed', { status, message: realMsg });
        throw new Error(realMsg);
      }
      showModal({
        title: 'Ping Sent',
        message: 'Wake-up ping sent to child device.',
        icon: 'success',
      });
    } catch (e: any) {
      showModal({
        title: 'Ping Failed',
        message: e.message || 'Could not reach the child device.',
        icon: 'error',
      });
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
            } catch { }
            throw new Error(realMsg);
          }
          setChildren(children.filter(c => c.id !== pairId));
        } catch (e: any) {
          showModal({
            title: 'Unpair Failed',
            message: e?.message || 'Could not unpair the child device. Please try again.',
            icon: 'error',
          });
        }
      },
      secondaryButton: 'Cancel',
    });
  };

  const [isSigningOut, setIsSigningOut] = useState(false);
  const [appsModalChild, setAppsModalChild] = useState<{ childDeviceId: string; name: string | null } | null>(null);
  const screenOpacity = useSharedValue(1);
  const containerAnimatedStyle = useAnimatedStyle(() => ({
    opacity: screenOpacity.value,
  }));

  const { showModal: showPermModal } = useAppModal();
  const permissions = usePermissionStatus('parent');

  function PermissionsSection() {
    if (permissions.length === 0) return null;
    return (
      <View style={s.permissionsSection}>
        <Text style={s.permissionsSectionTitle}>Permissions</Text>
        {permissions.map((p) => (
          <PermissionStatusRow
            key={p.key}
            label={p.label}
            description={p.guideMessage}
            granted={p.granted}
            onRequest={() =>
              showPermModal({
                title: p.guideTitle,
                message: p.guideMessage,
                steps: p.guideSteps,
                icon: 'warning',
                primaryButton: 'Open Settings',
                onPrimaryPress: p.openSettings,
                secondaryButton: 'Cancel',
              })
            }
          />
        ))}
      </View>
    );
  }

  const handleOpenDialog = () => {
    showModal({
      title: 'Leaving so soon?',
      message: 'Your account is safe. You can sign back in anytime.',
      icon: 'warning',
      primaryButton: 'Sign Out',
      primaryVariant: 'destructive',
      secondaryButton: 'Stay',
      preventAutoHide: true,
      onPrimaryPress: handleConfirmSignOut,
      onSecondaryPress: () => { },
    });
  };

  const handleConfirmSignOut = async () => {
    setIsSigningOut(true);
    updateModal({ primaryLoading: true });
    try {
      await supabase.auth.signOut();
      useAuthStore.getState().resetAuth();
      router.replace('/login');
    } catch {
      setIsSigningOut(false);
      updateModal({ primaryLoading: false, primaryButton: 'Got it' });
    }
  };

  return (
    <ThemedView style={s.container}>
      <Animated.View style={[{ flex: 1 }, containerAnimatedStyle]}>
        {/* Ambient background glowing circle layer */}
        <View style={s.ambientBgWrapper}>
          <LinearGradient
            colors={['rgba(211, 251, 218, 0.4)', 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={s.ambientShape}
          />
        </View>

          <EdgeFadeScrollView
            contentContainerStyle={s.scrollContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} colors={[C.primary]} tintColor={C.primary} />
            }
          >
            {/* ========== HERO SECTION: EDITORIAL ========== */}
            <View style={s.heroSection}>
              <Text style={s.heroTitle}>Settings</Text>
              <Text style={s.heroSubtitle}>
                Manage your family, devices, and notification preferences.
              </Text>
            </View>

            {/* ========== BENTO GRID SECTION ========== */}
            <View style={s.bentoGrid}>
              {/* Card 1: Profile & Family (Sage Theme) */}
              <TouchableOpacity style={[s.bentoCard, s.cardProfile]}>
                <View style={[s.iconWrapper, { backgroundColor: C.primaryContainer }]}>
                  <Ionicons name="people" size={26} color={C.primary} />
                </View>
                <Text style={s.cardTitle}>Profile & Family</Text>
                <Text style={s.cardDesc}>Manage members, update avatars, and organise your family.</Text>

                {/* Backing blurry green radial blob */}
                <View style={s.cardBlobProfile} />
              </TouchableOpacity>

              {/* Card 2: Notification Preferences (Terracotta Theme) - Custom top-right corner */}
              <TouchableOpacity style={[s.bentoCard, s.cardNotifications]}>
                <View style={[s.iconWrapper, { backgroundColor: C.secondaryContainer }]}>
                  <Ionicons name="notifications-circle" size={26} color={C.secondary} />
                </View>
                <Text style={s.cardTitle}>Notification Preferences</Text>
                <Text style={s.cardDesc}>Choose what alerts you get and when.</Text>
              </TouchableOpacity>

              {/* Card 3: Connected Devices (Umber Theme) - Custom bottom-left corner */}
              <TouchableOpacity style={[s.bentoCard, s.cardDevices]}>
                <View style={[s.iconWrapper, { backgroundColor: C.surfaceVariant }]}>
                  <Ionicons name="laptop" size={26} color={C.onSurfaceVariant} />
                </View>
                <Text style={s.cardTitle}>Connected Devices</Text>
                <Text style={s.cardDesc}>Overview of connected devices, battery health, and sync status.</Text>
              </TouchableOpacity>

              {/* Card 4: Privacy & Security (Sage/Cream Blend) */}
              <TouchableOpacity style={[s.bentoCard, s.cardPrivacy]}>
                <View style={[s.iconWrapper, { backgroundColor: C.tertiaryContainer }]}>
                  <Ionicons name="key" size={26} color={C.tertiary} />
                </View>
                <Text style={s.cardTitle}>Privacy & Security</Text>
                <Text style={s.cardDesc}>Data controls, keyword safety, and account settings.</Text>

                {/* Backing blurry tertiary blob */}
                <View style={s.cardBlobPrivacy} />
              </TouchableOpacity>
            </View>

            {/* ========== CONNECTED CHILDREN ========== */}
            <View style={s.childrenSection}>
              <View style={s.childrenSectionHeader}>
                <Text style={s.childrenSectionTitle}>Connected Devices</Text>
                <View style={s.countBadge}>
                  <Text style={s.countBadgeText}>{children.length}</Text>
                </View>
              </View>
              {children.length === 0 ? (
                <View style={s.emptyStateCard}>
                  <Text style={s.emptyStateText}>No children connected yet.</Text>
                  <TouchableOpacity
                    style={s.pairNewDeviceBtn}
                    onPress={() => router.push('/pairing')}
                  >
                    <Ionicons name="add-circle-outline" size={18} color={C.onPrimary} />
                    <Text style={s.pairNewDeviceBtnText}>Pair New Device</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                children.map(child => {
                  const isOnline = child.is_foreground || (child.last_seen_at && (Date.now() - new Date(child.last_seen_at).getTime() < 120000));
                  const lastSeenText = isOnline ? 'Online' : child.last_seen_at ? `Last seen ${formatTimeAgo(new Date(child.last_seen_at).getTime())}` : 'Offline';

                  return (
                    <View key={child.id} style={s.childRowCard}>
                      {/* Left: Child avatar */}
                      <Image
                        source={require('@/assets/images/leo_avatar.jpg')}
                        style={s.childAvatar}
                      />

                      {/* Middle: Child details */}
                      <View style={s.childDetails}>
                        <Text style={s.childNameText}>{child.display_name || 'Child Device'}</Text>
                        <View style={s.statusRow}>
                          <View style={[s.statusDot, { backgroundColor: isOnline ? C.primary : C.outline }]} />
                          <Text style={s.statusText}>{lastSeenText}</Text>
                        </View>
                      </View>

                      {/* Right: Available options */}
                      <View style={s.childActions}>
                        <TouchableOpacity
                          style={[s.actionButton, { backgroundColor: C.primaryContainer }]}
                          onPress={() => setAppsModalChild({ childDeviceId: child.child_device_id, name: child.display_name })}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="apps-outline" size={20} color={C.primary} />
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[s.actionButton, { backgroundColor: C.surfaceContainerHighest }]}
                          onPress={() => handlePingChild(child.child_device_id, child.id)}
                          disabled={pingingId === child.id}
                          activeOpacity={0.7}
                        >
                          {pingingId === child.id ? (
                            <ActivityIndicator size="small" color={C.primary} />
                          ) : (
                            <Ionicons name="pulse-outline" size={20} color={C.primary} />
                          )}
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[s.actionButton, { backgroundColor: C.secondaryContainer }]}
                          onPress={() => handleDisconnectChild(child.id, child.display_name)}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="trash-outline" size={20} color={C.secondary} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })
              )}
            </View>

            {/* ========== PERMISSIONS SECTION ========== */}
            <PermissionsSection />

            {/* ========== ACTION AREA: SIGN OUT GENTLY ========== */}
            <View style={s.actionSection}>
              <TouchableOpacity
                style={[s.signOutButton, isSigningOut && s.signOutButtonDisabled]}
                onPress={handleOpenDialog}
                disabled={isSigningOut}
              >
                {isSigningOut ? (
                  <ActivityIndicator size="small" color={C.onSurface} style={s.signOutIcon} />
                ) : (
                  <Ionicons name="log-out-outline" size={20} color={C.onSurface} style={s.signOutIcon} />
                )}
                <Text style={s.signOutText}>Sign Out</Text>
              </TouchableOpacity>
            </View>

            {/* Bottom spacing */}
            <View style={s.bottomSpacer} />
          </EdgeFadeScrollView>

        <ChildAppsModal
          visible={!!appsModalChild}
          childDeviceId={appsModalChild?.childDeviceId ?? ''}
          childName={appsModalChild?.name}
          onClose={() => setAppsModalChild(null)}
        />
      </Animated.View>
    </ThemedView>
  );
}

// ============================================================
// STYLES - mapped precisely from Stitch settings.html
// ============================================================
const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.surface,
  },
  ambientBgWrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 400,
    zIndex: 0,
    overflow: 'hidden',
    pointerEvents: 'none',
  },
  ambientShape: {
    position: 'absolute',
    top: -120,
    right: -120,
    width: 320,
    height: 320,
    borderRadius: 160,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 8,
  },

  /* ---------- Hero Section ---------- */
  heroSection: {
    marginBottom: 32,
    gap: 12,
  },
  heroTitle: {
    fontFamily: 'PlusJakartaSans-ExtraBold',
    fontSize: 48,
    color: C.onSurface,
    letterSpacing: -1.2,
  },
  heroSubtitle: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 16,
    lineHeight: 24,
    color: C.onSurfaceVariant,
    maxWidth: 320,
  },

  /* ---------- Bento Grid ---------- */
  bentoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 32,
  },
  bentoCard: {
    width: (SCREEN_W - 64) / 2, // Beautiful 2 column wrap
    minHeight: 180,
    backgroundColor: C.surfaceContainerLow,
    borderRadius: 24,
    padding: 20,
    position: 'relative',
    overflow: 'hidden',
    shadowColor: '#363228',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.02,
    shadowRadius: 24,
    elevation: 1,
  },
  cardProfile: {
    borderRadius: 28,
  },
  cardNotifications: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 12, // Asymmetrical top-right corner from spec
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  cardDevices: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderBottomLeftRadius: 12, // Asymmetrical bottom-left corner from spec
    borderBottomRightRadius: 28,
  },
  cardPrivacy: {
    borderRadius: 28,
  },
  iconWrapper: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 16,
    lineHeight: 22,
    color: C.onSurface,
    marginBottom: 4,
  },
  cardDesc: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    lineHeight: 16,
    color: C.onSurfaceVariant,
  },
  cardBlobProfile: {
    position: 'absolute',
    bottom: -24,
    right: -24,
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(68,103,77,0.1)',
  },
  cardBlobPrivacy: {
    position: 'absolute',
    top: -24,
    left: -24,
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(197,236,204,0.15)',
  },

  /* ---------- Action Section ---------- */
  actionSection: {
    alignItems: 'center',
    marginBottom: 50,
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.errorLight,
    color: C.error,
    paddingHorizontal: 28,
    paddingVertical: 16,
    borderRadius: 9999,
    gap: 8,
  },
  signOutButtonDisabled: {
    opacity: 0.6,
  },
  signOutIcon: {
    marginRight: 2,
  },
  signOutText: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 14,
    lineHeight: 20,
    color: C.onSurface,
  },

  /* Children Section */
  childrenSection: {
    marginBottom: 32,
  },
  childrenSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: 8,
    marginBottom: 12,
  },
  childrenSectionTitle: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 14,
    color: C.onSurfaceVariant,
    letterSpacing: 0.5,
  },
  countBadge: {
    backgroundColor: C.surfaceContainerHighest,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  countBadgeText: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 12,
    color: C.onSurfaceVariant,
  },
  emptyStateCard: {
    backgroundColor: C.surfaceContainerLowest,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#363228',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.02,
    shadowRadius: 12,
    elevation: 1,
  },
  emptyStateText: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 14,
    color: C.outline,
    marginBottom: 16,
  },
  pairNewDeviceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 9999,
    gap: 8,
  },
  pairNewDeviceBtnText: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 13,
    color: C.onPrimary,
  },
  childRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.surfaceContainerLowest,
    borderRadius: 32,
    paddingHorizontal: 16,
    paddingVertical: 14,
    shadowColor: '#363228',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.02,
    shadowRadius: 12,
    elevation: 1,
    marginBottom: 12,
  },
  childAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: C.surfaceContainerHigh,
  },
  childDetails: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  childNameText: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 16,
    color: C.onSurface,
    marginBottom: 2,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    color: C.onSurfaceVariant,
  },
  childActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },

  /* Bottom Spacer */
  bottomSpacer: {
    height: 130,
  },
  permissionsSection: {
    marginBottom: 32,
    gap: 8,
  },
  permissionsSectionTitle: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 14,
    color: C.onSurfaceVariant,
    letterSpacing: 0.5,
    marginLeft: 8,
    marginBottom: 4,
  },

});