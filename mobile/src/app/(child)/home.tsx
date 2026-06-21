import React, { useEffect, useState } from 'react';
import { StyleSheet, ScrollView, View, TouchableOpacity, Dimensions, Text, Alert, BackHandler } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, withSequence, runOnJS } from 'react-native-reanimated';
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { BlurView, BlurTargetView } from 'expo-blur';
import { ThemedView } from '@/components/themed-view';
import { useAuthStore } from '@/hooks/use-auth-store';
import { supabase } from '@/lib/supabase';

const { width: SCREEN_W } = Dimensions.get('window');

// ============================================================
// EXACT STITCH COLORS (from v1 + v2 HTML Tailwind config)
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

export default function ChildHome() {
  const { pairId } = useAuthStore();
  const [parentName, setParentName] = useState('Parent Device');

  useEffect(() => {
    // Intercept hardware back button
    const backAction = () => {
      Alert.alert('Exit App', 'Are you sure you want to exit?', [
        { text: 'Cancel', onPress: () => null, style: 'cancel' },
        { text: 'YES', onPress: () => BackHandler.exitApp() },
      ]);
      return true; // Prevents default behavior
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => backHandler.remove();
  }, []);

  useEffect(() => {
    // Fetch the parent's device name from the pairing table
    const fetchParentName = async () => {
      if (!pairId) return;
      const { data, error } = await supabase
        .from('pairs')
        .select('parent_device:devices!parent_device_id(device_name)')
        .eq('id', pairId)
        .single();
      
      if (data && data.parent_device) {
        setParentName((data.parent_device as any).device_name || 'Parent Device');
      }
    };
    fetchParentName();
  }, [pairId]);

  const blurTargetRef = React.useRef<View>(null);
  
  // Animation Values
  const scale = useSharedValue(1);
  const topLeft = useSharedValue(110);
  const topRight = useSharedValue(130);
  const bottomLeft = useSharedValue(90);
  const bottomRight = useSharedValue(140);
  const rotation = useSharedValue(0);

  useEffect(() => {
    // Smooth pulsing scale animation
    scale.value = withRepeat(
      withSequence(
        withTiming(1.03, { duration: 4000 }),
        withTiming(0.97, { duration: 4000 })
      ),
      -1,
      true
    );

    // Smooth fluid morphing border radiuses with staggered durations for organic shapes
    topLeft.value = withRepeat(
      withSequence(
        withTiming(150, { duration: 3800 }),
        withTiming(65, { duration: 4500 }),
        withTiming(110, { duration: 4000 })
      ),
      -1,
      true
    );

    topRight.value = withRepeat(
      withSequence(
        withTiming(80, { duration: 4200 }),
        withTiming(160, { duration: 3600 }),
        withTiming(130, { duration: 4000 })
      ),
      -1,
      true
    );

    bottomLeft.value = withRepeat(
      withSequence(
        withTiming(140, { duration: 4000 }),
        withTiming(60, { duration: 4800 }),
        withTiming(90, { duration: 4200 })
      ),
      -1,
      true
    );

    bottomRight.value = withRepeat(
      withSequence(
        withTiming(75, { duration: 3700 }),
        withTiming(160, { duration: 4400 }),
        withTiming(140, { duration: 4600 })
      ),
      -1,
      true
    );

    // Smooth fluid rotation (slower)
    rotation.value = withRepeat(
      withSequence(
        withTiming(10, { duration: 8000 }),
        withTiming(-10, { duration: 8000 })
      ),
      -1,
      true
    );
  }, []);

  const animatedBlobStyle = useAnimatedStyle(() => {
    return {
      borderTopLeftRadius: topLeft.value,
      borderTopRightRadius: topRight.value,
      borderBottomLeftRadius: bottomLeft.value,
      borderBottomRightRadius: bottomRight.value,
      transform: [
        { scale: scale.value },
        { rotate: `${rotation.value}deg` }
      ],
    };
  });

  const animatedInnerStyle = useAnimatedStyle(() => {
    return {
      borderTopLeftRadius: topLeft.value * 0.5,
      borderTopRightRadius: topRight.value * 0.5,
      borderBottomLeftRadius: bottomLeft.value * 0.5,
      borderBottomRightRadius: bottomRight.value * 0.5,
      transform: [
        { scale: scale.value },
        { rotate: `${-rotation.value}deg` }
      ],
    };
  });

  return (
    <ThemedView style={s.container}>
      <BlurTargetView ref={blurTargetRef} style={{ flex: 1 }}>
        <SafeAreaView style={s.safeArea} edges={['top']}>
          {/* Floating Glass Header */}
          <View style={s.header}>
            <View style={s.headerLeft}>
              <MaterialCommunityIcons name="spa" size={24} color={C.primary} style={s.headerIcon} />
              <Text style={s.headerTitle}>Sync Guardian</Text>
            </View>
            <View style={s.headerRight}>
              <TouchableOpacity
                style={s.iconButton}
                onPress={() => router.push('/(child)/settings')}
                activeOpacity={0.8}
              >
                <Ionicons name="settings-outline" size={22} color={C.primary} />
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView
            contentContainerStyle={s.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* ========== HERO SECTION ========== */}
            <View style={s.heroSection}>
              {/* Text block */}
              <View style={s.heroTextBlock}>
                <Text style={s.flowLabel}>SYSTEM SECURED</Text>
                <Text style={s.heroTitle}>
                  Digital Sanctuary is{'\n'}
                  <Text style={s.heroTitleAccent}>Active</Text>
                </Text>
                <Text style={s.heroDescription}>
                  Sync Guardian is running quietly in the background, maintaining a safe and focused environment.
                </Text>
              </View>

              {/* Visual block */}
              <View style={s.visualBlock}>
                {/* Decorative blurred blob behind hearth */}
                <View style={s.decoBlobBehind} />

                {/* Hearth Blob Container (clipping wrapper) */}
                <Animated.View
                  style={[s.hearthBlob, animatedBlobStyle]}
                >
                  <LinearGradient
                    colors={[C.primary, C.primaryContainer]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={StyleSheet.absoluteFill}
                  />
                  <Animated.View style={[s.hearthInner, animatedInnerStyle]}>
                    <SymbolView
                      name={"shield_with_heart" as any}
                      size={64}
                      type="monochrome"
                      tintColor="#ffffff"
                    />
                  </Animated.View>
                </Animated.View>

                {/* Floating Timer Card */}
                <View style={s.timerCardContainer}>
                  <BlurView
                    intensity={80}
                    tint="light"
                    style={s.timerCard}
                  >
                    <View style={s.timerHeader}>
                      <Ionicons name="checkmark-circle" size={20} color={C.secondary} />
                      <Text style={s.timerText}>Protection Enabled</Text>
                    </View>
                  </BlurView>
                </View>
              </View>
            </View>

            {/* ========== BENTO GRID SECTION ========== */}
            <View style={s.bentoGrid}>
              
              {/* Card 1: Connection Info (Full Width) */}
              <View style={[s.bentoCard, s.cardConnection]}>
                <View style={[s.iconWrapper, { backgroundColor: C.primaryContainer }]}>
                  <Ionicons name="link" size={24} color={C.primary} />
                </View>
                <View style={s.cardTextWrapper}>
                  <Text style={s.cardTitle}>Guardian Connected</Text>
                  <Text style={s.cardDesc}>Securely linked to {parentName}.</Text>
                </View>
                {/* Background blob */}
                <View style={s.cardBlobConnection} />
              </View>

              {/* Card 2: Current Rhythm (Half Width) */}
              <View style={[s.bentoCard, s.cardRhythm, s.halfWidth]}>
                <View style={[s.iconWrapper, { backgroundColor: C.surfaceVariant }]}>
                  <Ionicons name="leaf-outline" size={24} color={C.onSurfaceVariant} />
                </View>
                <Text style={s.cardTitle}>Today's Rhythm</Text>
                <Text style={s.cardDesc}>Creative Exploration</Text>
              </View>

              {/* Card 3: Privacy (Half Width) */}
              <View style={[s.bentoCard, s.cardPrivacy, s.halfWidth]}>
                <View style={[s.iconWrapper, { backgroundColor: C.tertiaryContainer }]}>
                  <Ionicons name="lock-closed-outline" size={24} color={C.tertiary} />
                </View>
                <Text style={s.cardTitle}>Data Privacy</Text>
                <Text style={s.cardDesc}>Locally encrypted.</Text>
                {/* Background blob */}
                <View style={s.cardBlobPrivacy} />
              </View>
            </View>

            <View style={s.bottomSpacer} />
          </ScrollView>
        </SafeAreaView>
      </BlurTargetView>
    </ThemedView>
  );
}

// ============================================================
// STYLES
// ============================================================
const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.surface,
  },
  safeArea: {
    flex: 1,
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
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: C.white,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#363228',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },

  /* ---------- Hero Section ---------- */
  heroSection: {
    marginBottom: 48,
    gap: 24,
  },
  heroTextBlock: {
    gap: 16,
  },
  flowLabel: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 12,
    letterSpacing: 2.5,
    color: C.secondary,
    textTransform: 'uppercase',
  },
  heroTitle: {
    fontFamily: 'PlusJakartaSans-ExtraBold',
    fontSize: 40,
    lineHeight: 48,
    color: C.onSurface,
    letterSpacing: -1,
  },
  heroTitleAccent: {
    fontFamily: 'PlusJakartaSans-ExtraBoldItalic',
    fontSize: 40,
    lineHeight: 48,
    color: C.primary,
    letterSpacing: -1,
  },
  heroDescription: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 16,
    lineHeight: 24,
    color: C.onSurfaceVariant,
    maxWidth: 320,
  },

  /* Visual block */
  visualBlock: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginTop: 16,
    height: 340,
  },
  decoBlobBehind: {
    position: 'absolute',
    top: -24,
    left: -32,
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(160,65,45,0.10)',
    zIndex: 0,
  },
  hearthBlob: {
    width: 288,
    height: 288,
    borderTopLeftRadius: 144,
    borderTopRightRadius: 144,
    borderBottomLeftRadius: 144,
    borderBottomRightRadius: 144,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
    overflow: 'hidden',
  },
  hearthInner: {
    width: 144,
    height: 144,
    borderRadius: 72,
    backgroundColor: 'rgba(255,255,255,0.20)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.30)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Timer card */
  timerCardContainer: {
    position: 'absolute',
    bottom: 20,
    left: -12,
    zIndex: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.72)',
    borderRadius: 32,
    shadowColor: '#363228',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8,
  },
  timerCard: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 32,
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  timerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timerText: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 14,
    color: C.onSurface,
  },

  /* ---------- Bento Grid ---------- */
  bentoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 32,
  },
  bentoCard: {
    backgroundColor: C.surfaceContainerLowest,
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
  halfWidth: {
    width: (SCREEN_W - 64) / 2,
  },
  cardConnection: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 24,
  },
  cardRhythm: {
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
  cardTextWrapper: {
    flex: 1,
    marginLeft: 16,
    justifyContent: 'center',
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
    fontSize: 13,
    lineHeight: 18,
    color: C.onSurfaceVariant,
  },
  cardBlobConnection: {
    position: 'absolute',
    top: -24,
    right: -24,
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(68,103,77,0.06)',
  },
  cardBlobPrivacy: {
    position: 'absolute',
    bottom: -24,
    right: -24,
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(197,236,204,0.15)',
  },

  bottomSpacer: {
    height: 130,
  },
});
