import React, { useState } from 'react';
import { StyleSheet, View, Text, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/hooks/use-auth-store';
import { usePermissionStatus } from '@/hooks/use-permission-status';
import { PermissionStatusRow } from '@/components/permission-status-row';
import { useAppModal } from '@/hooks/use-app-modal';

const C = {
  primary: '#486730',
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
  const permissions = usePermissionStatus(userRole || 'parent');
  const [loading, setLoading] = useState(false);

  const allGranted = permissions.every((p) => p.granted);

  const handleContinue = () => {
    setLoading(true);
    if (userRole === 'child') {
      router.replace('/(child)/home');
    } else {
      router.replace('/(tabs)/home');
    }
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

        <ScrollView
          contentContainerStyle={s.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={s.heroSection}>
            <Text style={s.heroTitle}>Permissions Needed</Text>
            <Text style={s.heroSubtitle}>
              Sync Guardian needs a few permissions to work properly. You can change these anytime in Settings.
            </Text>
          </View>

          {permissions.map((p) => (
            <PermissionStatusRow
              key={p.key}
              label={p.label}
              granted={p.granted}
              onRequest={() =>
                showModal({
                  title: p.guideTitle,
                  message: p.guideMessage,
                  steps: p.guideSteps,
                  icon: 'info',
                  primaryButton: 'Open Settings',
                  onPrimaryPress: p.openSettings,
                  secondaryButton: 'Cancel',
                })
              }
            />
          ))}

          <Text style={s.noteText}>
            Tap each permission above to see instructions. You can always update these in the Settings screen later.
          </Text>
        </ScrollView>

        <View style={s.footer}>
          <Button
            title={allGranted ? 'Continue' : 'Continue'}
            onPress={handleContinue}
            disabled={loading}
            style={s.continueBtn}
          />
          {!allGranted && (
            <Button
              title="Continue anyway"
              onPress={handleContinue}
              variant="secondary"
              disabled={loading}
              style={s.skipBtn}
            />
          )}
        </View>
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
    paddingVertical: 16,
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
    paddingTop: 8,
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
  noteText: {
    fontFamily: 'Manrope-Medium',
    fontSize: 13,
    lineHeight: 20,
    color: C.onSurfaceVariant,
    textAlign: 'center',
    marginTop: 24,
    opacity: 0.8,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 16,
    gap: 12,
    alignItems: 'center',
  },
  continueBtn: {
    width: '100%',
  },
  skipBtn: {
    width: '100%',
  },
});
