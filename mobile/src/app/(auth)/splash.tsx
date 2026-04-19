import { useEffect } from 'react';
import { StyleSheet, View, Text, Dimensions } from 'react-native';
import { router } from 'expo-router';
import * as ExpoSplashScreen from 'expo-splash-screen';
import Animated, {
  Easing,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  runOnJS,
} from 'react-native-reanimated';
import Svg, { Path, Defs, LinearGradient, Stop, RadialGradient as SvgRadialGradient, Circle } from 'react-native-svg';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '@/hooks/use-auth-store';
import { StatusBar } from 'expo-status-bar';
import { AuthColors } from '@/constants/auth-theme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Exact blob path from border-radius: 42% 58% 70% 30% / 45% 45% 55% 55%
const blobPath = "M107.52 0 A148.48 115.2 0 0 1 256 115.2 A179.2 140.8 0 0 1 76.8 256 A76.8 140.8 0 0 1 0 115.2 A107.52 115.2 0 0 1 107.52 0 Z";

export default function SplashScreen() {
  const insets = useSafeAreaInsets();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const containerOpacity = useSharedValue(0);
  const blobScale = useSharedValue(0);
  const contentOpacity = useSharedValue(0);

  const navigate = () => {
    ExpoSplashScreen.hideAsync().catch(() => {});
    if (isAuthenticated) {
      router.replace('/(tabs)/home'); 
    } else {
      router.replace('/role-selection');
    }
  };

  useEffect(() => {
    ExpoSplashScreen.preventAutoHideAsync().catch(() => {});

    containerOpacity.value = withTiming(1, { duration: 300 });
    blobScale.value = withDelay(200, withTiming(1, { duration: 800, easing: Easing.out(Easing.back(1.5)) }));
    contentOpacity.value = withDelay(600, withTiming(1, { duration: 600 }));

    const exitTimeout = setTimeout(() => {
      // Exit Animation: Fade out
      containerOpacity.value = withTiming(0, { duration: 400 }, (finished) => {
        if (finished) {
          runOnJS(navigate)();
        }
      });
    }, 2800);

    return () => clearTimeout(exitTimeout);
  }, []);

  const animatedContainerStyle = useAnimatedStyle(() => ({ opacity: containerOpacity.value }));
  const animatedBlobStyle = useAnimatedStyle(() => ({ transform: [{ scale: blobScale.value }] }));
  const animatedContentStyle = useAnimatedStyle(() => ({ opacity: contentOpacity.value }));

  return (
    <Animated.View style={[styles.container, animatedContainerStyle, { paddingTop: Math.max(insets.top, 64), paddingBottom: Math.max(insets.bottom, 64) }]}>
      <StatusBar style="dark" />
      
      {/* Decorative Fixed Background Blur Elements */}
      <View style={[StyleSheet.absoluteFill, { overflow: 'hidden', pointerEvents: 'none' }]}>
        <Svg height="100%" width="100%" style={StyleSheet.absoluteFill}>
          <Defs>
            <SvgRadialGradient id="bottomLeftGlow" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
              <Stop offset="0%" stopColor="#c5eccc" stopOpacity="0.2" />
              <Stop offset="100%" stopColor="#c5eccc" stopOpacity="0" />
            </SvgRadialGradient>
            <SvgRadialGradient id="topRightGlow" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
              <Stop offset="0%" stopColor="#ffdad3" stopOpacity="0.1" />
              <Stop offset="100%" stopColor="#ffdad3" stopOpacity="0" />
            </SvgRadialGradient>
          </Defs>
          <Circle cx="-32" cy={SCREEN_HEIGHT + 32} r="250" fill="url(#bottomLeftGlow)" />
          <Circle cx={SCREEN_WIDTH + 80} cy="-80" r="200" fill="url(#topRightGlow)" />
        </Svg>
      </View>

      <View style={styles.topSpacer} />

      <View style={styles.centerCluster}>
        {/* Soft Shadow Backing */}
        <Animated.View style={[styles.hearthShadow, animatedBlobStyle]}>
          <Svg width={320} height={320} viewBox="0 0 256 256">
            <Path d={blobPath} fill="#363228" opacity={0.04} />
          </Svg>
        </Animated.View>

        <Animated.View style={[animatedContentStyle, styles.floatersContainer]}>
           <View style={styles.floaterTopRight} />
           <View style={styles.floaterBottomLeft} />
        </Animated.View>

        {/* Logo Container (Organic Blob) */}
        <Animated.View style={[styles.logoBlobContainer, animatedBlobStyle]}>
          <Svg width={256} height={256} viewBox="0 0 256 256" style={styles.svgContainer}>
            <Defs>
              <LinearGradient id="hearthGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <Stop offset="0%" stopColor="#44674d" />
                <Stop offset="100%" stopColor="#c5eccc" />
              </LinearGradient>
            </Defs>
            <Path d={blobPath} fill="url(#hearthGrad)" />
          </Svg>
          
          <View style={styles.iconCluster}>
            <MaterialIcons name="eco" size={192} color="#e8ffea" style={styles.bgIcon} />
            <MaterialIcons name="spa" size={72} color="#e8ffea" style={styles.fgIcon} />
          </View>
        </Animated.View>
      </View>

      <Animated.View style={[styles.footer, animatedContentStyle]}>
        <Text style={styles.title}>Nurturing Atelier</Text>
        <Text style={styles.subtitle}>Cultivate your digital sanctuary.</Text>
      </Animated.View>

    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AuthColors.background,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
  },
  topSpacer: {
    width: '100%',
    height: 48,
  },
  centerCluster: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hearthShadow: {
    position: 'absolute',
    transform: [{ scale: 1.25 }],
    zIndex: 0,
  },
  floatersContainer: {
    position: 'absolute',
    width: 256,
    height: 256,
    zIndex: 1,
  },
  floaterTopRight: {
    position: 'absolute',
    top: -32,
    right: -32,
    width: 64,
    height: 64,
    backgroundColor: '#c5eccc',
    borderRadius: 32,
    opacity: 0.4,
  },
  floaterBottomLeft: {
    position: 'absolute',
    bottom: -40,
    left: -40,
    width: 96,
    height: 96,
    backgroundColor: '#d3fbda',
    borderRadius: 48,
    opacity: 0.3,
  },
  logoBlobContainer: {
    width: 256,
    height: 256,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
    shadowColor: '#363228',
    shadowOffset: { width: 0, height: 32 },
    shadowOpacity: 0.08,
    shadowRadius: 32,
    elevation: 8,
  },
  svgContainer: {
    position: 'absolute',
  },
  iconCluster: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  fgIcon: {
    zIndex: 2,
  },
  bgIcon: {
    position: 'absolute',
    opacity: 0.2,
    transform: [{ scale: 1.5 }, { rotate: '12deg' }],
    zIndex: 1,
  },
  footer: {
    alignItems: 'center',
  },
  title: {
    color: '#363228',
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.5,
    opacity: 0.9,
    marginBottom: 8,
  },
  subtitle: {
    color: '#645e53',
    fontSize: 14,
    letterSpacing: 0.5,
    opacity: 0.6,
  },
  loadingTrack: {
    marginTop: 48,
    width: 128,
    height: 3,
    backgroundColor: '#eae1d2',
    borderRadius: 2,
    overflow: 'hidden',
  },
  loadingFill: {
    height: '100%',
    backgroundColor: '#44674d',
    borderRadius: 2,
  },
});