import { useEffect, useState } from 'react';
import { StyleSheet, View, Text, Pressable, ScrollView, Dimensions, Platform } from 'react-native';
import { router } from 'expo-router';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import Svg, { Path, Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '@/hooks/use-auth-store';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Blob Path 1: Parent border-radius: 60% 40% 70% 30% / 40% 50% 60% 70%;
const pathParent = "M153.6 0 C210.1 0 256 57.3 256 128 C256 212.8 175.7 256 76.8 256 C34.4 256 0 175.7 0 102.4 C0 34.4 68.8 0 153.6 0 Z";
// Blob Path 2: Child border-radius: 40% 60% 30% 70% / 50% 40% 70% 60%;
const pathChild = "M102.4 0 C187.2 0 256 45.8 256 102.4 C256 175.7 221.6 256 179.2 256 C94.4 256 0 198.7 0 128 C0 57.3 45.8 0 102.4 0 Z";

function ParentRoleNode({ onPress }: { onPress: () => void }) {
  const scale = useSharedValue(1);
  const opacityText = useSharedValue(0.7); // opacity-70 default
  // 0 is false, 1 is true
  const focusVal = useSharedValue(0);

  const handlePressIn = () => {
    scale.value = withSpring(0.95, { damping: 15, stiffness: 300 });
    opacityText.value = withTiming(1, { duration: 200 });
    focusVal.value = withTiming(1, { duration: 200 });
  };
  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 300 });
    opacityText.value = withTiming(0.7, { duration: 200 });
    focusVal.value = withTiming(0, { duration: 200 });
  };

  const animatedScale = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const animatedText = useAnimatedStyle(() => ({ opacity: opacityText.value }));

  // Custom Reanimated for SVG coloring can be tricky. We use absolute layout layering to toggle opacity for the hovered blob
  const animatedHoverBlob = useAnimatedStyle(() => ({ opacity: focusVal.value * 0.5 }));

  return (
    <AnimatedPressable onPress={onPress} onPressIn={handlePressIn} onPressOut={handlePressOut} style={[styles.roleNodeBlock, animatedScale]}>
      <View style={styles.blobContainer}>
        <Svg width="100%" height="100%" viewBox="0 0 256 256" style={StyleSheet.absoluteFill}>
          <Defs>
            <LinearGradient id="parentGrad" x1="0%" y1="100%" x2="100%" y2="0%">
              <Stop offset="0%" stopColor="#44674d" stopOpacity="0.1" />
              <Stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
            </LinearGradient>
          </Defs>
          {/* Base state transparent blob */}
          <Path d={pathParent} fill="rgba(197, 236, 204, 0.4)" />
          {/* Hover state blob mapping bg-primary-container/60 */}
          <Animated.View style={[StyleSheet.absoluteFill, animatedHoverBlob]}>
            <Svg width="100%" height="100%" viewBox="0 0 256 256">
              <Path d={pathParent} fill="rgba(197, 236, 204, 0.6)" />
            </Svg>
          </Animated.View>
          {/* The gradient overlay */}
          <Path d={pathParent} fill="url(#parentGrad)" opacity={0.5} />
        </Svg>

        <View style={[styles.innerCircle, styles.parentShadow]}>
          <MaterialIcons name="family-restroom" size={48} color="#44674d" />
        </View>
        <Text style={[styles.roleTitle, { color: '#375941' }]}>Parent</Text>
      </View>
      <Animated.Text style={[styles.roleSubtitle, animatedText]}>Guiding the journey</Animated.Text>
    </AnimatedPressable>
  );
}

function ChildRoleNode({ onPress }: { onPress: () => void }) {
  const scale = useSharedValue(1);
  const opacityText = useSharedValue(0.7);
  const focusVal = useSharedValue(0);

  const handlePressIn = () => {
    scale.value = withSpring(0.95, { damping: 15, stiffness: 300 });
    opacityText.value = withTiming(1, { duration: 200 });
    focusVal.value = withTiming(1, { duration: 200 });
  };
  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 300 });
    opacityText.value = withTiming(0.7, { duration: 200 });
    focusVal.value = withTiming(0, { duration: 200 });
  };

  const animatedScale = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const animatedText = useAnimatedStyle(() => ({ opacity: opacityText.value }));
  const animatedHoverBlob = useAnimatedStyle(() => ({ opacity: focusVal.value * 0.5 }));

  return (
    <AnimatedPressable onPress={onPress} onPressIn={handlePressIn} onPressOut={handlePressOut} style={[styles.roleNodeBlock, animatedScale]}>
      <View style={styles.blobContainer}>
        <Svg width="100%" height="100%" viewBox="0 0 256 256" style={StyleSheet.absoluteFill}>
          <Defs>
            <LinearGradient id="childGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor="#ffffff" stopOpacity="0" />
              <Stop offset="100%" stopColor="#a0412d" stopOpacity="0.1" />
            </LinearGradient>
          </Defs>
          {/* Base state transparent blob bg-secondary-container/40 */}
          <Path d={pathChild} fill="rgba(255, 218, 211, 0.4)" />
          {/* Hover state blob mapping bg-secondary-container/60 */}
          <Animated.View style={[StyleSheet.absoluteFill, animatedHoverBlob]}>
            <Svg width="100%" height="100%" viewBox="0 0 256 256">
              <Path d={pathChild} fill="rgba(255, 218, 211, 0.6)" />
            </Svg>
          </Animated.View>
          <Path d={pathChild} fill="url(#childGrad)" opacity={0.5} />
        </Svg>

        <View style={[styles.innerCircle, styles.childShadow]}>
          <MaterialIcons name="child-care" size={48} color="#a0412d" />
        </View>
        <Text style={[styles.roleTitle, { color: '#8e3421' }]}>Child</Text>
      </View>
      <Animated.Text style={[styles.roleSubtitle, animatedText]}>Exploring with wonder</Animated.Text>
    </AnimatedPressable>
  );
}

