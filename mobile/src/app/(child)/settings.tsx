import React, { useState, useEffect } from 'react';
import { StyleSheet, ScrollView, View, TouchableOpacity, Image, Dimensions, Text, ActivityIndicator, Modal, TouchableWithoutFeedback, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { ThemedView } from '@/components/themed-view';
import { useAuthStore } from '@/hooks/use-auth-store';
import { supabase } from '@/lib/supabase';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withSpring, runOnJS } from 'react-native-reanimated';

const { width: SCREEN_W } = Dimensions.get('window');

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
  white: '#ffffff',
} as const;

export default function ChildSettingsScreen() {
  const { deviceId, pairId, resetAuth } = useAuthStore();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  const screenOpacity = useSharedValue(1);
  const containerAnimatedStyle = useAnimatedStyle(() => ({
    opacity: screenOpacity.value,
  }));

  const handleDisconnect = () => {
    Alert.alert('Disconnect', 'Are you sure you want to unpair from the Parent Device?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Disconnect',
        style: 'destructive',
        onPress: async () => {
          setIsDisconnecting(true);
          try {
            if (pairId) {
              await supabase.from('pairs').update({ status: 'revoked' }).eq('id', pairId);
            }
          } catch (e) { }
          resetAuth();
          router.replace('/splash');
        }
      }
    ]);
  };

  const performSignOut = async () => {
    setIsSigningOut(true);
    try {
      await supabase.auth.signOut();
    } catch (e) { }
    resetAuth();
    router.replace('/login');
  };

  const handleLogout = () => {
    Alert.alert('Log Out', 'Are you sure you want to log out completely?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', onPress: performSignOut }
    ]);
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

        <SafeAreaView style={s.safeArea} edges={['top']}>
          {/* Floating Glass Header */}
          <View style={s.header}>
            <View style={s.headerLeft}>
              <MaterialCommunityIcons name="spa" size={24} color={C.primary} style={s.headerIcon} />
              <Text style={s.headerTitle}>Sync Guardian</Text>
            </View>
          </View>

          <ScrollView
            contentContainerStyle={s.scrollContent}
            showsVerticalScrollIndicator={false}
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
                <Text style={s.cardDesc}>Connected to Parent Device securely.</Text>
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

            {/* ========== ACTION AREA ========== */}
            <View style={s.actionSection}>
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

            {/* Bottom spacing */}
            <View style={s.bottomSpacer} />
          </ScrollView>
        </SafeAreaView>
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
  safeArea: {
    flex: 1,
    zIndex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: 'rgba(255,248,240,0.80)',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerIcon: {
    marginRight: 2,
  },
  headerTitle: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 18,
    lineHeight: 24,
    color: C.primary,
    letterSpacing: -0.5,
  },
  heroSection: {
    marginTop: 24,
    marginBottom: 32,
    gap: 12,
  },
  heroTitle: {
    fontFamily: 'PlusJakartaSans-ExtraBold',
    fontSize: 48,
    lineHeight: 54,
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
});
