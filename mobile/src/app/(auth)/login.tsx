import { useState, useEffect } from 'react';
import { StyleSheet, View, Text, Dimensions, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import Animated, { useAnimatedStyle, useSharedValue, withTiming, withDelay, withRepeat, Easing } from 'react-native-reanimated';
import { MaterialIcons } from '@expo/vector-icons';
import Svg, { Path, Defs, Stop, Rect, LinearGradient } from 'react-native-svg';
import { Button } from '@/components/ui/button';
import { EdgeFadeScrollView } from '@/components/ui/edge-fade';
import { AuthColors, AuthFonts, AuthSpacing, AuthRadius } from '@/constants/auth-theme';
import { useAuth } from '@/hooks/use-auth';
import { useAuthStore } from '@/hooks/use-auth-store';
import { getOnboardingState } from '@/services/onboarding-api';
import { useAppModal } from '@/hooks/use-app-modal';
import { logger } from '@/services/logger';

const blobPath = "M107.52 0 A148.48 115.2 0 0 1 256 115.2 A179.2 140.8 0 0 1 76.8 256 A76.8 140.8 0 0 1 0 115.2 A107.52 115.2 0 0 1 107.52 0 Z";
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const googleLogo = require('../../../assets/images/google-logo.png');

const features = [
  {
    icon: 'shield' as const,
    title: 'Safer',
    subtitle: 'Habits',
    accent: 'primary' as const,
  },
  {
    icon: 'insights' as const,
    title: 'Clear',
    subtitle: 'Insights',
    accent: 'secondary' as const,
  },
  {
    icon: 'family-restroom' as const,
    title: 'Built for',
    subtitle: 'Families',
    accent: 'tertiary' as const,
  },
];

const accentMap = {
  primary: { from: AuthColors.primary, to: AuthColors.primaryFixedDim, mark: AuthColors.primaryFixed },
  secondary: { from: AuthColors.secondary, to: AuthColors.secondaryFixedDim, mark: AuthColors.secondaryFixed },
  tertiary: { from: AuthColors.tertiary, to: AuthColors.tertiaryFixedDim, mark: AuthColors.tertiaryFixed },
} as const;

function FeatureCard({ icon, title, subtitle, index, accent }: {
  icon: keyof typeof MaterialIcons.glyphMap;
  title: string;
  subtitle: string;
  index: number;
  accent: keyof typeof accentMap;
}) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(24);

  useEffect(() => {
    opacity.value = withDelay(400 + index * 150, withTiming(1, { duration: 500 }));
    translateY.value = withDelay(400 + index * 150, withTiming(0, { duration: 500, easing: Easing.out(Easing.cubic) }));
  }, [index, opacity, translateY]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  const { from, to, mark } = accentMap[accent];
  const gradId = `badge-${index}`;

  return (
    <Animated.View style={[styles.cardOuter, animatedStyle]}>
      <View style={styles.card}>
        <Svg width={44} height={44} viewBox="0 0 44 44" style={styles.iconBadge}>
          <Defs>
            <LinearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor={from} />
              <Stop offset="100%" stopColor={to} />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="44" height="44" rx="12" fill={`url(#${gradId})`} />
        </Svg>
        <View style={styles.iconOverlay}>
          <MaterialIcons name={icon} size={22} color="#ffffff" />
        </View>

        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.cardSubtitle}>{subtitle}</Text>

        <View style={[styles.watermark, { opacity: 0.12 }]}>
          <MaterialIcons name={icon} size={72} color={mark} />
        </View>
      </View>
    </Animated.View>
  );
}

function GlowOrb({ id, color, blobSize, baseX, baseY, ampX, ampY, freqX, freqY, phaseX, phaseY, opacityMin, opacityMax, duration }: {
  id: string;
  color: string;
  blobSize: number;
  baseX: number;
  baseY: number;
  ampX: number;
  ampY: number;
  freqX: number;
  freqY: number;
  phaseX: number;
  phaseY: number;
  opacityMin: number;
  opacityMax: number;
  duration: number;
}) {
  const progress = useSharedValue(0);
  const opacity = useSharedValue(opacityMin);
  const scale = useSharedValue(1);

  useEffect(() => {
    progress.value = withRepeat(withTiming(1, { duration, easing: Easing.linear }), -1);
    opacity.value = withRepeat(withTiming(opacityMax, { duration: duration * 0.45 }), -1, true);
    scale.value = withRepeat(withTiming(1.1, { duration: duration * 0.3 }), -1, true);
  }, [duration, opacity, opacityMax, progress, scale]);

  const animStyle = useAnimatedStyle(() => {
    const p = progress.value * 2 * Math.PI;
    const dx = baseX + Math.cos(p * freqX + phaseX) * ampX;
    const dy = baseY + Math.sin(p * freqY + phaseY) * ampY;
    return {
      opacity: opacity.value,
      transform: [
        { translateX: dx },
        { translateY: dy },
        { scale: scale.value },
      ],
    };
  });

  return (
    <Animated.View style={[StyleSheet.absoluteFill, animStyle]} pointerEvents="none">
      <Svg width={blobSize} height={blobSize} viewBox="0 0 256 256" style={{ position: 'absolute' }}>
        <Defs>
          <LinearGradient id={id} x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor={color} stopOpacity={0.4} />
            <Stop offset="100%" stopColor={color} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Path d={blobPath} fill={`url(#${id})`} opacity={0.85} />
      </Svg>
    </Animated.View>
  );
}

