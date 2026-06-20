import React from 'react';
import { StyleSheet, Text, Pressable, ViewStyle, Image, ActivityIndicator } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { MaterialIcons } from '@expo/vector-icons';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface ButtonProps {
  title?: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
  icon?: keyof typeof MaterialIcons.glyphMap;
  imageSource?: any;
  style?: ViewStyle | ViewStyle[];
  loading?: boolean;
}

export const Button = ({ title, onPress, variant = 'primary', icon, imageSource, style, loading }: ButtonProps) => {
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

  return (
    <AnimatedPressable 
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={loading ? undefined : onPress}
      style={[
        styles.button, 
        isPrimary ? styles.primaryButton : styles.secondaryButton,
        animatedStyle,
        style,
        loading && { opacity: 0.7 }
      ]}
    >
      {loading ? (
        <ActivityIndicator color={isPrimary ? '#e8ffea' : '#363228'} />
      ) : (
        <>
          {imageSource && (
            <Image 
              source={imageSource} 
              style={styles.imageIcon} 
            />
          )}
          {title && (
            <Text style={[styles.buttonText, isPrimary ? styles.primaryText : styles.secondaryText]}>
              {title}
            </Text>
          )}
          {icon && (
            <MaterialIcons 
              name={icon} 
              size={isPrimary ? 20 : 18} 
              color={isPrimary ? '#e8ffea' : '#363228'} 
            />
          )}
        </>
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
  primaryButton: {
    backgroundColor: '#44674d',
    shadowColor: '#44674d',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 30,
    elevation: 8,
  },
  secondaryButton: {
    backgroundColor: '#efe7da',
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
  imageIcon: {
    width: 24,
    height: 24,
    resizeMode: 'contain',
  },
});
