import React from 'react';
import {
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { AuthColors as C, AuthFonts } from '@/constants/auth-theme';

export interface ScreenHeaderProps {
  variant?: 'back-only' | 'title-centered';
  title?: string;
  onBack?: () => void;
  rightSlot?: React.ReactNode;
  backgroundColor?: string;
  paddingHorizontal?: number;
  paddingTop?: number;
  paddingBottom?: number;
  titleStyle?: StyleProp<TextStyle>;
  containerStyle?: StyleProp<ViewStyle>;
  backIconColor?: string;
}

export function ScreenHeader({
  variant = 'back-only',
  title,
  onBack,
  rightSlot,
  backgroundColor = 'transparent',
  paddingHorizontal = 16,
  paddingTop = 8,
  paddingBottom = 12,
  titleStyle,
  containerStyle,
  backIconColor = C.onSurface,
}: ScreenHeaderProps) {
  const handleBack = () => {
    if (onBack) {
      onBack();
      return;
    }
    if (router.canGoBack()) {
      router.back();
    }
  };

  const showBack = variant === 'back-only' || variant === 'title-centered';

  return (
    <View
      style={[
        styles.row,
        {
          paddingHorizontal,
          paddingTop,
          paddingBottom,
          backgroundColor,
        },
        containerStyle,
      ]}
    >
      {showBack ? (
        <TouchableOpacity
          onPress={handleBack}
          hitSlop={10}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Ionicons name="chevron-back" size={Platform.OS === 'android' ? 22 : 24} color={backIconColor} />
        </TouchableOpacity>
      ) : (
        <View style={styles.backBtn} />
      )}

      {variant === 'title-centered' && title ? (
        <Text
          style={[styles.titleCentered, titleStyle]}
          numberOfLines={1}
        >
          {title}
        </Text>
      ) : null}

      <View style={styles.rightSlot}>{rightSlot ?? <View style={styles.backBtn} />}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleCentered: {
    ...AuthFonts.titleMedium,
    fontFamily: 'PlusJakartaSans-Bold',
    fontWeight: '700',
    color: C.onSurface,
    textAlign: 'center',
    flex: 1,
    fontSize: 18,
  },
  rightSlot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});

export default ScreenHeader;
