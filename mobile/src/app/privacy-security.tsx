import React from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '@/hooks/use-auth-store';
import { useSubscriptionStore } from '@/hooks/use-subscription-store';
import { useAppModal } from '@/hooks/use-app-modal';
import { supabase } from '@/lib/supabase';

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
  white: '#ffffff',
} as const;

export default function PrivacySecurityScreen() {
  const { showModal } = useAppModal();

  const handleSignOutAll = () => {
    showModal({
      title: 'Sign out everywhere',
      message: 'This will sign you out on all devices. You\'ll need to sign in again.',
      icon: 'warning',
      primaryButton: 'Sign out',
      primaryVariant: 'destructive',
      secondaryButton: 'Cancel',
      onPrimaryPress: async () => {
        try {
          await supabase.auth.signOut();
          useAuthStore.getState().resetAuth();
          useSubscriptionStore.getState().clear();
          router.replace('/login');
        } catch {
        }
      },
    });
  };

  const handleClearNotifications = () => {
    showModal({
      title: 'Clear local cache',
      message: 'Clear all locally stored notification data. Server copies are not affected.',
      icon: 'warning',
      primaryButton: 'Clear',
      primaryVariant: 'destructive',
      secondaryButton: 'Cancel',
      onPrimaryPress: () => {},
    });
  };

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
        <Text style={s.headerTitle}>Privacy & Security</Text>
        <View style={s.headerRightSpacer} />
      </View>

      <ScrollView contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Encryption explainer */}
        <View style={s.card}>
          <View style={[s.iconCircle, { backgroundColor: C.primaryContainer }]}>
            <Ionicons name="lock-closed" size={20} color={C.primary} />
          </View>
          <Text style={s.cardTitle}>End-to-End Encryption</Text>
          <Text style={s.cardDesc}>
            Notification content is encrypted at rest with AES-256-GCM using a per-pair key. Only you and your paired device can read the actual notification data.
          </Text>
          <View style={s.statusRow}>
            <View style={[s.statusDot, { backgroundColor: C.primary }]} />
            <Text style={s.statusText}>Encryption active</Text>
          </View>
        </View>

        {/* Data retention */}
        <View style={s.card}>
          <View style={[s.iconCircle, { backgroundColor: C.tertiaryContainer }]}>
            <Ionicons name="time" size={20} color={C.tertiary} />
          </View>
          <Text style={s.cardTitle}>Data Retention</Text>
          <Text style={s.cardDesc}>
            Notification history is kept based on your subscription tier. Guardian: 30 days. Guardian+: 90 days. Revoking a pair deletes all mirrored data immediately.
          </Text>
        </View>

        {/* Legal & Policy Actions */}
        <View style={s.actionsSection}>
          <TouchableOpacity style={s.actionCard} onPress={() => router.push('/legal-document?key=privacy')} activeOpacity={0.7}>
            <View style={s.actionLeft}>
              <Ionicons name="document-text" size={20} color={C.primary} />
              <Text style={s.actionText}>Privacy Policy</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={C.outline} />
          </TouchableOpacity>

          <TouchableOpacity style={s.actionCard} onPress={() => router.push('/legal-document?key=terms')} activeOpacity={0.7}>
            <View style={s.actionLeft}>
              <Ionicons name="document-text" size={20} color={C.primary} />
              <Text style={s.actionText}>Terms of Service</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={C.outline} />
          </TouchableOpacity>
        </View>

        {/* Danger zone */}
        <View style={s.dangerSection}>
          <Text style={s.dangerSectionTitle}>Danger Zone</Text>

          <TouchableOpacity style={s.dangerCard} onPress={handleClearNotifications} activeOpacity={0.7}>
            <View style={s.actionLeft}>
              <Ionicons name="trash" size={20} color={C.secondary} />
              <View>
                <Text style={s.dangerText}>Clear Local Cache</Text>
                <Text style={s.dangerDesc}>Remove locally cached notification data</Text>
              </View>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={s.dangerCard} onPress={handleSignOutAll} activeOpacity={0.7}>
            <View style={s.actionLeft}>
              <Ionicons name="log-out" size={20} color={C.secondary} />
              <View>
                <Text style={s.dangerText}>Sign Out Everywhere</Text>
                <Text style={s.dangerDesc}>Sign out on all devices</Text>
              </View>
            </View>
          </TouchableOpacity>
        </View>

        <Text style={s.footer}>Sync Guardian v1.0.0</Text>
      </ScrollView>
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
  scrollContent: { paddingHorizontal: 24, paddingBottom: 60, paddingTop: 8, gap: 16 },

  card: {
    backgroundColor: C.surfaceContainerLowest, borderRadius: 28, padding: 24,
    shadowColor: '#363228', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 12, elevation: 2, gap: 10,
  },
  iconCircle: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
  cardTitle: { fontFamily: 'PlusJakartaSans-Bold', fontSize: 16, color: C.onSurface },
  cardDesc: { fontFamily: 'PlusJakartaSans-Regular', fontSize: 13, color: C.onSurfaceVariant, lineHeight: 20 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontFamily: 'PlusJakartaSans-SemiBold', fontSize: 12, color: C.primary },

  actionsSection: { gap: 10 },
  actionCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: C.surfaceContainerLowest, borderRadius: 20, padding: 16,
    shadowColor: '#363228', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.03, shadowRadius: 8, elevation: 1,
  },
  actionLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  actionText: { fontFamily: 'PlusJakartaSans-SemiBold', fontSize: 14, color: C.onSurface },

  dangerSection: { gap: 10, marginTop: 8 },
  dangerSectionTitle: { fontFamily: 'PlusJakartaSans-ExtraBold', fontSize: 12, color: C.secondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  dangerCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: C.surfaceContainerLowest, borderRadius: 20, padding: 16, borderLeftWidth: 3, borderLeftColor: C.secondary,
    shadowColor: '#363228', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.03, shadowRadius: 8, elevation: 1,
  },
  dangerText: { fontFamily: 'PlusJakartaSans-SemiBold', fontSize: 14, color: C.secondary },
  dangerDesc: { fontFamily: 'PlusJakartaSans-Regular', fontSize: 12, color: C.onSurfaceVariant, marginTop: 2 },

  footer: { fontFamily: 'PlusJakartaSans-Regular', fontSize: 12, color: C.outline, textAlign: 'center', marginTop: 16 },
});
