import React, { useEffect } from 'react';
import { Text, TouchableOpacity, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useRouter, usePathname } from 'expo-router';
import Animated, { useAnimatedStyle, withSpring, useSharedValue } from 'react-native-reanimated';

const C = {
  primary: '#44674d',
  selectedPill: '#dcebd2',
} as const;

const ROUTES = [
  { name: 'home', label: 'Dashboard', icon: 'dashboard' as const, href: '/(tabs)/home' },
  { name: 'activity', label: 'Activity', icon: 'analytics' as const, href: '/(tabs)/activity' },
  { name: 'insights', label: 'Insights', icon: 'insights' as const, href: '/(tabs)/insights' },
  { name: 'rules', label: 'Rules', icon: 'gavel' as const, href: '/(tabs)/rules' },
  { name: 'settings', label: 'Settings', icon: 'settings' as const, href: '/(tabs)/settings' },
];

const SPRING_CONFIG = { stiffness: 350, damping: 25, mass: 0.8 };

interface CustomTabBarProps {
  blurTargetRef: React.RefObject<View>;
}

function TabItem({
  route,
  isFocused,
  onPress,
}: {
  route: typeof ROUTES[number];
  isFocused: boolean;
  onPress: () => void;
}) {
  const scale = useSharedValue(isFocused ? 1 : 0.92);
  const opacity = useSharedValue(isFocused ? 1 : 0.6);

  useEffect(() => {
    scale.value = withSpring(isFocused ? 1 : 0.92, SPRING_CONFIG);
    opacity.value = withSpring(isFocused ? 1 : 0.6, SPRING_CONFIG);
  }, [isFocused, scale, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={isFocused ? { selected: true } : {}}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Animated.View style={[s.navItem, isFocused ? s.navItemActive : s.navItemInactive, animatedStyle]}>
        <MaterialIcons
          name={route.icon}
          size={22}
          color={isFocused ? C.primary : 'rgba(54,50,40,0.5)'}
        />
        <Text style={[s.navLabel, isFocused && s.navLabelActive]}>
          {route.label}
        </Text>
      </Animated.View>
    </TouchableOpacity>
  );
}

export default function CustomTabBar({ blurTargetRef }: CustomTabBarProps) {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <BlurView intensity={80} tint="light" blurTarget={blurTargetRef} blurMethod="dimezisBlurView" style={s.navSafeArea}>
      <SafeAreaView edges={['bottom']} style={s.bottomNav}>
        {ROUTES.map((route) => {
          const isFocused = pathname.includes(route.name);

          return (
            <TabItem
              key={route.name}
              route={route}
              isFocused={isFocused}
              onPress={() => {
                if (!isFocused) {
                  router.replace(route.href as any);
                }
              }}
            />
          );
        })}
      </SafeAreaView>
    </BlurView>
  );
}

const s = StyleSheet.create({
  navSafeArea: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    overflow: 'hidden',
  },
  bottomNav: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  navItem: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9999,
    gap: 2,
  },
  navItemActive: {
    backgroundColor: C.selectedPill,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  navItemInactive: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  navLabel: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 10,
    lineHeight: 14,
    letterSpacing: 0.5,
    color: 'rgba(54,50,40,0.5)',
    textTransform: 'uppercase',
  },
  navLabelActive: {
    color: C.primary,
  },
});
