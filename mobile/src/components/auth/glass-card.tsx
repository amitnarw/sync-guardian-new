import { StyleSheet, View, ViewStyle } from 'react-native';
import { AuthColors, AuthRadius, AuthShadows } from '@/constants/auth-theme';

interface GlassCardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  variant?: 'default' | 'high' | 'highest';
}

export function GlassCard({ children, style, variant = 'default' }: GlassCardProps) {
  const surfaceColor = {
    default: AuthColors.surfaceContainerLow,
    high: AuthColors.surfaceContainerHigh,
    highest: AuthColors.surfaceContainerHighest,
  }[variant];

  return (
    <View style={[styles.container, { backgroundColor: surfaceColor }, style]}>
      <View style={styles.glassOverlay} />
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: AuthRadius.full,
    overflow: 'hidden',
    ...AuthShadows.ambient,
  },
  glassOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(228, 228, 204, 0.3)',
  },
  content: {
    zIndex: 1,
  },
});