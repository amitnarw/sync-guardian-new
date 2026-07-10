import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withDelay,
  Easing
} from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export const SyncAnimation = () => {
  const ripple1 = useSharedValue(0);
  const ripple2 = useSharedValue(0);
  const ripple3 = useSharedValue(0);
  const coreRotation = useSharedValue(0);
  const iconPulse = useSharedValue(0);

  useEffect(() => {
    // 4-second loop for waves
    const waveConfig = { duration: 4000, easing: Easing.out(Easing.ease) };

    ripple1.value = withRepeat(withTiming(1, waveConfig), -1, false);
    ripple2.value = withDelay(1333, withRepeat(withTiming(1, waveConfig), -1, false));
    ripple3.value = withDelay(2666, withRepeat(withTiming(1, waveConfig), -1, false));

    // Slow rotation of the core organic blob
    coreRotation.value = withRepeat(
      withTiming(360, { duration: 16000, easing: Easing.linear }),
      -1,
      false
    );

    // Subtle core pulse
    iconPulse.value = withRepeat(
      withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, []);

  const rippleStyle1 = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + ripple1.value * 2.8 }],
    opacity: 0.15 * (1 - ripple1.value),
  }));

  const rippleStyle2 = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + ripple2.value * 2.8 }],
    opacity: 0.15 * (1 - ripple2.value),
  }));

  const rippleStyle3 = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + ripple3.value * 2.8 }],
    opacity: 0.15 * (1 - ripple3.value),
  }));

  const coreAnimStyle = useAnimatedStyle(() => ({
    transform: [
      { rotate: `${coreRotation.value}deg` },
      { scale: 0.95 + iconPulse.value * 0.08 }
    ],
  }));

  const uprightStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${-coreRotation.value}deg` }],
  }));

  return (
    <View style={styles.container}>
      {/* Dynamic Concentric Faint Green Ripples */}
      <Animated.View style={[styles.ripple, rippleStyle1]} />
      <Animated.View style={[styles.ripple, rippleStyle2]} />
      <Animated.View style={[styles.ripple, rippleStyle3]} />

      {/* Central Rotating Organic Sage-Green Blob */}
      <Animated.View style={[styles.core, coreAnimStyle]}>
        {/* Keeps the leaf upright while the blob spins */}
        <Animated.View style={uprightStyle}>
          <MaterialCommunityIcons name="leaf" size={32} color="#ffffff" />
        </Animated.View>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 280,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 16,
    overflow: 'visible',
  },
  core: {
    width: 90,
    height: 90,
    backgroundColor: '#5d7d65', // organic green-sage color matching C.primary / screenshot
    alignItems: 'center',
    justifyContent: 'center',
    // Organic irregular blob radii:
    borderTopLeftRadius: 42,
    borderTopRightRadius: 48,
    borderBottomLeftRadius: 36,
    borderBottomRightRadius: 54,
    shadowColor: '#44674d',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
    zIndex: 10,
  },
  ripple: {
    position: 'absolute',
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#44674d', // soft green fill, opacity animated in styles
  }
});
