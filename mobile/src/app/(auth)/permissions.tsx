import React, { useState } from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { ThemedView } from '@/components/themed-view';
import { EdgeFadeScrollView } from '@/components/ui/edge-fade';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/hooks/use-auth-store';
import { usePermissionStatus } from '@/hooks/use-permission-status';
import { PermissionStatusRow } from '@/components/permission-status-row';
import { NotifListenerRequestModal } from '@/components/notif-listener-request-modal';
import { NotifListenerSuccessBanner } from '@/components/notif-listener-success-banner';
import { useAppModal } from '@/hooks/use-app-modal';
import { getOnboardingState, setOnboardingRole } from '@/services/onboarding-api';
import * as NotificationAccess from 'notification-access';

const C = {
  primary: '#2f4a37',
  secondary: '#9f402d',
  surface: '#fff8f0',
  onSurface: '#1b1d0e',
  onSurfaceVariant: '#43483d',
  surfaceContainer: '#efefd7',
  surfaceContainerHighest: '#e4e4cc',
  white: '#ffffff',
};

export default function PermissionsScreen() {
  const { userRole } = useAuthStore();
  const { showModal } = useAppModal();
  const permissions = usePermissionStatus(userRole === 'admin' ? 'parent' : (userRole ?? 'parent'))
  const { items: permissionItems, notifListenerModalOpen, openNotifListenerModal, closeNotifListenerModal, recentlyGrantedNotifListener } = permissions;
  const [loading, setLoading] = useState(false);

  const allGranted = permissionItems.every((p) => p.granted);

  const handleContinue = async () => {
    setLoading(true);
    try {
      const state = await getOnboardingState();
      if (!state.onboarding_completed) {
        await setOnboardingRole(userRole as 'parent' | 'child', 'pairing');
      }
    } catch {
      // Non-fatal: hub will re-route based on DB state.
    }
    router.replace('/onboarding');
  };

  return (
    <ThemedView style={s.container}>
      <SafeAreaView style={s.safeArea} edges={['top', 'bottom']}>
        <View style={s.header}>
          <View style={s.headerLogo}>
            <MaterialIcons name="spa" size={24} color={C.primary} />
            <Text style={s.headerTitle}>Sync Guardian</Text>
          </View>
        </View>

        <EdgeFadeScrollView
          contentContainerStyle={s.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={s.heroSection}>
            <Text style={s.heroTitle}>Permissions Needed</Text>
            <Text style={s.heroSubtitle}>
              Sync Guardian needs a few permissions to protect your family. Tap a permission and choose &quot;Yes&quot; to allow it.
            </Text>
          </View>

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
                showModal({
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
        </EdgeFadeScrollView>

        <View style={s.footer}>
          <Button
            title="Continue"
            onPress={handleContinue}
            disabled={loading || !allGranted}
            style={s.continueBtn}
          />
          {!allGranted && (
            <Text style={s.footerHint}>
              Allow each permission above to continue. You can change these anytime in Settings.
            </Text>
          )}
        </View>
        <NotifListenerRequestModal
          visible={notifListenerModalOpen}
          onAccept={() => {
            NotificationAccess?.openNotificationListenerSettingsForApp?.()
          }}
          onClose={closeNotifListenerModal}
        />
        {recentlyGrantedNotifListener && <NotifListenerSuccessBanner />}
      </SafeAreaView>
    </ThemedView>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.surface,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  headerLogo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 18,
    color: C.primary,
    letterSpacing: -0.5,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  heroSection: {
    marginTop: 16,
    marginBottom: 32,
    gap: 12,
  },
  heroTitle: {
    fontFamily: 'PlusJakartaSans-ExtraBold',
    fontSize: 36,
    lineHeight: 42,
    color: C.onSurface,
    letterSpacing: -1.2,
  },
  heroSubtitle: {
    fontFamily: 'Manrope-Medium',
    fontSize: 16,
    lineHeight: 24,
    color: C.onSurfaceVariant,
  },
  footer: {
    paddingHorizontal: 24,
    gap: 12,
    alignItems: 'center',
  },
  continueBtn: {
    width: '100%',
  },
  footerHint: {
    fontFamily: 'Manrope-Medium',
    fontSize: 13,
    lineHeight: 20,
    color: C.secondary,
    textAlign: 'center',
    width: '100%',
    marginTop: 4,
  },
});
