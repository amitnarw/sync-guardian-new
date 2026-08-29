import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  withDelay,
  interpolateColor,
  Easing,
} from 'react-native-reanimated';
import { MaterialIcons } from '@expo/vector-icons';

interface NotifListenerRequestModalProps {
  visible: boolean;
  onAccept: () => void;
  onClose: () => void;
}

const ANIMATION_STEPS = [
  { icon: 'toggle-on' as const, label: 'Flip the switch on' },
  { icon: 'arrow-back' as const, label: 'Tap your back button' },
];

const PULSE_DURATION = 1600;

function StepRow({
  step,
  index,
}: {
  step: typeof ANIMATION_STEPS[number];
  index: number;
}) {
  const pulse = useSharedValue(0);

  useEffect(() => {
    const cycle = () =>
      withSequence(
        withTiming(1, { duration: PULSE_DURATION / 2, easing: Easing.inOut(Easing.cubic) }),
        withTiming(0, { duration: PULSE_DURATION / 2, easing: Easing.inOut(Easing.cubic) }),
      );
    pulse.value = withDelay(
      index * (PULSE_DURATION / 2),
      withRepeat(cycle(), -1),
    );
  }, [index, pulse]);

  const circleStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      pulse.value,
      [0, 1],
      ['#e3ecd8', '#c8d9a8'],
    ),
  }));

  const ringStyle = useAnimatedStyle(() => ({
    opacity: pulse.value * 0.55,
  }));

  const rowStyle = useAnimatedStyle(() => ({
    opacity: 1 - pulse.value * 0.15,
  }));

  return (
    <Animated.View style={[styles.stepRow, rowStyle]}>
      <View style={styles.stepIcon}>
        <Animated.View style={[styles.stepCircle, circleStyle]}>
          <MaterialIcons name={step.icon} size={22} color="#2f4a37" />
        </Animated.View>
        <Animated.View style={[styles.stepRing, ringStyle]} />
      </View>
      <Text style={styles.stepLabel}>{step.label}</Text>
    </Animated.View>
  );
}

export function NotifListenerRequestModal({
  visible,
  onAccept,
  onClose,
}: NotifListenerRequestModalProps) {
  const progress = useSharedValue(0);

  useEffect(() => {
    if (!visible) {
      progress.value = 0;
      return;
    }
    progress.value = withTiming(1, { duration: 250, easing: Easing.out(Easing.cubic) });
  }, [visible, progress]);

  const cardAnimatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * 12 }],
  }));

  if (!visible) return null;

  const handleYes = () => {
    onAccept();
    onClose();
  };

  return (
    <View style={styles.overlay}>
      <Animated.View style={[styles.card, cardAnimatedStyle]}>
        <ScrollView showsVerticalScrollIndicator={false}>
          <Text style={styles.title}>Turn on notification access?</Text>
          <Text style={styles.body}>
            Tap Yes and Sync Guardian will open your phone&apos;s Settings. Look for a
            switch to turn on notification access for Sync Guardian ,  flip it on. Then tap
            your phone&apos;s Back button to come back here.
          </Text>
          {ANIMATION_STEPS.map((step, index) => (
            <StepRow key={index} step={step} index={index} />
          ))}
          <Text style={styles.bodyMuted}>
            If you see a list of apps instead, scroll down and tap{' '}
            <Text style={styles.bold}>Sync Guardian</Text> to find the switch.
          </Text>
          <View style={styles.actions}>
            <Pressable style={styles.secondaryButton} onPress={onClose}>
              <Text style={styles.secondaryText}>No</Text>
            </Pressable>
            <Pressable style={styles.primaryButton} onPress={handleYes}>
              <Text style={styles.primaryText}>Yes</Text>
            </Pressable>
          </View>
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: 'rgba(27, 29, 14, 0.45)',
    zIndex: 200,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    maxHeight: '90%',
    backgroundColor: '#fff8f0',
    borderRadius: 32,
    padding: 28,
    overflow: 'hidden',
    shadowColor: '#1b1d0e',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.12,
    shadowRadius: 32,
    elevation: 12,
  },
  title: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 20,
    color: '#1b1d0e',
    marginBottom: 12,
  },
  body: {
    fontFamily: 'Manrope-Medium',
    fontSize: 14,
    color: '#1b1d0e',
    lineHeight: 22,
    marginBottom: 16,
  },
  bodyMuted: {
    fontFamily: 'Manrope-Medium',
    fontSize: 13,
    color: '#43483d',
    lineHeight: 20,
    marginTop: 4,
    marginBottom: 20,
  },
  bold: {
    fontFamily: 'Manrope-Bold',
    color: '#1b1d0e',
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: '#2f4a37',
    paddingVertical: 14,
    borderRadius: 999,
    alignItems: 'center',
  },
  primaryText: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 15,
    color: '#fff8f0',
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: '#efe7da',
    paddingVertical: 14,
    borderRadius: 999,
    alignItems: 'center',
  },
  secondaryText: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 15,
    color: '#1b1d0e',
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  stepIcon: {
    width: 38,
    height: 38,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#c5eccc',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepRing: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 19,
    borderWidth: 2,
    borderColor: '#2f4a37',
  },
  stepLabel: {
    fontFamily: 'Manrope-Medium',
    fontSize: 15,
    color: '#1b1d0e',
    flex: 1,
  },
});
