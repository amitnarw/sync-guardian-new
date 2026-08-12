import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSequence,
  Easing,
  type SharedValue,
} from 'react-native-reanimated';
import { MaterialIcons } from '@expo/vector-icons';

type Phase = 'prompt' | 'animating';

interface NotifListenerRequestModalProps {
  visible: boolean;
  onAccept: () => void;
  onClose: () => void;
}

const ANIMATION_STEPS = [
  { icon: 'toggle-on' as const, label: 'Flip the switch on' },
  { icon: 'arrow-back' as const, label: 'Tap your back button' },
];

function StepRow({
  step,
  index,
  progress,
}: {
  step: typeof ANIMATION_STEPS[number];
  index: number;
  progress: SharedValue<number>;
}) {
  const opacity = useSharedValue(0.2);
  const scale = useSharedValue(0.95);

  useEffect(() => {
    const stepAt = index + 1;
    opacity.value = withDelay(
      (stepAt - 1) * 1300,
      withSequence(
        withTiming(1, { duration: 350, easing: Easing.out(Easing.cubic) }),
        withDelay(900, withTiming(0.45, { duration: 350 })),
      ),
    );
    scale.value = withDelay(
      (stepAt - 1) * 1300,
      withSequence(
        withTiming(1.05, { duration: 350, easing: Easing.out(Easing.cubic) }),
        withTiming(1, { duration: 250 }),
        withDelay(900, withTiming(0.95, { duration: 250 })),
      ),
    );
  }, [index, opacity, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value * progress.value,
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={[styles.stepRow, animatedStyle]}>
      <View style={styles.stepIcon}>
        <MaterialIcons name={step.icon} size={22} color="#486730" />
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
  const [phase, setPhase] = useState<Phase>('prompt');
  const progress = useSharedValue(1);

  useEffect(() => {
    if (!visible) {
      setPhase('prompt');
      return;
    }
  }, [visible]);

  useEffect(() => {
    if (phase !== 'animating') return;
    progress.value = 0;
    progress.value = withTiming(1, { duration: 250, easing: Easing.out(Easing.cubic) });
    const timer = setTimeout(() => {
      onAccept();
      onClose();
    }, 2600);
    return () => clearTimeout(timer);
  }, [phase, progress, onAccept, onClose]);

  const cardAnimatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * 12 }],
  }));

  const handleYes = () => {
    setPhase('animating');
  };

  const handleNo = () => {
    onClose();
  };

  if (!visible) return null;

  return (
    <View style={styles.overlay}>
      <Animated.View style={[styles.card, cardAnimatedStyle]}>
        {phase === 'prompt' ? (
          <>
            <Text style={styles.title}>Turn on notification access?</Text>
            <Text style={styles.body}>
              Tap Yes and Sync Guardian will open your phone&apos;s Settings. Look for a
              switch to turn on notification access for Sync Guardian — flip it on. Then tap
              your phone&apos;s Back button to come back here.
            </Text>
            <Text style={styles.bodyMuted}>
              If you see a list of apps instead, scroll down and tap{' '}
              <Text style={styles.bold}>Sync Guardian</Text> to find the switch.
            </Text>
            <View style={styles.actions}>
              <Pressable style={styles.secondaryButton} onPress={handleNo}>
                <Text style={styles.secondaryText}>No</Text>
              </Pressable>
              <Pressable style={styles.primaryButton} onPress={handleYes}>
                <Text style={styles.primaryText}>Yes</Text>
              </Pressable>
            </View>
          </>
        ) : (
          <>
            <Text style={styles.title}>Almost there</Text>
            <Text style={styles.subtitle}>
              You&apos;ll land on the switch in a moment.
            </Text>
            {ANIMATION_STEPS.map((step, index) => (
              <StepRow key={index} step={step} index={index} progress={progress} />
            ))}
          </>
        )}
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
    backgroundColor: '#fff8f0',
    borderRadius: 32,
    padding: 28,
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
    marginBottom: 12,
  },
  bodyMuted: {
    fontFamily: 'Manrope-Medium',
    fontSize: 13,
    color: '#43483d',
    lineHeight: 20,
    marginBottom: 20,
  },
  bold: {
    fontFamily: 'Manrope-Bold',
    color: '#1b1d0e',
  },
  subtitle: {
    fontFamily: 'Manrope-Medium',
    fontSize: 13,
    color: '#43483d',
    marginBottom: 18,
    lineHeight: 20,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: '#486730',
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
    backgroundColor: '#efefd7',
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
    borderRadius: 19,
    backgroundColor: '#e3ecd8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepLabel: {
    fontFamily: 'Manrope-Medium',
    fontSize: 15,
    color: '#1b1d0e',
    flex: 1,
  },
});