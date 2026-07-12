import React from 'react';
import { Pressable } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { AuthColors, AuthRadius } from '@/constants/auth-theme';

interface ToggleProps {
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
  size?: 'sm' | 'md';
}

const SIZES = {
  sm: { width: 44, height: 26, thumb: 22 },
  md: { width: 52, height: 30, thumb: 26 },
};

function ToggleImpl({ value, onValueChange, disabled = false, size = 'md' }: ToggleProps) {
  const { width, height, thumb } = SIZES[size];
  const padding = (height - thumb) / 2;
  const travel = width - thumb - padding * 2;

  const translate = useSharedValue(value ? travel : 0);

  React.useEffect(() => {
    translate.value = withTiming(value ? travel : 0, { duration: 200 });
  }, [value, travel, translate]);

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translate.value }],
  }));

  return (
    <Pressable
      onPress={() => {
        if (!disabled) onValueChange(!value);
      }}
      disabled={disabled}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          alignItems: 'center',
        },
        {
          width,
          height,
          borderRadius: height / 2,
          padding,
          backgroundColor: value ? AuthColors.primary : AuthColors.surfaceContainer,
          opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
        },
      ]}
    >
      <Animated.View
        style={[
          {
            position: 'absolute',
            backgroundColor: AuthColors.onPrimary,
          },
          { width: thumb, height: thumb, borderRadius: AuthRadius.full, left: padding, top: padding },
          thumbStyle,
        ]}
      />
    </Pressable>
  );
}

export const Toggle = React.memo(ToggleImpl);
