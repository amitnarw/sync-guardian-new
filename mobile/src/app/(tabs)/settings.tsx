import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, View, TouchableOpacity, Text, ActivityIndicator, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { ThemedView } from '@/components/themed-view';
import { EdgeFadeScrollView } from '@/components/ui/edge-fade';
import { useAuthStore } from '@/hooks/use-auth-store';
import { useSubscriptionStore } from '@/hooks/use-subscription-store';
import { useAppModal } from '@/hooks/use-app-modal';
import { usePermissionStatus } from '@/hooks/use-permission-status';
import { PermissionStatusRow } from '@/components/permission-status-row';
import { NotifListenerRequestModal } from '@/components/notif-listener-request-modal';
import { NotifListenerSuccessBanner } from '@/components/notif-listener-success-banner';
import * as NotificationAccess from 'notification-access';
import { ChildAppsModal } from '@/components/ui/child-apps-modal';
import { supabase } from '@/lib/supabase';
import { isValidUUID } from '@/lib/uuid';
import Animated, { useSharedValue, useAnimatedStyle } from 'react-native-reanimated';
import { logger } from '@/services/logger';

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

function SubscriptionSection() {
  const { hasAccess, reason, trialDaysRemaining, subscriptionStatus, subscription } =
    useSubscriptionStore();

  let label = 'Manage';
  let inGracePeriod = false;
  if (hasAccess === false) {
    label = 'Subscribe';
  } else if (reason === 'trial' && trialDaysRemaining != null && trialDaysRemaining > 0) {
    label = `${trialDaysRemaining}d left`;
  } else if (reason === 'subscription') {
    // Cancel/pause paths set status='revoked' (or 'cancelled') but keep
    // current_cycle_end in the future, so hasAccess stays true during the
    // grace period. Reflect that explicitly instead of misleading "Active".
    inGracePeriod =
      (subscriptionStatus === 'revoked' || subscriptionStatus === 'cancelled') &&
      subscription?.current_cycle_end != null &&
      new Date(subscription.current_cycle_end).getTime() > Date.now();
    if (inGracePeriod) {
      label = 'Cancelling';
    } else {
      label = 'Active';
    }
  }

  return (
    <View style={s.subscriptionSection}>
      <View style={s.subscriptionHeader}>
        <View style={[s.iconWrapper, { backgroundColor: C.primaryContainer }]}>
          <Ionicons name="card-outline" size={26} color={C.primary} />
        </View>
        <View style={s.subscriptionText}>
          <Text style={s.cardTitle}>Subscription</Text>
          <Text style={s.subscriptionStatus}>{label}</Text>
        </View>
        <TouchableOpacity
          style={s.subscriptionManageBtn}
          onPress={() => router.push({ pathname: '/(paywall)/manage', params: { from: 'settings' } })}
          activeOpacity={0.7}
        >
          <Text style={s.subscriptionManageText}>
            {!hasAccess
              ? 'View plans'
              : inGracePeriod
                ? 'View details'
                : 'Manage'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
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
    if (!isValidUUID(deviceId)) return;
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
      const { error } = await supabase.functions.invoke('ping-child', {
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
          useAuthStore.getState().markPairRevoked();
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
  const permissions = usePermissionStatus('parent')
  const { items: permissionItems, notifListenerModalOpen, openNotifListenerModal, closeNotifListenerModal, recentlyGrantedNotifListener } = permissions;

  function PermissionsSection() {
    if (permissionItems.length === 0) return null;
    return (
      <View style={s.permissionsSection}>
        <Text style={s.permissionsSectionTitle}>Permissions</Text>
        {permissionItems.map((p) => (
          <PermissionStatusRow
            key={p.key}
            label={p.label}
            description={p.promptMessage}
            granted={p.granted}
            onRequest={() => {
              if (p.key === 'notif_listener') {
                openNotifListenerModal()
                return
              }
              showPermModal({
                title: p.promptTitle,
                message: p.promptMessage,
                icon: 'warning',
                primaryButton: 'Yes',
                onPrimaryPress: p.requestPermission,
                secondaryButton: 'No',
              })
            }}
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
      useSubscriptionStore.getState().clear();
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
              {/* Top row: 2 cards side-by-side */}
              <View style={s.bentoTopRow}>
                <TouchableOpacity style={[s.bentoCard, s.cardProfile]} onPress={() => router.push('/child-account')}>
                  <View style={[s.iconWrapper, { backgroundColor: C.primaryContainer }]}>
                    <Ionicons name="people" size={26} color={C.primary} />
                  </View>
                  <Text style={s.cardTitle}>Profile & Family</Text>
                  <Text style={s.cardDesc}>Manage members, update avatars, and organise your family.</Text>
                  <Ionicons name="chevron-forward" size={16} color={C.outline} style={s.cardCaret} />
                </TouchableOpacity>

                <TouchableOpacity style={[s.bentoCard, s.cardDevices]} onPress={() => router.push('/pairing')}>
                  <View style={[s.iconWrapper, { backgroundColor: C.surfaceVariant }]}>
                    <Ionicons name="qr-code-outline" size={26} color={C.onSurfaceVariant} />
                  </View>
                  <Text style={s.cardTitle}>Pair Device</Text>
                  <Text style={s.cardDesc}>Connect and monitor a new child device via QR code.</Text>
                  <Ionicons name="chevron-forward" size={16} color={C.outline} style={s.cardCaret} />
                </TouchableOpacity>
              </View>

              {/* Bottom row: full-width Privacy & Security */}
              <TouchableOpacity style={[s.bentoCard, s.cardFullWidth]} onPress={() => router.push('/privacy-security')}>
                <View style={[s.iconWrapper, { backgroundColor: C.tertiaryContainer }]}>
                  <Ionicons name="key" size={26} color={C.tertiary} />
                </View>
                <Text style={s.cardTitle}>Privacy & Security</Text>
                <Text style={s.cardDesc}>Data controls, keyword safety, and account settings.</Text>
                <Ionicons name="chevron-forward" size={16} color={C.outline} style={s.cardCaret} />
              </TouchableOpacity>
            </View>

            {/* ========== CONNECTED CHILDREN ========== */}
            <View style={s.childrenSection}>
              <View style={s.childrenSectionHeader}>
                <View style={s.childrenSectionTitleRow}>
                  <Text style={s.childrenSectionTitle}>Connected Devices</Text>
                  <View style={s.countBadge}>
                    <Text style={s.countBadgeText}>{children.length}</Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={s.headerAddBtn}
                  onPress={() => router.push('/pairing')}
                  hitSlop={8}
                  activeOpacity={0.7}
                  accessibilityLabel="Pair new device"
                >
                  <Ionicons name="add" size={20} color={C.primary} />
                </TouchableOpacity>
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

            {/* ========== SUBSCRIPTION SECTION ========== */}
            <SubscriptionSection />

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
          <NotifListenerRequestModal
            visible={notifListenerModalOpen}
            onAccept={() => {
              NotificationAccess.openNotificationListenerSettingsForApp()
            }}
            onClose={closeNotifListenerModal}
          />
          {recentlyGrantedNotifListener && <NotifListenerSuccessBanner />}

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
    gap: 16,
    marginBottom: 32,
  },
  bentoTopRow: {
    flexDirection: 'row',
    gap: 16,
  },
  bentoCard: {
    flex: 1,
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
  cardDevices: {
    borderRadius: 28,
  },
  cardFullWidth: {
    borderRadius: 28,
  },
  cardCaret: {
    position: 'absolute',
    top: 20,
    right: 20,
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

  /* ---------- Action Section ---------- */
  actionSection: {
    alignItems: 'center',
    marginBottom: 50,
  },

  /* ---------- Subscription Section ---------- */
  subscriptionSection: {
    marginBottom: 32,
  },
  subscriptionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: C.surfaceContainerLowest,
    borderRadius: 28,
    padding: 18,
    shadowColor: '#363228',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  subscriptionText: {
    flex: 1,
    gap: 2,
  },
  subscriptionStatus: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 13,
    color: C.onSurfaceVariant,
  },
  subscriptionManageBtn: {
    backgroundColor: C.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 9999,
  },
  subscriptionManageText: {
    fontFamily: 'PlusJakartaSans-SemiBold',
    fontSize: 13,
    color: C.onPrimary,
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
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    marginBottom: 12,
  },
  childrenSectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerAddBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: C.primaryContainer,
    justifyContent: 'center',
    alignItems: 'center',
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