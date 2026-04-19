import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { AuthColors, AuthFonts, AuthRadius, AuthGradients } from '@/constants/auth-theme';

interface OrganicButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'text';
  style?: ViewStyle;
  textStyle?: TextStyle;
  disabled?: boolean;
  testID?: string;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function OrganicButton({
  title,
  onPress,
  variant = 'primary',
  style,
  textStyle,
  disabled = false,
  testID,
}: OrganicButtonProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.98, { damping: 15, stiffness: 300 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 300 });
  };

  if (variant === 'primary') {
    return (
      <AnimatedPressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled}
        style={[animatedStyle, style]}
        testID={testID}
      >
        <LinearGradient
          colors={AuthGradients.primaryButton as [string, string]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.primaryButton]}
        >
          <Text style={[styles.primaryText, textStyle]}>{title}</Text>
        </LinearGradient>
      </AnimatedPressable>
    );
  }

  if (variant === 'secondary') {
    return (
      <AnimatedPressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled}
        style={[animatedStyle, styles.secondaryButton, style]}
      >
        <Text style={[styles.secondaryText, textStyle]}>{title}</Text>
      </AnimatedPressable>
    );
  }

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      style={[animatedStyle, style]}
    >
      <Text style={[styles.textButton, textStyle]}>{title}</Text>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  primaryButton: {
    paddingHorizontal: AuthRadius.lg,
    paddingVertical: AuthRadius.md,
    borderRadius: AuthRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: {
    ...AuthFonts.labelLarge,
    color: AuthColors.onPrimary,
  },
  secondaryButton: {
    paddingHorizontal: AuthRadius.lg,
    paddingVertical: AuthRadius.md,
    borderRadius: AuthRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  secondaryText: {
    ...AuthFonts.labelLarge,
    color: AuthColors.secondary,
  },
  textButton: {
    ...AuthFonts.labelLarge,
    color: AuthColors.primary,
  },
});