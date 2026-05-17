import React from 'react';
import { StyleSheet, ScrollView, View, TouchableOpacity, Image, Dimensions, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { ThemedView } from '@/components/themed-view';

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
  white: '#ffffff',
} as const;

export default function SettingsScreen() {
  return (
    <ThemedView style={s.container}>
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
        {/* Top Header */}
        <View style={s.header}>
          <View style={s.headerLeft}>
            <TouchableOpacity style={s.profileAvatarButton}>
              <Image
                source={{ uri: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDyWu_oK2OsUAVF5cjtxlALI3xfalPcIqEPtoe8pkco7YdqbtwJpGavDU41OTuryD3QkaGtL5Plg7N1sDIHtzekVITR3eXhIhlKKGU7HSDRGtPXGkAzDV7Qms1eJuqBASs2TCVn9_iQoRSe1oOSkLKyMDVb-oziMPmthpknp0UGF3W1E-0bIFznUwftxRAv7caJScKQNageAF1z2FdM8eDIavuSveHQl8WVgMNmx_XwgHd82kn9jS_4BuC-KlODMgKwBeuG79_A7S8' }}
                style={s.profileAvatarImage}
              />
            </TouchableOpacity>
            <Text style={s.headerTitle}>Nurturing Atelier</Text>
          </View>

          <TouchableOpacity style={s.notificationButton}>
            <Ionicons name="notifications-outline" size={22} color={C.primary} />
            <View style={s.notificationDot} />
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={s.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* ========== HERO SECTION: EDITORIAL ========== */}
          <View style={s.heroSection}>
            <Text style={s.heroTitle}>Sanctuary{'\n'}Spaces</Text>
            <Text style={s.heroSubtitle}>
              Shape the rhythm and boundaries of your digital home. Gentle adjustments for a balanced life.
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
              <Text style={s.cardDesc}>Manage members, update avatars, and nurture your core circle.</Text>
              
              {/* Backing blurry green radial blob */}
              <View style={s.cardBlobProfile} />
            </TouchableOpacity>

            {/* Card 2: Notifications Rhythm (Terracotta Theme) - Custom top-right corner */}
            <TouchableOpacity style={[s.bentoCard, s.cardNotifications]}>
              <View style={[s.iconWrapper, { backgroundColor: C.secondaryContainer }]}>
                <Ionicons name="notifications-circle" size={26} color={C.secondary} />
              </View>
              <Text style={s.cardTitle}>Notifications Rhythm</Text>
              <Text style={s.cardDesc}>Tune alerts to respect your time. Silence the noise, keep the signals.</Text>
            </TouchableOpacity>

            {/* Card 3: Device Sanctuary (Umber Theme) - Custom bottom-left corner */}
            <TouchableOpacity style={[s.bentoCard, s.cardDevices]}>
              <View style={[s.iconWrapper, { backgroundColor: C.surfaceVariant }]}>
                <Ionicons name="laptop" size={26} color={C.onSurfaceVariant} />
              </View>
              <Text style={s.cardTitle}>Device Sanctuary</Text>
              <Text style={s.cardDesc}>Overview connected devices, battery health, and sync status.</Text>
            </TouchableOpacity>

            {/* Card 4: Privacy & Soul (Sage/Cream Blend) */}
            <TouchableOpacity style={[s.bentoCard, s.cardPrivacy]}>
              <View style={[s.iconWrapper, { backgroundColor: C.tertiaryContainer }]}>
                <Ionicons name="key" size={26} color={C.tertiary} />
              </View>
              <Text style={s.cardTitle}>Privacy & Soul</Text>
              <Text style={s.cardDesc}>Data controls, keyword safety, and deep settings for peace of mind.</Text>

              {/* Backing blurry tertiary blob */}
              <View style={s.cardBlobPrivacy} />
            </TouchableOpacity>
          </View>

          {/* ========== ACTION AREA: SIGN OUT GENTLY ========== */}
          <View style={s.actionSection}>
            <TouchableOpacity style={s.signOutButton}>
              <Ionicons name="log-out-outline" size={20} color={C.onSurface} style={s.signOutIcon} />
              <Text style={s.signOutText}>Sign Out Gently</Text>
            </TouchableOpacity>
          </View>

          {/* Bottom spacing */}
          <View style={s.bottomSpacer} />
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

// ============================================================
// STYLES — mapped precisely from Stitch settings.html
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
  safeArea: {
    flex: 1,
    zIndex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 8,
  },

  /* ---------- Header ---------- */
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
    gap: 12,
  },
  profileAvatarButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: C.surfaceContainerHighest,
  },
  profileAvatarImage: {
    width: '100%',
    height: '100%',
  },
  headerTitle: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 20,
    lineHeight: 26,
    color: C.onSurface,
    letterSpacing: -0.5,
  },
  notificationButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: C.surfaceContainerLow,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  notificationDot: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: C.secondary,
  },

  /* ---------- Hero Section ---------- */
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
    marginTop: 8,
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.surfaceContainerHighest,
    paddingHorizontal: 28,
    paddingVertical: 16,
    borderRadius: 9999,
    gap: 8,
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

  /* Bottom Spacer */
  bottomSpacer: {
    height: 130,
  },
});