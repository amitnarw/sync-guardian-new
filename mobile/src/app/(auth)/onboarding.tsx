import { StyleSheet, View, Text, Pressable, ScrollView, ViewStyle } from 'react-native';
import { router } from 'expo-router';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@/components/auth/icon';
import { useAuthTheme } from '@/hooks/use-auth-theme';
import { useAuthStore } from '@/hooks/use-auth-store';
import { AuthColors, AuthGradients } from '@/constants/auth-theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface AvatarProps {
  size: number;
  backgroundColor: string;
  children: React.ReactNode;
  style?: ViewStyle;
}

function Avatar({ size, backgroundColor, children }: AvatarProps) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: AuthColors.surface,
      }}
    >
      {children}
    </View>
  );
}

function AvatarCluster() {
  return (
    <View style={styles.avatarCluster}>
      <Avatar size={48} backgroundColor={AuthColors.primaryContainer}>
        <MaterialIcons name="person" size={24} color={AuthColors.primary} />
      </Avatar>
      <Avatar size={48} backgroundColor={AuthColors.secondaryContainer} style={{ marginLeft: -12 }}>
        <MaterialIcons name="person" size={24} color={AuthColors.secondary} />
      </Avatar>
      <Avatar size={48} backgroundColor={AuthColors.tertiaryContainer} style={{ marginLeft: -12 }}>
        <MaterialIcons name="person" size={24} color={AuthColors.tertiary} />
      </Avatar>
      <Avatar size={48} backgroundColor={AuthColors.primaryFixed} style={{ marginLeft: -12 }}>
        <MaterialIcons name="person" size={24} color={AuthColors.onPrimaryFixed} />
      </Avatar>
    </View>
  );
}

function SocialProof() {
  return (
    <View style={styles.socialProof}>
      <AvatarCluster />
      <Text style={styles.socialProofText}>Trusted by 2,000+ families</Text>
    </View>
  );
}

export default function OnboardingScreen() {
  const colors = useAuthTheme();
  const { setHasCompletedOnboarding, setIsAuthenticated } = useAuthStore();
  const scale = useSharedValue(1);

  const primaryAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePrimaryPressIn = () => {
    scale.value = withSpring(0.98, { damping: 15, stiffness: 300 });
  };

  const handlePrimaryPressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 300 });
  };

  const handleBeginJourney = async () => {
    setHasCompletedOnboarding(true);
    setIsAuthenticated(true);
    router.replace('/home');
  };

  const handleLearnMore = () => {
    // TODO: Navigate to learn more / about page
    console.log('Learn more');
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={[styles.logoSmall, { backgroundColor: colors.primaryContainer }]}>
          <MaterialIcons name="eco" size={24} color={colors.primary} />
        </View>
        <Text style={[styles.navText, { color: colors.onSurfaceVariant }]}>
          Nurturing Atelier
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Hero placeholder */}
        <View style={[styles.heroPlaceholder, { backgroundColor: colors.surfaceContainerLow }]}>
          <MaterialIcons name="image" size={48} color={colors.outlineVariant} />
        </View>

        {/* Favorite button */}
        <Pressable style={[styles.favoriteButton, { backgroundColor: colors.surfaceContainerHigh }]} testID="onboarding-favorite-button">
          <MaterialIcons name="favorite" size={24} color={AuthColors.secondary} />
        </Pressable>

        {/* Main content */}
        <View style={styles.content}>
          {/* Gentle Care heading */}
          <Text style={[styles.sectionLabel, { color: colors.tertiary }]}>Gentle Care</Text>
          <Text style={[styles.heading, { color: colors.onSurface }]}>For your loved ones</Text>

          {/* Welcome section */}
          <Text style={[styles.welcomeHeading, { color: colors.primary }]}>
            Welcome to the Sanctuary
          </Text>
          <Text style={[styles.welcomeText, { color: colors.onSurfaceVariant }]}>
            A digital space crafted with love, designed to nurture connections and protect what matters most.
          </Text>

          {/* Social proof */}
          <SocialProof />
        </View>
      </ScrollView>

      {/* Footer CTAs */}
      <View style={styles.footer}>
        <AnimatedPressable
          onPress={handleBeginJourney}
          onPressIn={handlePrimaryPressIn}
          onPressOut={handlePrimaryPressOut}
          style={[primaryAnimatedStyle, styles.primaryButton]}
          testID="onboarding-begin-journey-button"
        >
          <LinearGradient
            colors={AuthGradients.primaryButton as [string, string]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.primaryButtonGradient}
          >
            <Text style={styles.primaryButtonText}>Begin Your Journey</Text>
            <MaterialIcons name="arrow-forward" size={20} color={AuthColors.onPrimary} />
          </LinearGradient>
        </AnimatedPressable>

        <Pressable onPress={handleLearnMore} testID="onboarding-learn-more-button">
          <Text style={[styles.secondaryButton, { color: colors.primary }]}>
            Learn More
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 8,
    gap: 12,
  },
  logoSmall: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  navText: {
    fontSize: 16,
    fontWeight: '500',
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  heroPlaceholder: {
    height: 200,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  favoriteButton: {
    position: 'absolute',
    right: 24,
    top: 216,
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    marginTop: 24,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  heading: {
    fontSize: 32,
    fontWeight: '600',
    lineHeight: 40,
    marginBottom: 24,
  },
  welcomeHeading: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 12,
  },
  welcomeText: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 32,
  },
  socialProof: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarCluster: {
    flexDirection: 'row',
  },
  socialProofText: {
    fontSize: 14,
    fontWeight: '500',
    color: AuthColors.onSurfaceVariant,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 32,
    gap: 16,
  },
  primaryButton: {
    borderRadius: 9999,
    overflow: 'hidden',
  },
  primaryButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 18,
    paddingHorizontal: 24,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: AuthColors.onPrimary,
  },
  secondaryButton: {
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
  },
});