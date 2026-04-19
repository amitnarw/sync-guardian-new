import { StyleSheet, View, Text, Pressable } from 'react-native';
import { router } from 'expo-router';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { MaterialIcons, MaterialIconsGlyphMap } from '@/components/auth/icon';
import { useAuthTheme } from '@/hooks/use-auth-theme';
import { useAuthStore } from '@/hooks/use-auth-store';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface RoleCardProps {
  title: string;
  subtitle: string;
  icon: keyof typeof MaterialIconsGlyphMap;
  onPress: () => void;
  testID?: string;
}

function RoleCard({ title, subtitle, icon, onPress, testID }: RoleCardProps) {
  const colors = useAuthTheme();
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

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[animatedStyle]}
      testID={testID}
    >
      <View style={[styles.card, { backgroundColor: colors.surfaceContainerHigh }]}>
        <View style={[styles.iconContainer, { backgroundColor: colors.primaryFixed }]}>
          <MaterialIcons name={icon} size={40} color={colors.primary} />
        </View>
        <Text style={[styles.cardTitle, { color: colors.onSurface }]}>{title}</Text>
        <Text style={[styles.cardSubtitle, { color: colors.onSurfaceVariant }]}>{subtitle}</Text>
      </View>
    </AnimatedPressable>
  );
}

export default function RoleSelectionScreen() {
  const colors = useAuthTheme();
  const setUserRole = useAuthStore((state) => state.setUserRole);

  const handleRoleSelect = (role: 'parent' | 'child') => {
    setUserRole(role);
    // Navigate to login - onboarding will be shown for parent after login
    router.push('/login');
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.heading, { color: colors.onSurface }]}>
          Who is joining the sanctuary today?
        </Text>
      </View>

      {/* Role Cards */}
      <View style={styles.cardsContainer}>
        <RoleCard
          title="Parent"
          subtitle="Guiding the journey"
          icon="family-restroom"
          onPress={() => handleRoleSelect('parent')}
          testID="role-card-parent"
        />
        <RoleCard
          title="Child"
          subtitle="Exploring with wonder"
          icon="child-care"
          onPress={() => handleRoleSelect('child')}
          testID="role-card-child"
        />
      </View>

      {/* Bottom decorative element */}
      <View style={styles.footer}>
        <View style={[styles.decorativeDots]}>
          {[0, 1, 2].map((i) => (
            <View
              key={i}
              style={[
                styles.dot,
                { backgroundColor: i === 0 ? colors.primary : colors.outlineVariant },
              ]}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 80,
  },
  header: {
    marginBottom: 48,
    alignItems: 'center',
  },
  heading: {
    fontSize: 28,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 36,
  },
  cardsContainer: {
    flex: 1,
    justifyContent: 'center',
    gap: 24,
  },
  card: {
    borderRadius: 9999, // Full roundness per design system
    padding: 32,
    alignItems: 'center',
    // Using background color shift instead of border per "no-line" rule
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 8,
  },
  cardSubtitle: {
    fontSize: 16,
    fontWeight: '400',
  },
  footer: {
    alignItems: 'center',
    paddingBottom: 48,
  },
  decorativeDots: {
    flexDirection: 'row',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});