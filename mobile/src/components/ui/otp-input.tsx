import React, { useRef, useState } from 'react';
import { View, TextInput, StyleSheet, Pressable, Text } from 'react-native';

interface OtpInputProps {
  length: number;
  value: string;
  onChange: (value: string) => void;
}

export const OtpInput = ({ length, value, onChange }: OtpInputProps) => {
  const inputRef = useRef<TextInput>(null);
  const [isFocused, setIsFocused] = useState(false);

  const handlePress = () => {
    inputRef.current?.focus();
  };

  return (
    <View style={styles.container}>
      <Pressable style={styles.boxesContainer} onPress={handlePress}>
        {Array(length).fill(0).map((_, index) => {
          const char = value[index] || '';
          
          // The box is active if it's the next empty box, or if the input is full and it's the last box
          const isCurrentBox = value.length === index || (value.length === length && index === length - 1);
          const isBoxFocused = isFocused && isCurrentBox;

          return (
            <View 
              key={index} 
              style={[
                styles.box,
                isBoxFocused && styles.boxFocused,
                char ? styles.boxFilled : null
              ]}
            >
              <Text style={styles.boxText}>{char}</Text>
            </View>
          );
        })}
      </Pressable>

      {/* Hidden single TextInput to handle all keyboard interactions smoothly */}
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={(text) => {
          // Only allow numbers and clamp to max length
          const cleaned = text.replace(/[^0-9]/g, '').slice(0, length);
          onChange(cleaned);
        }}
        keyboardType="number-pad"
        maxLength={length}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        style={styles.hiddenInput}
        caretHidden
        autoFocus
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginVertical: 24,
  },
  boxesContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  box: {
    width: 48,
    height: 64,
    borderRadius: 12,
    backgroundColor: '#faf3e7',
    borderWidth: 2,
    borderColor: 'rgba(68,103,77,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  boxFocused: {
    borderColor: '#44674d',
    backgroundColor: '#fff',
    shadowColor: '#44674d',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  boxFilled: {
    borderColor: 'rgba(68,103,77,0.5)',
  },
  boxText: {
    fontFamily: 'PlusJakartaSans-ExtraBold',
    fontSize: 24,
    color: '#363228',
    textAlign: 'center',
  },
  hiddenInput: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
  },
});
