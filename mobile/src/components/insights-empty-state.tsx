import React, { useEffect } from 'react';
import { StyleSheet, View, Text } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { AuthColors, AuthFonts, AuthRadius, AuthShadows } from '@/constants/auth-theme';

export function InsightsEmptyState({ hasPair = true }: { hasPair?: boolean }) {
  const ripple1 = useSharedValue(0);
  const ripple2 = useSharedValue(0);
  const ripple3 = useSharedValue(0);
  const pulse = useSharedValue(0);

  useEffect(() => {
    const rippleConfig = { duration: 3200, easing: Easing.out(Easing.ease) };
    ripple1.value = withRepeat(withTiming(1, rippleConfig), -1, false);
    ripple2.value = withDelay(1066, withRepeat(withTiming(1, rippleConfig), -1, false));
    ripple3.value = withDelay(2133, withRepeat(withTiming(1, rippleConfig), -1, false));
    pulse.value = withRepeat(
      withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, []);

  const rippleStyle1 = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + ripple1.value * 2.6 }],
    opacity: 0.45 * (1 - ripple1.value),
  }));
  const rippleStyle2 = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + ripple2.value * 2.6 }],
    opacity: 0.45 * (1 - ripple2.value),
  }));
  const rippleStyle3 = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + ripple3.value * 2.6 }],
    opacity: 0.45 * (1 - ripple3.value),
  }));
  const coreStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 0.9 + pulse.value * 0.12 }],
  }));

  return (
    <View style={styles.card}>
      <View style={styles.animationWrap}>
        <Animated.View style={[styles.ripple, rippleStyle1]} />
        <Animated.View style={[styles.ripple, rippleStyle2]} />
        <Animated.View style={[styles.ripple, rippleStyle3]} />
        <Animated.View style={[styles.core, coreStyle]}>
          <Ionicons name="notifications-outline" size={40} color={AuthColors.onPrimary} />
        </Animated.View>
      </View>

      <Text style={styles.title}>No signals yet</Text>
      <Text style={styles.subtitle}>
        Once activity begins on the child device, your signal insights will appear here.
      </Text>
      {!hasPair && (
        <Text style={styles.hint}>
          Pair a child device to start receiving signals.
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: AuthColors.surfaceContainerLowest,
    borderRadius: AuthRadius.xl,
    padding: 32,
    alignItems: 'center',
    marginHorizontal: 4,
    ...AuthShadows.ambient,
  },
  animationWrap: {
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    overflow: 'visible',
  },
  ripple: {
    position: 'absolute',
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 1.5,
    borderColor: AuthColors.primary,
  },
  core: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: AuthColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: AuthColors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 10,
  },
  title: {
    ...AuthFonts.headlineSmall,
    color: AuthColors.onSurface,
    textAlign: 'center',
    marginTop: 8,
  },
  subtitle: {
    ...AuthFonts.bodyMedium,
    color: AuthColors.onSurfaceVariant,
    textAlign: 'center',
    marginTop: 8,
    maxWidth: 260,
  },
  hint: {
    ...AuthFonts.labelMedium,
    color: AuthColors.onSurfaceVariant,
    textAlign: 'center',
    marginTop: 16,
    opacity: 0.8,
  },
});