function RotatingBlob() {
  const rotation = useSharedValue(0);

  useEffect(() => {
    rotation.value = withRepeat(withTiming(360, { duration: 35000, easing: Easing.linear }), -1);
  }, [rotation]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  return (
    <Animated.View style={[StyleSheet.absoluteFill, animStyle]} pointerEvents="none">
      <Svg
        width={SCREEN_WIDTH * 1.5}
        height={SCREEN_HEIGHT * 1.5}
        viewBox="0 0 256 256"
        style={{
          position: 'absolute',
          bottom: -SCREEN_HEIGHT * 0.25,
          right: -SCREEN_WIDTH * 0.25,
        }}
      >
        <Path d={blobPath} fill={AuthColors.primaryFixed} opacity={0.12} />
      </Svg>
    </Animated.View>
  );
}

export default function LoginScreen() {
  const { signInWithGoogle } = useAuth();
  const { showModal } = useAppModal();
  const [loading, setLoading] = useState(false);
  const { width: screenWidth } = useWindowDimensions();
  const isWide = screenWidth >= 600;

  const screenOpacity = useSharedValue(0);

  useEffect(() => {
    screenOpacity.value = withTiming(1, { duration: 600 });
  }, [screenOpacity]);

  const routeAfterLogin = async () => {
    const state = await getOnboardingState();
    if (state.selected_role) {
      useAuthStore.getState().setUserRole(state.selected_role);
    }
    if (state.selected_role === 'admin') {
      router.replace('/(admin)/dashboard');
      return;
    }
    // Stale-row immunity: a pairs row only exists after a token claim, so
    // its presence at a pre-pairing step means the onboarding_state row went
    // stale — never funnel an already-paired user back into /pairing.
    const stalePrePairingStep =
      !!state.has_active_pair &&
      ['role_selection', 'permissions', 'pairing'].includes(state.onboarding_step);
    if (state.onboarding_completed || stalePrePairingStep) {
      if (state.selected_role === 'child') {
        router.replace('/(child)/home');
      } else {
        router.replace('/(tabs)/home');
      }
      return;
    }
    router.replace('/onboarding');
  };

  const handleGoogle = async () => {
    try {
      setLoading(true);
      await signInWithGoogle();
      await routeAfterLogin();
    } catch (err: any) {
      logger.error('Google sign-in error:', err?.message);
      if (!err.message?.includes('cancelled')) {
        showModal({
          title: 'Sign-In Failed',
          message: err.message || 'An error occurred',
          icon: 'error',
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLegalPlaceholder = () => {
    showModal({
      title: 'Coming Soon',
      message: 'Terms and Privacy pages are under development.',
      icon: 'info',
    });
  };

  const animatedScreenStyle = useAnimatedStyle(() => ({ opacity: screenOpacity.value }));

  return (
    <Animated.View style={[styles.container, animatedScreenStyle]}>
      <GlowOrb id="orb1" color="#c5eccc" blobSize={240} baseX={SCREEN_WIDTH / 2} baseY={SCREEN_HEIGHT / 2} ampX={SCREEN_WIDTH * 0.45} ampY={SCREEN_HEIGHT * 0.38} freqX={3} freqY={2} phaseX={0} phaseY={0} opacityMin={0.5} opacityMax={1} duration={15000} />
      <GlowOrb id="orb2" color="#ffdad3" blobSize={200} baseX={SCREEN_WIDTH / 2} baseY={SCREEN_HEIGHT / 2} ampX={SCREEN_WIDTH * 0.38} ampY={SCREEN_HEIGHT * 0.34} freqX={4} freqY={3} phaseX={1.2} phaseY={0.8} opacityMin={0.4} opacityMax={0.85} duration={18000} />
      <GlowOrb id="orb3" color="#d3fbda" blobSize={180} baseX={SCREEN_WIDTH / 2} baseY={SCREEN_HEIGHT / 2} ampX={SCREEN_WIDTH * 0.4} ampY={SCREEN_HEIGHT * 0.36} freqX={5} freqY={4} phaseX={2.5} phaseY={1.7} opacityMin={0.4} opacityMax={0.8} duration={12000} />
      <RotatingBlob />

      <EdgeFadeScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        fadeColor={AuthColors.background}
      >
        <View style={[styles.contentCenter, isWide && styles.contentCenterWide]}>
          <View style={styles.heroSection}>
            <View style={styles.logoContainer}>
              <Svg width={200} height={200} viewBox="0 0 256 256" style={styles.logoSvg}>
                <Defs>
                  <LinearGradient id="hearthGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <Stop offset="0%" stopColor="#2f4a37" />
                    <Stop offset="100%" stopColor="#c5eccc" />
                  </LinearGradient>
                </Defs>
                <Path d={blobPath} fill="url(#hearthGrad)" />
              </Svg>
              <View style={styles.iconOnLogo}>
                <MaterialIcons name="spa" size={56} color="#e8ffea" />
              </View>
            </View>


            <Text style={[styles.headingText, { marginBottom: 4 }]}>Protect Their</Text>
            <Text style={styles.headingText}>
              <Text style={styles.headingAccent}>Digital</Text> World
            </Text>

            <Text style={styles.description}>
              Understand screen time, guide app usage, and build healthier digital habits.
            </Text>
          </View>

          <View style={styles.cardsContainer}>
            {features.map((f, i) => (
              <FeatureCard key={f.icon} icon={f.icon} title={f.title} subtitle={f.subtitle} accent={f.accent} index={i} />
            ))}
          </View>

          <View style={styles.ctaSection}>
            <Button
              title={loading ? 'Signing in...' : 'Continue with Google'}
              imageSource={googleLogo}
              onPress={handleGoogle}
              disabled={loading}
              variant="white"
              style={styles.googleBtn}
            />
          </View>

          <Text style={styles.privacyNote}>
            <Text style={styles.legalLink} onPress={handleLegalPlaceholder}>Terms of Service</Text>
            {' · '}
            <Text style={styles.legalLink} onPress={handleLegalPlaceholder}>Privacy Policy</Text>
          </Text>
        </View>
      </EdgeFadeScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AuthColors.background,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: AuthSpacing.xxxl,
  },
  contentCenter: {
    width: '100%',
    maxWidth: 448,
    paddingHorizontal: AuthSpacing.lg,
  },
  contentCenterWide: {
    maxWidth: 880,
  },
  heroSection: {
    alignItems: 'center',
    marginBottom: AuthSpacing.xxl,
  },
  logoContainer: {
    width: 200,
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: AuthSpacing.md,
    shadowColor: '#363228',
    shadowOffset: { width: 0, height: 24 },
    shadowOpacity: 0.08,
    shadowRadius: 32,
    elevation: 8,
  },
  logoSvg: {
    position: 'absolute',
  },
  iconOnLogo: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headingText: {
    ...AuthFonts.displaySmall,
    color: AuthColors.onSurface,
    textAlign: 'center',
    marginBottom: AuthSpacing.sm,
  },
  headingAccent: {
    color: AuthColors.primary,
    fontStyle: "italic",
    fontWeight: "bold"
  },
  description: {
    ...AuthFonts.bodyLarge,
    color: AuthColors.onSurfaceVariant,
    textAlign: 'center',
  },
  cardsContainer: {
    flexDirection: 'row',
    gap: AuthSpacing.md,
    marginBottom: AuthSpacing.xxl,
    width: '100%',
  },
  cardOuter: {
    flex: 1,
    minWidth: 0,
  },
  card: {
    backgroundColor: AuthColors.surfaceContainerHighest,
    borderRadius: AuthRadius.xl,
    padding: 16,
    position: 'relative',
    shadowColor: AuthColors.inverseSurface,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  iconBadge: {
    marginBottom: 12,
  },
  iconOverlay: {
    position: 'absolute',
    top: 16,
    left: 16,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    ...AuthFonts.titleSmall,
    fontFamily: 'PlusJakartaSans-Bold',
    fontWeight: '700',
    color: AuthColors.onSurface,
  },
  cardSubtitle: {
    ...AuthFonts.bodySmall,
    color: AuthColors.onSurfaceVariant,
  },
  watermark: {
    position: 'absolute',
    bottom: 4,
    right: 4,
  },
  ctaSection: {
    marginBottom: AuthSpacing.xl,
    width: '100%',
  },
  googleBtn: {
    height: 56,
    borderWidth: 0.5
  },
  privacyNote: {
    ...AuthFonts.labelSmall,
    color: AuthColors.outline,
    textAlign: 'center',
  },
  legalLink: {
    color: AuthColors.primary,
    textDecorationLine: 'underline',
  },
});
