import React, { useRef, useEffect } from 'react';
import { StyleSheet, View, Text, Pressable, ScrollView, Dimensions, Image as RNImage } from 'react-native';
import { router } from 'expo-router';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import Svg, { Path, Defs, RadialGradient, Stop, Circle, ClipPath, Image as SvgImage, LinearGradient, Rect } from 'react-native-svg';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '@/hooks/use-auth-store';
import { AuthColors, AuthRadius } from '@/constants/auth-theme';
import { Button } from '@/components/ui/button';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Precise boundary path for 42% 58% 70% 30% / 45% 45% 55% 55% over a 256x256 ViewBox
const blobPath = "M107.52 0 L148.48 0 C207.87 0 256 51.53 256 115.2 L256 140.8 C256 204.47 196.2 256 122.88 256 L76.8 256 C34.38 256 0 204.47 0 140.8 L0 115.2 C0 51.53 48.12 0 107.52 0 Z";

// Social Proof Avatars
const AVATAR_URLS = [
  "https://lh3.googleusercontent.com/aida-public/AB6AXuCXPGmrB4ACyAaHCIsT8O9Q7beq5t7iS97Jq81Rw3gP9Mjs3AtM6BoN1Sn7GTZm4fDUyBBuuPiJYIrSOgjbPlihG_wBvrva19saCMYG-vFPL4cTP-e_85NyAJhnZeicobVKFrVmMR2vKwIjRlS67rbtYvawVUBBgzs-nyq44cU1IlfRT_Y7z1IjPN97AaH04w6WNA2-UjdFmrc6SI03or2g1zR8iRhEahLFkaIVuAGtPJZtJcC48PGG3zBzTKJ-izuuj5DjLYMoAKc",
  "https://lh3.googleusercontent.com/aida-public/AB6AXuDBEH2KpvPeI1KzS9EMHaZo3DmNpQsXwBKqNS0jBOEa2v7uxaPeI4-CiKVHzxCkuVteZ-8CDfOYL2qqbSitQfOrAp76eHayCN3zZTc47YdDlmCjcikf-l6drYzq3jeNlgzzaGHTVctOZaTdcLGl7nt3j9vA1UtlA4hZyT7Sj_55l6O-DonTW5QBPdLPYKLpQeo47oqoY9DUNRIuMWjZxSJn-TtaMAhWX9lg9639r5VlJDzGWRt_RHA370u_RBBKJtz5aBiiSRFE7zg",
  "https://lh3.googleusercontent.com/aida-public/AB6AXuAKRBf8VL4eRS5TeUSvjHNkd6eY5AfsFeE4jbe4loxWUgn3nwWY4kSxDGVXU1NIhbgWfUSD_ogboibm-_DXoXAUvlE3ugBq_t3udaI201cDCcutQbd-KpnuxdDUmAdjrt3x8DZOzGobUtIpDB1C2xQeBB5nKXt5HFoMSfltC8RBLTKpEw5BYBonleE_Xd4OjpvKNHm7Fix58FynAokbA0yO2IsGvTDWIdh5Jg_0QgdP9w-bc_ad1Jg1_1UOGV98TsMwDP35dX7AA8E"
];
const COVER_IMG_URL = "https://lh3.googleusercontent.com/aida-public/AB6AXuDMwCMsFkXT89mofjjm5l67bZMKD5Nx2WCg_NyrSc9jYDOXlMfC8-UKqT27vgAvyLnOiC_9y5TvKHtZDoOvQ1GDuNA0Na3FMXT9iHC3GBaT_F-ADZvIPHOTciQOOzrFQxH2a9rzPx3_Sf9n1Fo8h42SViKRTCjy_Z_PAHAd7X7eX5KqyIvlPnikONgf14-puM3OXU_5_rJ_kez5fWKktwT927CQ1eNaOvX7lWWjh1XGnuW4v3ajcy-wx_BjKMUKH5sygOrVT6nzzYo";

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const { setHasCompletedOnboarding, setIsAuthenticated } = useAuthStore();

  const screenOpacity = useSharedValue(0);

  useEffect(() => {
    screenOpacity.value = withTiming(1, { duration: 600 });
  }, []);

  const handleBeginJourney = async () => {
    setHasCompletedOnboarding(true);
    setIsAuthenticated(true);
    router.replace('/(tabs)/home');
  };

  const handleLearnMore = () => {
    // Navigate to informative page if needed
    console.log('Learn more');
  };

  const animatedScreenStyle = useAnimatedStyle(() => ({ opacity: screenOpacity.value }));

  return (
    <Animated.View style={[styles.container, animatedScreenStyle]}>
      {/* Global Decorative Blurs */}
      <View style={[StyleSheet.absoluteFill, { overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }]}>
        <Svg height="100%" width="100%">
          <Defs>
            <RadialGradient id="globalTopRight" cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor="#c5eccc" stopOpacity="0.2" />
              <Stop offset="100%" stopColor="#c5eccc" stopOpacity="0" />
            </RadialGradient>
            <RadialGradient id="globalBottomLeft" cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor="#ffdad3" stopOpacity="0.15" />
              <Stop offset="100%" stopColor="#ffdad3" stopOpacity="0" />
            </RadialGradient>
          </Defs>
          {/* w-[40vw] h-[40vw] right-[-5%] top-[10%] */}
          <Circle cx={SCREEN_WIDTH * 0.85} cy={SCREEN_HEIGHT * 0.25} r={SCREEN_WIDTH * 0.4} fill="url(#globalTopRight)" />
          {/* w-[30vw] h-[30vw] bottom-[-10%] left-[-5%] */}
          <Circle cx={SCREEN_WIDTH * 0.15} cy={SCREEN_HEIGHT * 0.95} r={SCREEN_WIDTH * 0.3} fill="url(#globalBottomLeft)" />
        </Svg>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingTop: Math.max(insets.top, 24), paddingBottom: Math.max(insets.bottom, 24) }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header / Brand Anchor */}
        <View style={styles.header}>
          <View style={styles.logoCluster}>
            <View style={styles.logoBlobContainer}>
              <Svg width={40} height={40} viewBox="0 0 256 256">
                <Defs>
                  <LinearGradient id="logoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <Stop offset="0%" stopColor="#44674d" />
                    <Stop offset="100%" stopColor="#c5eccc" />
                  </LinearGradient>
                </Defs>
                <Path d={blobPath} fill="url(#logoGrad)" />
              </Svg>
              <MaterialIcons name="spa" size={20} color="#ffffff" style={{ position: 'absolute' }} />
            </View>
            <Text style={styles.navText}>Nurturing Atelier</Text>
          </View>
        </View>

        {/* Main Content Area */}
        <View style={styles.mainCanvas}>
          {/* Hero Visual Section */}
          <View style={styles.heroContainer}>
            {/* Background small decorative blurs relative to the image bounding box */}
            <View style={[StyleSheet.absoluteFill, { zIndex: -1 }]}>
              <Svg height="100%" width="100%" style={{ overflow: 'visible' }}>
                <Defs>
                  <RadialGradient id="imgTopLeft" cx="50%" cy="50%" r="50%">
                    <Stop offset="0%" stopColor="#d3fbda" stopOpacity="0.3" />
                    <Stop offset="100%" stopColor="#d3fbda" stopOpacity="0" />
                  </RadialGradient>
                  <RadialGradient id="imgBottomRight" cx="50%" cy="50%" r="50%">
                    <Stop offset="0%" stopColor="#ffdad3" stopOpacity="0.2" />
                    <Stop offset="100%" stopColor="#ffdad3" stopOpacity="0" />
                  </RadialGradient>
                </Defs>
                {/* -top-10 -left-10 w-48 h-48 */}
                <Circle cx="-20" cy="-20" r="100" fill="url(#imgTopLeft)" />
                {/* -bottom-10 -right-10 w-64 h-64 */}
                <Circle cx={SCREEN_WIDTH * 0.8 + 20} cy={SCREEN_WIDTH * 0.8 + 20} r="130" fill="url(#imgBottomRight)" />
              </Svg>
            </View>

            {/* The Hearth Container & SVG Mas */}
            <View style={styles.hearthAssetContainer}>
              <Svg width="100%" height="100%" viewBox="0 0 256 256">
                <Defs>
                  <ClipPath id="imgHearthClip">
                    <Path d={blobPath} />
                  </ClipPath>
                  <LinearGradient id="heroGradOverlay" x1="0%" y1="100%" x2="100%" y2="0%">
                    <Stop offset="0%" stopColor="#44674d" stopOpacity={0.2} />
                    <Stop offset="100%" stopColor="#ffffff" stopOpacity={0} />
                  </LinearGradient>
                </Defs>
                {/* We set a very similar scale as object-cover using slice */}
                <SvgImage
                  href={{ uri: COVER_IMG_URL }}
                  width="256" height="256"
                  preserveAspectRatio="xMidYMid slice"
                  clipPath="url(#imgHearthClip)"
                  opacity={0.8}
                />
                <Rect width="256" height="256" fill="url(#heroGradOverlay)" clipPath="url(#imgHearthClip)" />
              </Svg>
            </View>

            {/* Floating Support Badge */}
            <View style={styles.floatingBadge}>
              <View style={styles.floatingIcon}>
                <MaterialIcons name="favorite" size={20} color="#ffffff" />
              </View>
              <View style={styles.floatingTexts}>
                <Text style={styles.floatingTitle}>Gentle Care</Text>
                <Text style={styles.floatingSubtitle}>For your loved ones</Text>
              </View>
            </View>
          </View>

          {/* Text Instruction Block */}
          <View style={styles.textBlock}>
            <Text style={styles.welcomeLabel}>Welcome to the sanctuary</Text>

            <Text style={styles.heroTitle}>Your family’s <Text style={{ color: AuthColors.primary, fontStyle: 'italic' }}>digital sanctuary</Text></Text>

            <Text style={styles.heroSubtitle}>
              A space for mindful connections and gentle monitoring. We help you nurture growth without intruding on privacy.
            </Text>

            {/* Action Buttons */}
            <View style={styles.buttonRow}>
              <Button
                title="Begin Your Journey"
                onPress={handleBeginJourney}
                icon="arrow-forward"
              />
              <Button
                title="Learn More"
                onPress={handleLearnMore}
                variant="secondary"
              />
            </View>

            {/* Social Proof */}
            <View style={styles.socialProof}>
              <View style={styles.avatarCluster}>
                <RNImage source={{ uri: AVATAR_URLS[0] }} style={styles.avatar} />
                <RNImage source={{ uri: AVATAR_URLS[1] }} style={[styles.avatar, styles.overlapAvatar]} />
                <RNImage source={{ uri: AVATAR_URLS[2] }} style={[styles.avatar, styles.overlapAvatar]} />
              </View>
              <Text style={styles.socialProofText}>Trusted by 2,000+ families</Text>
            </View>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.copyrightText}>© 2024 Nurturing Atelier. All rights reserved.</Text>
          <View style={styles.footerLinks}>
            <Text style={styles.footerLink}>Privacy First</Text>
            <Text style={styles.footerLink}>Our Values</Text>
            <Text style={styles.footerLink}>Help Center</Text>
          </View>
        </View>

      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AuthColors.background,
  },
  header: {
    paddingHorizontal: 24, // `p-6` equivalent layout mapping
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 48, // `my-12` margins
  },
  logoCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8, // `gap-2`
  },
  logoBlobContainer: {
    width: 40, // `w-10`
    height: 40, // `h-10`
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#44674d',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  navText: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontWeight: '700',
    fontSize: 20, // `text-xl`
    letterSpacing: -0.5, // `tracking-tight`
    color: '#44674d', // `text-primary`
  },
  mainCanvas: {
    flex: 1,
    paddingHorizontal: 24, // `p-6 md:p-12` baseline mapping 
    alignItems: 'center',
  },
  heroContainer: {
    position: 'relative',
    width: SCREEN_WIDTH * 0.8, // `max-w-md aspect-square` emulation bounded nicely
    height: SCREEN_WIDTH * 0.8,
    maxWidth: 384,
    maxHeight: 384,
    marginBottom: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  hearthAssetContainer: {
    width: '100%',
    height: '100%',
    shadowColor: '#44674d',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 10,
  },
  floatingBadge: {
    position: 'absolute',
    bottom: 24,
    right: -16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 16,
    paddingHorizontal: 24,
    backgroundColor: 'rgba(228, 228, 204, 0.6)', // AuthColors.surfaceVariant at 60%
    borderRadius: AuthRadius.xl,
    shadowColor: '#3e2723',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.06,
    shadowRadius: 40,
    elevation: 4,
  },
  floatingIcon: {
    width: 48, // `w-12`
    height: 48, // `h-12`
    borderRadius: 24,
    backgroundColor: '#a0412d', // `bg-secondary`
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  floatingTexts: {
    justifyContent: 'center',
  },
  floatingTitle: {
    color: '#363228', // `text-on-surface`
    fontFamily: 'PlusJakartaSans-SemiBold',
    fontWeight: '600',
    fontSize: 14, // `text-sm`
  },
  floatingSubtitle: {
    color: '#645e53', // `text-on-surface-variant`
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12, // `text-xs`
  },
  textBlock: {
    width: '100%',
    maxWidth: 420,
    alignItems: 'center',
  },
  welcomeLabel: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontWeight: '700',
    fontSize: 12, // `text-xs`
    color: '#44674d', // `text-primary`
    textTransform: 'uppercase',
    letterSpacing: 2.4, // `tracking-[0.2em]`
    marginBottom: 16, // `mb-4`
    textAlign: 'center',
  },
  heroTitle: {
    fontFamily: 'PlusJakartaSans-ExtraBold',
    fontWeight: '800',
    fontSize: 36, // `text-4xl`
    color: '#363228', // `text-on-surface`
    lineHeight: 44, // `leading-tight`
    marginBottom: 24, // `mb-6`
    textAlign: 'center',
  },
  heroSubtitle: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 18, // `text-lg`
    color: '#645e53', // `text-on-surface-variant`
    marginBottom: 40, // `mb-10`
    lineHeight: 28, // `leading-relaxed`
    textAlign: 'center',
  },
  buttonRow: {
    width: '100%',
    flexDirection: 'column',
    gap: 16, // `gap-4` vertically mapping
    marginBottom: 48,
  },
  socialProof: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16, // `gap-4`
    opacity: 0.7, // `opacity-70`
    marginBottom: 48,
  },
  avatarCluster: {
    flexDirection: 'row',
  },
  avatar: {
    width: 32, // `w-8`
    height: 32, // `h-8`
    borderRadius: 16, // `rounded-full`
    borderWidth: 2,
    borderColor: AuthColors.background,
  },
  overlapAvatar: {
    marginLeft: -8, // `-space-x-2` overlap
  },
  socialProofText: {
    fontSize: 14, // `text-sm`
    fontFamily: 'PlusJakartaSans-Medium',
    fontWeight: '500',
    color: '#645e53', // `text-on-surface-variant`
  },
  footer: {
    width: '100%',
    alignItems: 'center',
    gap: 24, // `gap-6` between columns
    paddingHorizontal: 24,
    paddingBottom: 24,
    opacity: 0.6, // `opacity-60`
  },
  copyrightText: {
    fontSize: 12, // `text-xs`
    fontFamily: 'PlusJakartaSans-Medium',
    fontWeight: '500',
    color: '#645e53', // `text-on-surface-variant`
    textAlign: 'center',
  },
  footerLinks: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 32, // `gap-8`
  },
  footerLink: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontWeight: '700',
    fontSize: 12,
    color: '#363228', // `text-on-surface`
  }
});