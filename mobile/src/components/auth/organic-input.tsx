import { useState } from 'react';
import { View, TextInput, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { MaterialIcons, MaterialIconsGlyphMap } from '@/components/auth/icon';
import { AuthColors, AuthFonts, AuthRadius } from '@/constants/auth-theme';

type IconName = keyof typeof MaterialIconsGlyphMap;

interface OrganicInputProps {
  placeholder: string;
  value: string;
  onChangeText: (text: string) => void;
  icon?: IconName;
  secureTextEntry?: boolean;
  style?: ViewStyle;
  inputStyle?: TextStyle;
  keyboardType?: 'default' | 'email-address' | 'numeric' | 'phone-pad';
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  testID?: string;
}

export function OrganicInput({
  placeholder,
  value,
  onChangeText,
  icon,
  secureTextEntry = false,
  style,
  inputStyle,
  keyboardType = 'default',
  autoCapitalize = 'none',
  testID,
}: OrganicInputProps) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View
      style={[
        styles.container,
        isFocused && styles.containerFocused,
        style,
      ]}
    >
      {icon && (
        <MaterialIcons
          name={icon}
          size={24}
          color={isFocused ? AuthColors.primary : AuthColors.onSurfaceVariant}
          style={styles.icon}
        />
      )}
      <TextInput
        testID={testID}
        placeholder={placeholder}
        placeholderTextColor={AuthColors.onSurfaceVariant}
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        style={[styles.input, inputStyle]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: AuthColors.surfaceContainerHighest,
    borderRadius: AuthRadius.md,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  containerFocused: {
    backgroundColor: AuthColors.surfaceContainerLow,
    borderColor: `${AuthColors.primary}33`, // 20% opacity
  },
  icon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    ...AuthFonts.bodyLarge,
    color: AuthColors.onSurface,
    padding: 0,
  },
});