export default function RoleSelectionScreen() {
  const insets = useSafeAreaInsets();
  const setUserRole = useAuthStore((state) => state.setUserRole);

  const screenOpacity = useSharedValue(0);

  useEffect(() => {
    screenOpacity.value = withTiming(1, { duration: 600 });
  }, []);

  const handleRoleSelect = (role: 'parent' | 'child') => {
    setUserRole(role);
    router.push('/login');
  };

  const animatedScreenStyle = useAnimatedStyle(() => ({ opacity: screenOpacity.value }));

  return (
    <Animated.View style={[styles.container, animatedScreenStyle]}>
      <ScrollView contentContainerStyle={[styles.scrollCanvas, { paddingTop: Math.max(insets.top, 24) }]} showsVerticalScrollIndicator={false}>
        {/* Top Header */}
        <View style={styles.header}>
          <View style={styles.headerLogo}>
            <MaterialIcons name="spa" size={24} color="#44674d" />
            <Text style={styles.headerText}>Nurturing Atelier</Text>
          </View>
        </View>

        <View style={styles.titleContainer}>
          <Text style={styles.titleText}>Who is joining the{"\n"}<Text style={styles.titleItalic}>sanctuary</Text> today?</Text>
          <Text style={styles.titleSubtitle}>A Shared Digital Experience</Text>
        </View>

        <View style={styles.roleGrid}>
          <ParentRoleNode onPress={() => handleRoleSelect('parent')} />
          <ChildRoleNode onPress={() => handleRoleSelect('child')} />
        </View>

        {/* Removed indicator container (vertical line) as requested */}
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff8f0', // AuthColors.surface
  },
  header: {
    width: '100%',
    paddingHorizontal: 24,
    paddingBottom: 24,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  headerLogo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center', // Added to perfectly center
    gap: 8,
  },
  headerText: {
    color: '#44674d',
    fontFamily: 'PlusJakartaSans-Bold',
    fontWeight: '700',
    fontSize: 18,
    letterSpacing: -0.5,
  },
  scrollCanvas: {
    paddingHorizontal: 24,
    paddingBottom: 48,
    alignItems: 'center',
  },
  titleContainer: {
    width: '100%',
    maxWidth: 896, // max-w-4xl max layout bounding
    alignItems: 'center',
    marginBottom: 48, // mb-12
  },
  titleText: {
    color: '#363228',
    fontFamily: 'PlusJakartaSans-Bold',
    fontWeight: '700',
    fontSize: 32, // text-3xl standard mobile sizing
    lineHeight: 40,
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  titleSubtitle: {
    color: '#807a6d',
    fontFamily: 'PlusJakartaSans-Medium',
    fontWeight: '500',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 2.4,
    marginTop: 16,
    textAlign: 'center',
  },
  titleItalic: {
    color: '#44674d',
    fontStyle: 'italic',
  },
  roleGrid: {
    width: '100%',
    maxWidth: 1024,
    flexDirection: 'column', // grid-cols-1 on small
    gap: 48,
    alignItems: 'center',
  },
  roleNodeBlock: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  blobContainer: {
    width: 256, // w-64
    height: 256, // h-64
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginBottom: 24, // mb-6
  },
  innerCircle: {
    width: 96, // w-24
    height: 96, // h-24
    borderRadius: 48,
    backgroundColor: '#ffffff', // bg-surface-container-lowest
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24, // z-10 visually
    zIndex: 10,
  },
  parentShadow: {
    shadowColor: '#44674d', // shadow-primary/5
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 16,
    elevation: 4,
  },
  childShadow: {
    shadowColor: '#a0412d', // shadow-secondary/5
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 16,
    elevation: 4,
  },
  roleTitle: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontWeight: '700',
    fontSize: 24, // text-2xl
    zIndex: 10,
  },
  roleSubtitle: {
    color: '#645e53',
    fontFamily: 'PlusJakartaSans-Medium',
    fontWeight: '500',
    fontSize: 16,
  },
});