import React, { useEffect } from 'react';
import { StyleSheet, View, Text, Modal, TouchableWithoutFeedback, Pressable } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming, runOnJS } from 'react-native-reanimated';
import { MaterialIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';

export type AppModalIcon = 'error' | 'warning' | 'info' | 'success';

export interface AppModalProps {
  visible: boolean;
  title: string;
  message: string;
  icon?: AppModalIcon;
  primaryButton?: string;
  onPrimaryPress?: () => void;
  secondaryButton?: string;
  onSecondaryPress?: () => void;
  dismissable?: boolean;
  onDismiss?: () => void;
}

const ICON_CONFIG: Record<AppModalIcon, { name: keyof typeof MaterialIcons.glyphMap; bg: string; color: string }> = {
  error: { name: 'error-outline', bg: '#ffdad3', color: '#9f402d' },
  warning: { name: 'warning-amber', bg: '#fff3cd', color: '#856404' },
  info: { name: 'info-outline', bg: '#d4edda', color: '#486730' },
  success: { name: 'check-circle-outline', bg: '#d4edda', color: '#2d6a4f' },
};

export const AppModal = ({
  visible,
  title,
  message,
  icon,
  primaryButton = 'Okay',
  onPrimaryPress,
  secondaryButton,
  onSecondaryPress,
  dismissable = true,
  onDismiss,
}: AppModalProps) => {
  const scale = useSharedValue(0.9);
  const backdropOpacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      scale.value = withSpring(1, { damping: 15, stiffness: 150 });
      backdropOpacity.value = withTiming(1, { duration: 200 });
    } else {
      scale.value = withSpring(0.9, { damping: 15, stiffness: 150 });
      backdropOpacity.value = withTiming(0, { duration: 150 });
    }
  }, [visible]);

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const handleBackdrop = () => {
    if (dismissable) {
      onDismiss?.();
    }
  };

  const iconCfg = icon ? ICON_CONFIG[icon] : undefined;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={handleBackdrop}>
      <View style={styles.wrapper}>
        <TouchableWithoutFeedback onPress={handleBackdrop}>
          <Animated.View style={[styles.backdrop, backdropStyle]}>
            <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
          </Animated.View>
        </TouchableWithoutFeedback>
        <Animated.View style={[styles.card, cardStyle]}>
          {iconCfg && (
            <View style={[styles.iconContainer, { backgroundColor: iconCfg.bg }]}>
              <MaterialIcons name={iconCfg.name} size={32} color={iconCfg.color} />
            </View>
          )}
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          <View style={[styles.actions, !secondaryButton && styles.actionsSingle]}>
            {secondaryButton && (
              <Pressable style={styles.secondaryButton} onPress={onSecondaryPress}>
                <Text style={styles.secondaryText}>{secondaryButton}</Text>
              </Pressable>
            )}
            <Pressable style={[styles.primaryButton, !secondaryButton && styles.primaryButtonFull]} onPress={onPrimaryPress}>
              <Text style={styles.primaryText}>{primaryButton}</Text>
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(27, 29, 14, 0.4)',
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#fff8f0',
    borderRadius: 32,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#1b1d0e',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 8,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontFamily: 'PlusJakartaSans-ExtraBold',
    fontSize: 24,
    color: '#1b1d0e',
    marginBottom: 12,
    textAlign: 'center',
  },
  message: {
    fontFamily: 'Manrope-Medium',
    fontSize: 16,
    color: '#43483d',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  actions: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
  },
  actionsSingle: {
    justifyContent: 'center',
  },
  primaryButton: {
    flex: 1,
    height: 52,
    backgroundColor: '#486730',
    borderRadius: 9999,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryButtonFull: {
    flex: 0,
    width: '100%',
  },
  primaryText: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 16,
    color: '#ffffff',
  },
  secondaryButton: {
    flex: 1,
    height: 52,
    backgroundColor: '#efefd7',
    borderRadius: 9999,
    justifyContent: 'center',
    alignItems: 'center',
  },
  secondaryText: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 16,
    color: '#43483d',
  },
});
