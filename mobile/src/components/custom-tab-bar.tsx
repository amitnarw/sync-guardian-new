import React, { useEffect, useRef } from 'react';
import { Text, TouchableOpacity, StyleSheet, View, LayoutChangeEvent } from 'react-native';
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
  { name: 'home', label: 'Home', icon: 'dashboard' as const, href: '/(tabs)/home' },
  { name: 'activity', label: 'Activity', icon: 'analytics' as const, href: '/(tabs)/activity' },
  { name: 'insights', label: 'Insights', icon: 'insights' as const, href: '/(tabs)/insights' },
  { name: 'rules', label: 'Rules', icon: 'gavel' as const, href: '/(tabs)/rules' },
  { name: 'settings', label: 'Settings', icon: 'settings' as const, href: '/(tabs)/settings' },
];

const SPRING_CONFIG = { stiffness: 350, damping: 25, mass: 0.8 };
const PILL_W = 84;
const PILL_H = 48;

interface CustomTabBarProps {
  blurTargetRef: React.RefObject<View | null>;
}

function TabItem({
  route,
  isFocused,
  onPress,
  onLayout,
}: {
  route: typeof ROUTES[number];
  isFocused: boolean;
  onPress: () => void;
  onLayout?: (e: LayoutChangeEvent) => void;
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
      onLayout={onLayout}
    >
      <Animated.View style={[s.navItem, animatedStyle]}>
        <MaterialIcons
          name={route.icon}
          size={22}
          color={isFocused ? "#fff" : 'rgba(54,50,40,0.5)'}
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
  const tabLayouts = useRef<{ x: number; y: number; width: number; height: number }[]>([]);
  const layoutsReady = useRef(false);
  const pillLeft = useSharedValue(0);
  const pillTop = useSharedValue(0);
  const pillW = useSharedValue(0);
  const pillH = useSharedValue(0);

  const activeIndex = ROUTES.findIndex(r => pathname.includes(r.name));

  useEffect(() => {
    const layout = tabLayouts.current[activeIndex];
    if (layout) {
      const cx = layout.x + layout.width / 2;
      const cy = layout.y + layout.height / 2;
      pillW.value = PILL_W;
      pillH.value = PILL_H;
      pillLeft.value = withSpring(cx - PILL_W / 2, SPRING_CONFIG);
      pillTop.value = withSpring(cy - PILL_H / 2, SPRING_CONFIG);
    }
  }, [activeIndex, pillLeft, pillTop, pillW, pillH]);

  const handleLayout = (index: number, e: LayoutChangeEvent) => {
    const { x, y, width, height } = e.nativeEvent.layout;
    tabLayouts.current[index] = { x, y, width, height };

    if (!layoutsReady.current) {
      const allReady = ROUTES.every((_, i) => tabLayouts.current[i] != null);
      if (allReady) {
        layoutsReady.current = true;
        const layout = tabLayouts.current[activeIndex];
        if (layout) {
          const cx = layout.x + layout.width / 2;
          const cy = layout.y + layout.height / 2;
          pillW.value = PILL_W;
          pillH.value = PILL_H;
          pillLeft.value = cx - PILL_W / 2;
          pillTop.value = cy - PILL_H / 2;
        }
      }
    }
  };

  const pillStyle = useAnimatedStyle(() => ({
    left: pillLeft.value,
    top: pillTop.value,
    width: pillW.value,
    height: pillH.value,
  }));

  return (
    <BlurView intensity={80} tint="light" blurTarget={blurTargetRef} blurMethod="dimezisBlurView" style={s.navSafeArea}>
      <SafeAreaView edges={['bottom']} style={s.bottomNav}>
        <Animated.View style={[s.pill, pillStyle]} />
        {ROUTES.map((route, index) => {
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
              onLayout={(e) => handleLayout(index, e)}
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
    paddingTop: 10,
    paddingBottom: 5,
    position: 'relative',
  },
  navItem: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9999,
    gap: 2,
    paddingHorizontal: 14,
    paddingVertical: 12,
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
    color: "#fff",
  },
  pill: {
    position: 'absolute',
    borderRadius: 9999,
    backgroundColor: C.primary,
  },
});
