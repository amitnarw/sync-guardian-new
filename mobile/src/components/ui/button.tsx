import React from 'react';
import { StyleSheet, Text, Pressable, ViewStyle, Image, ActivityIndicator } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { MaterialIcons } from '@expo/vector-icons';
import { AuthColors } from '@/constants/auth-theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface ButtonProps {
  title?: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'white';
  icon?: keyof typeof MaterialIcons.glyphMap;
  imageSource?: any;
  style?: ViewStyle | ViewStyle[];
  loading?: boolean;
  disabled?: boolean;
  stacked?: boolean;
}

export const Button = ({ title, onPress, variant = 'primary', icon, imageSource, style, loading, disabled, stacked = false }: ButtonProps) => {
  const scale = useSharedValue(1);

  const handlePressIn = () => {
    if (loading) return;
    scale.value = withSpring(0.95, { damping: 15, stiffness: 300 });
  };
  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 300 });
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }]
  }));

  const isPrimary = variant === 'primary';
  const isWhite = variant === 'white';
  const isDisabled = loading || disabled;

  const content = stacked ? (
    <>
      {icon && (
        <MaterialIcons
          name={icon}
          size={isPrimary ? 22 : 20}
          color={isPrimary ? '#e8ffea' : isWhite ? AuthColors.onSurface : '#363228'}
        />
      )}
      {title && (
        <Text style={[styles.buttonText, isPrimary ? styles.primaryText : isWhite ? styles.whiteText : styles.secondaryText, styles.stackedText]}>
          {title}
        </Text>
      )}
    </>
  ) : (
    <>
      {imageSource && (
        <Image
          source={imageSource}
          style={styles.imageIcon}
        />
      )}
      {title && (
        <Text style={[styles.buttonText, isPrimary ? styles.primaryText : isWhite ? styles.whiteText : styles.secondaryText]}>
          {title}
        </Text>
      )}
      {icon && (
        <MaterialIcons
          name={icon}
          size={isPrimary ? 20 : 18}
          color={isPrimary ? '#e8ffea' : isWhite ? AuthColors.onSurface : '#363228'}
        />
      )}
    </>
  );

  return (
    <AnimatedPressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={isDisabled ? undefined : onPress}
      style={[
        styles.button,
        isPrimary ? styles.primaryButton : isWhite ? styles.whiteButton : styles.secondaryButton,
        stacked && styles.stackedButton,
        animatedStyle,
        style,
        isDisabled && { opacity: 0.7 }
      ]}
    >
      {loading ? (
        <ActivityIndicator color={isPrimary ? '#e8ffea' : isWhite ? AuthColors.onSurface : '#363228'} />
      ) : (
        content
      )}
    </AnimatedPressable>
  );
};

const styles = StyleSheet.create({
  button: {
    width: '100%',
    height: 64,
    borderRadius: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  stackedButton: {
    flexDirection: 'column',
    gap: 2,
  },
  stackedText: {
    fontSize: 12,
  },
  primaryButton: {
    backgroundColor: '#2f4a37',
    shadowColor: '#2f4a37',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 30,
    elevation: 8,
  },
  secondaryButton: {
    backgroundColor: '#efe7da',
  },
  whiteButton: {
    backgroundColor: AuthColors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: AuthColors.outlineVariant,
    shadowOpacity: 0,
    elevation: 0,
  },
  buttonText: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontWeight: '700',
    fontSize: 18,
  },
  primaryText: {
    color: '#e8ffea',
  },
  secondaryText: {
    color: '#363228',
  },
  whiteText: {
    color: AuthColors.onSurface,
  },
  imageIcon: {
    width: 24,
    height: 24,
    resizeMode: 'contain',
  },
});
