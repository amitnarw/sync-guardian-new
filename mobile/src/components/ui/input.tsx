import React, { useState } from 'react';
import { StyleSheet, View, Text, TextInput, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { MaterialIcons } from '@expo/vector-icons';

interface InputProps {
  label: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  placeholder: string;
  value: string;
  onChangeText: (text: string) => void;
  secureTextEntry?: boolean;
}

export const Input = ({
  label,
  icon,
  placeholder,
  value,
  onChangeText,
  secureTextEntry,
}: InputProps) => {
  const [isFocused, setIsFocused] = useState(false);
  const focusProgress = useSharedValue(0);

  const handleFocus = () => {
    setIsFocused(true);
    focusProgress.value = withTiming(1, { duration: 300 });
  };

  const handleBlur = () => {
    setIsFocused(false);
    focusProgress.value = withTiming(0, { duration: 300 });
  };

  const animatedRing = useAnimatedStyle(() => ({
    // Persistent shadow/glow or stronger border when focused
    opacity: focusProgress.value,
    transform: [{ scale: 1 + focusProgress.value * 0.01 }],
  }));

  return (
    <View style={styles.inputWrapper}>
      <Text style={styles.inputLabel}>{label}</Text>
      <View style={styles.inputContainer}>
        {/* Base Element with persistent outline as requested */}
        <View style={[StyleSheet.absoluteFill, styles.inputBaseElement]} />
        
        {/* Focused Glow/Ring */}
        <Animated.View style={[StyleSheet.absoluteFill, styles.inputFocusElement, animatedRing]} pointerEvents="none" />

        <TextInput
          placeholder={placeholder}
          placeholderTextColor="#b9b1a3"
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={secureTextEntry}
          onFocus={handleFocus}
          onBlur={handleBlur}
          style={styles.textInput}
          autoCapitalize="none"
        />
        <MaterialIcons
          name={icon}
          size={24}
          color="#44674d" // Always active color as requested
          style={styles.inputIcon}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  inputWrapper: {
    width: '100%',
  },
  inputLabel: {
    color: 'rgba(100, 94, 83, 0.7)',
    fontFamily: 'PlusJakartaSans-Bold',
    fontWeight: '700',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 2.4,
    marginBottom: 8,
    marginLeft: 16,
  },
  inputContainer: {
    width: '100%',
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 16,
    paddingHorizontal: 24,
  },
  inputBaseElement: {
    backgroundColor: '#faf3e7',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'rgba(68,103,77,0.15)', // Persistent outline
  },
  inputFocusElement: {
    backgroundColor: 'transparent',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#44674d', // Stronger primary outline on focus
    shadowColor: '#44674d',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },
  textInput: {
    flex: 1,
    height: '100%',
    color: '#363228',
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 16,
  },
  inputIcon: {
    marginLeft: 16,
  },
});
