import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import * as ExpoSplashScreen from 'expo-splash-screen';
import Animated, {
  Easing,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
} from 'react-native-reanimated';
import Svg, { Path, Defs, LinearGradient, Stop, RadialGradient, Ellipse } from 'react-native-svg';

export default function SplashScreen() {
  const logoScale = useSharedValue(0);
  const logoOpacity = useSharedValue(0);
  const textOpacity = useSharedValue(0);
  const taglineOpacity = useSharedValue(0);
  const progressOpacity = useSharedValue(0);
  const backgroundOpacity = useSharedValue(0);

  const routerRef = useRef(router);
  void routerRef;

  useEffect(() => {
    ExpoSplashScreen.preventAutoHideAsync().catch(() => {});

    backgroundOpacity.value = withTiming(1, { duration: 300 });
    logoScale.value = withTiming(1, { duration: 800, easing: Easing.elastic(0.8) });
    logoOpacity.value = withDelay(200, withTiming(1, { duration: 400 }));
    textOpacity.value = withDelay(800, withTiming(1, { duration: 400 }));
    taglineOpacity.value = withDelay(1000, withTiming(1, { duration: 400 }));
    progressOpacity.value = withDelay(1200, withTiming(1, { duration: 400 }));

    const hideTimeout = setTimeout(() => {
      ExpoSplashScreen.hideAsync().catch(() => {});
    }, 2500);

    const timeout = setTimeout(() => {
      router.replace('/role-selection');
    }, 2500);

    return () => {
      clearTimeout(timeout);
      clearTimeout(hideTimeout);
    };
  }, [logoScale, logoOpacity, textOpacity, taglineOpacity, progressOpacity, backgroundOpacity]);

  const logoAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: logoScale.value }],
    opacity: logoOpacity.value,
  }));

  const textAnimatedStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
  }));

  const taglineAnimatedStyle = useAnimatedStyle(() => ({
    opacity: taglineOpacity.value,
  }));

  const progressAnimatedStyle = useAnimatedStyle(() => ({
    opacity: progressOpacity.value,
  }));

  const backgroundAnimatedStyle = useAnimatedStyle(() => ({
    opacity: backgroundOpacity.value,
  }));

  return (
    <View style={styles.container}>
      {/* Radial glow effect */}
      <View style={styles.radialGlow} />

      {/* Logo - organic blob shape */}
      <Animated.View style={[styles.logoWrapper, logoAnimatedStyle]}>
        <Svg width={185} height={285} viewBox="0 0 185 285" style={styles.logoBlob}>
          <Defs>
            <LinearGradient id="blobGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor="#5B7C61" />
              <Stop offset="100%" stopColor="#9FC4A9" />
            </LinearGradient>
            <RadialGradient id="innerGlow" cx="50%" cy="30%" r="60%">
              <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.15" />
              <Stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
            </RadialGradient>
          </Defs>
          {/* Main organic blob */}
          <Path
            fill="url(#blobGradient)"
            d="M92.5 10c55 0 85 30 92.5 85 7.5 55-30 95-85 105-55 10-110-10-130-55-20-45 5-135 122.5-135z"
          />
          {/* Inner leaf overlay */}
          <Ellipse cx={92.5} cy={85} rx={55} ry={55} fill="url(#innerGlow)" />
          {/* Core sprout - three petals */}
          <Path
            fill="#E6F2EA"
            fillOpacity="0.9"
            d="M92.5 65c0 15-12 25-25 25s-25-10-25-25c0-15 25-35 25-35s25 20 25 35z"
          />
          <Path
            fill="#E6F2EA"
            fillOpacity="0.9"
            d="M65 90c0-15 10-25 25-25s25 10 25 25c0 15-10 25-25 25s-25-10-25-25z"
          />
          <Path
            fill="#E6F2EA"
            fillOpacity="0.9"
            d="M67.5 72.5c10-10 25-10 25 0s-15 25-25 25-25-10-25-25c0-10 15-10 25 0z"
          />
        </Svg>
      </Animated.View>

      {/* Title */}
      <Animated.Text style={[styles.title, textAnimatedStyle, { color: '#2D342E' }]}>
        Nurturing Atelier
      </Animated.Text>

      {/* Tagline */}
      <Animated.Text style={[styles.tagline, taglineAnimatedStyle, { color: '#8C8C84' }]}>
        Cultivate your digital sanctuary.
      </Animated.Text>

      {/* Progress bar */}
      <Animated.View style={[styles.progressContainer, progressAnimatedStyle]}>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { backgroundColor: '#5B7C61' }]} />
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FAF7F2',
    paddingHorizontal: 32,
  },
  radialGlow: {
    position: 'absolute',
    top: '20%',
    width: 400,
    height: 400,
    borderRadius: 200,
    backgroundColor: '#F0F4F1',
    opacity: 0.5,
  },
  logoWrapper: {
    shadowColor: '#5B7C61',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
    marginBottom: 115,
  },
  logoBlob: {
    width: 185,
    height: 285,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.5,
    marginBottom: 15,
  },
  tagline: {
    fontSize: 12,
    fontWeight: '400',
    fontStyle: 'normal',
    marginBottom: 15,
  },
  progressContainer: {
    width: 92,
    height: 3,
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressTrack: {
    width: 92,
    height: 3,
    backgroundColor: '#E3D9CC',
    borderRadius: 1.5,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  progressFill: {
    width: 46,
    height: 3,
    borderRadius: 1.5,
  },
});