import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, View, TouchableOpacity, Dimensions, Text, ActivityIndicator, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { ThemedView } from '@/components/themed-view';
import { EdgeFadeScrollView } from '@/components/ui/edge-fade';
import { useAuthStore } from '@/hooks/use-auth-store';
import { useAppModal } from '@/hooks/use-app-modal';
import { usePermissionStatus } from '@/hooks/use-permission-status';
import { PermissionStatusRow } from '@/components/permission-status-row';
import { NotifListenerRequestModal } from '@/components/notif-listener-request-modal';
import { NotifListenerSuccessBanner } from '@/components/notif-listener-success-banner';
import { NotificationDiagnosticPanel } from '@/components/notification-diagnostic-panel';
import { DevOptionsModal } from '@/components/dev-options-modal';
import * as NotificationAccess from 'notification-access';
import { supabase } from '@/lib/supabase';
import { isValidUUID } from '@/lib/uuid';
import { clearBufferedNotifications } from '@/services/mmkv-buffer';
import Animated, { useSharedValue, useAnimatedStyle } from 'react-native-reanimated';

const { width: SCREEN_W } = Dimensions.get('window');

const C = {
  primary: '#2f4a37',
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
  white: '#ffffff',
} as const;

export default function ChildSettingsScreen() {
  const { deviceId, pairId, resetAuth, clearPair } = useAuthStore();
  const { showModal } = useAppModal();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pairStatus, setPairStatus] = useState<'active' | 'revoked' | 'pending' | null>(null);
  const [devTapCount, setDevTapCount] = useState(0);
  const [showDevPanel, setShowDevPanel] = useState(false);
  const openDevPanel = useCallback(() => {
    setDevTapCount(0);
    setShowDevPanel(true);
  }, []);
  const closeDevPanel = useCallback(() => {
    setShowDevPanel(false);
  }, []);

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      if (isValidUUID(pairId)) {
        const { data } = await supabase
          .from('pairs')
          .select('status')
          .eq('id', pairId)
          .single();
        if (data) {
          setPairStatus(data.status as 'active' | 'revoked' | 'pending');
        }
      }
    } finally {
      setIsRefreshing(false);
    }
  }, [pairId]);

  useEffect(() => {
    if (isValidUUID(pairId)) {
      supabase.from('pairs').select('status').eq('id', pairId).single().then(({ data }) => {
        if (data) setPairStatus(data.status as 'active' | 'revoked' | 'pending');
      });
    }
  }, [pairId]);

  const screenOpacity = useSharedValue(1);
  const containerAnimatedStyle = useAnimatedStyle(() => ({
    opacity: screenOpacity.value,
  }));

  const handleReconnect = () => {
    clearPair();
    router.replace('/pairing');
  };

  const handleDisconnect = () => {
    showModal({
      title: 'Disconnect',
      message: 'Are you sure you want to unpair from the Parent Device? You can reconnect later without signing out.',
      icon: 'warning',
      primaryButton: 'Disconnect',
      primaryVariant: 'destructive',
      onPrimaryPress: async () => {
        setIsDisconnecting(true);
        try {
          if (pairId) {
            const { error } = await supabase.functions.invoke('revoke-pair', { body: { pair_id: pairId } });
            if (error) {
              let realMsg = error.message;
              try {
                const body = error.context && await error.context.json();
                if (body?.error) realMsg = body.error;
              } catch {}
              throw new Error(realMsg);
            }
          }
          clearPair();
          clearBufferedNotifications();
          router.replace('/pairing');
        } catch (e: any) {
          showModal({
            title: 'Disconnect Failed',
            message: e?.message || 'Could not disconnect from the parent device. Please try again.',
            icon: 'error',
          });
        } finally {
          setIsDisconnecting(false);
        }
      },
      secondaryButton: 'Cancel',
    });
  };

  const performSignOut = async () => {
    setIsSigningOut(true);
    try {
      await supabase.auth.signOut();
    } catch { }
    resetAuth();
    router.replace('/login');
  };

  const handleLogout = () => {
    showModal({
      title: 'Log Out',
      message: 'Are you sure you want to log out completely?',
      icon: 'warning',
      primaryButton: 'Log Out',
      onPrimaryPress: performSignOut,
      secondaryButton: 'Cancel',
    });
  };

  const { showModal: showPermModal } = useAppModal();
  const permissions = usePermissionStatus('child')
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
            {/* ========== HERO SECTION ========== */}
            <View style={s.heroSection}>
              <Text style={s.heroTitle}>Your Settings</Text>
              <Text style={s.heroSubtitle}>
                View your connection status and manage your device settings securely.
              </Text>
            </View>

            {/* ========== BENTO GRID SECTION ========== */}
            <View style={s.bentoGrid}>
              {/* Card 1: Connection Info */}
              <View style={[s.bentoCard, s.cardProfile]}>
                <View style={[s.iconWrapper, { backgroundColor: C.primaryContainer }]}>
                  <Ionicons name="link" size={26} color={C.primary} />
                </View>
                <Text style={s.cardTitle}>Paired Guardian</Text>
                <Text style={s.cardDesc}>
                  {pairStatus === 'revoked'
                    ? 'Connection has been removed.'
                    : pairStatus === 'pending'
                    ? 'Waiting for parent confirmation...'
                    : pairStatus === 'active'
                    ? 'Connected to Parent Device securely.'
                    : 'Checking connection...'}
                </Text>
                <View style={s.cardBlobProfile} />
              </View>

              {/* Card 2: Device Info */}
              <View style={[s.bentoCard, s.cardDevices]}>
                <View style={[s.iconWrapper, { backgroundColor: C.surfaceVariant }]}>
                  <Ionicons name="phone-portrait" size={26} color={C.onSurfaceVariant} />
                </View>
                <Text style={s.cardTitle}>Device ID</Text>
                <Text style={s.cardDesc} numberOfLines={1}>{deviceId || 'Unknown'}</Text>
              </View>

              {/* Card 3: App Version */}
              <View style={[s.bentoCard, s.cardPrivacy]}>
                <View style={[s.iconWrapper, { backgroundColor: C.tertiaryContainer }]}>
                  <Ionicons name="information-circle" size={26} color={C.tertiary} />
                </View>
                <Text style={s.cardTitle}>App Version</Text>
                <Text style={s.cardDesc}>1.0.0 (Beta)</Text>
                <View style={s.cardBlobPrivacy} />
              </View>
            </View>

            {/* ========== PERMISSIONS SECTION ========== */}
            <PermissionsSection />

            {/* ========== DIAGNOSTIC PANEL ========== */}
            <NotificationDiagnosticPanel />

            {/* ========== REVOKED BANNER ========== */}
            {pairStatus === 'revoked' && (
              <View style={s.revokedBanner}>
                <Ionicons name="alert-circle" size={24} color={C.error} />
                <View style={s.revokedBannerText}>
                  <Text style={s.revokedBannerTitle}>Pair Disconnected</Text>
                  <Text style={s.revokedBannerDesc}>Your parent has disconnected this device.</Text>
                </View>
                <TouchableOpacity style={s.reconnectBannerBtn} onPress={handleReconnect}>
                  <Text style={s.reconnectBannerBtnText}>Reconnect</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* ========== ACTION AREA ========== */}
            <View style={s.actionSection}>
              {pairStatus !== 'active' && (
                <TouchableOpacity
                  style={s.reconnectButton}
                  onPress={handleReconnect}
                >
                  <Ionicons name="refresh-outline" size={20} color={C.primary} style={s.actionIcon} />
                  <Text style={s.reconnectText}>Reconnect to Parent</Text>
                </TouchableOpacity>
              )}

              {pairStatus !== 'revoked' && (
                <TouchableOpacity
                  style={s.disconnectButton}
                  onPress={handleDisconnect}
                  disabled={isDisconnecting}
                >
                  {isDisconnecting ? (
                    <ActivityIndicator size="small" color={C.secondary} style={s.actionIcon} />
                  ) : (
                    <Ionicons name="close-circle-outline" size={20} color={C.secondary} style={s.actionIcon} />
                  )}
                  <Text style={s.disconnectText}>Disconnect Parent</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={s.logoutButton}
                onPress={handleLogout}
                disabled={isSigningOut}
              >
                {isSigningOut ? (
                  <ActivityIndicator size="small" color={C.onPrimary} style={s.actionIcon} />
                ) : (
                  <Ionicons name="log-out-outline" size={20} color={C.onPrimary} style={s.actionIcon} />
                )}
                <Text style={s.logoutText}>Log Out</Text>
              </TouchableOpacity>
            </View>

            {/* Hidden developer diagnostics ,  tap version 7× */}
            <TouchableOpacity
              style={s.versionTapArea}
              onPress={() => {
                const next = devTapCount + 1;
                if (next >= 7) {
                  openDevPanel();
                } else {
                  setDevTapCount(next);
                }
              }}
              activeOpacity={0.6}
            >
              <Text style={s.versionText}>Sync Guardian v1.0.0</Text>
              {devTapCount > 0 && devTapCount < 7 ? (
                <Text style={s.versionHint}>{7 - devTapCount} more tap(s)</Text>
              ) : null}
            </TouchableOpacity>

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
        <DevOptionsModal
          visible={showDevPanel}
          onClose={closeDevPanel}
          role="child"
        />
      </Animated.View>
    </ThemedView>
  );
}

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
  heroSection: {
    marginBottom: 32,
    gap: 12,
  },
  heroTitle: {
    fontFamily: 'PlusJakartaSans-ExtraBold',
    fontSize: 48,
    color: C.onSurface,
  },
  heroSubtitle: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 16,
    lineHeight: 24,
    color: C.onSurfaceVariant,
    maxWidth: 320,
  },
  bentoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 32,
  },
  bentoCard: {
    width: (SCREEN_W - 64) / 2,
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
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderBottomLeftRadius: 12,
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
  actionSection: {
    alignItems: 'center',
    marginTop: 8,
    gap: 12,
    width: '100%',
  },
  actionIcon: {
    marginRight: 2,
  },
  reconnectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.primaryContainer,
    paddingHorizontal: 28,
    paddingVertical: 16,
    borderRadius: 9999,
    gap: 8,
    width: '100%',
  },
  reconnectText: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 14,
    lineHeight: 20,
    color: C.primary,
  },
  revokedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.surfaceContainerLowest,
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    gap: 12,
    borderLeftWidth: 4,
    borderLeftColor: C.error,
  },
  revokedBannerText: {
    flex: 1,
    gap: 2,
  },
  revokedBannerTitle: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 14,
    lineHeight: 18,
    color: C.onSurface,
  },
  revokedBannerDesc: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    lineHeight: 16,
    color: C.onSurfaceVariant,
  },
  reconnectBannerBtn: {
    backgroundColor: C.error,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
  },
  reconnectBannerBtnText: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 12,
    color: C.white,
  },
  disconnectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.secondaryContainer,
    paddingHorizontal: 28,
    paddingVertical: 16,
    borderRadius: 9999,
    gap: 8,
    width: '100%',
  },
  disconnectText: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 14,
    lineHeight: 20,
    color: C.secondary,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.primary,
    paddingHorizontal: 28,
    paddingVertical: 16,
    borderRadius: 9999,
    gap: 8,
    width: '100%',
  },
  logoutText: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 14,
    lineHeight: 20,
    color: C.onPrimary,
  },
  bottomSpacer: {
    height: 130,
  },
  versionTapArea: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  versionText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    color: C.outline,
  },
  versionHint: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 10,
    color: C.primary,
    marginTop: 4,
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
