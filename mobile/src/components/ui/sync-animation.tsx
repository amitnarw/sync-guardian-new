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
import { MaterialIcons } from '@expo/vector-icons';

export const SyncAnimation = () => {
  const ripple1 = useSharedValue(0);
  const ripple2 = useSharedValue(0);
  const ripple3 = useSharedValue(0);
  const rotation = useSharedValue(0);
  const iconPulse = useSharedValue(0);

  useEffect(() => {
    // Smoother, slower 4-second expansion for the radio waves
    const config = { duration: 4000, easing: Easing.out(Easing.ease) };

    // Staggered perfectly so the waves are always evenly spaced
    ripple1.value = withRepeat(withTiming(1, config), -1, false);
    ripple2.value = withDelay(1333, withRepeat(withTiming(1, config), -1, false));
    ripple3.value = withDelay(2666, withRepeat(withTiming(1, config), -1, false));

    // Continuous smooth rotation for the inner technical dashed ring
    rotation.value = withRepeat(
      withTiming(360, { duration: 12000, easing: Easing.linear }),
      -1,
      false
    );

    // Make the central icon pulsate
    iconPulse.value = withRepeat(
      withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, []);

  const style1 = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + ripple1.value * 3 }],
    opacity: 1 - ripple1.value,
  }));

  const style2 = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + ripple2.value * 3 }],
    opacity: 1 - ripple2.value,
  }));

  const style3 = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + ripple3.value * 3 }],
    opacity: 1 - ripple3.value,
  }));

  const spinStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 0.85 + iconPulse.value * 0.3 }], // pulses between 0.85 and 1.15
    opacity: 0.4 + iconPulse.value * 0.4, // softer opacity
  }));

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.ripple, style1]} />
      <Animated.View style={[styles.ripple, style2]} />
      <Animated.View style={[styles.ripple, style3]} />

      <Animated.View style={[styles.dashedRing, spinStyle]} />

      <View style={styles.core}>
        <Animated.View style={iconStyle}>
          <MaterialIcons name="radar" size={40} color="#e8ffea" />
        </Animated.View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 16,
    overflow: 'visible',
    opacity: 0.8
  },
  core: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(68, 103, 77, 0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#44674d',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 12,
    zIndex: 10,
  },
  dashedRing: {
    position: 'absolute',
    width: 104,
    height: 104,
    borderRadius: 52,
    borderWidth: 2,
    borderColor: 'rgba(68,103,77,0.4)',
    borderStyle: 'dashed',
    zIndex: 5,
  },
  ripple: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 1.5,
    borderColor: '#44674d',
    backgroundColor: 'transparent',
  }
});
