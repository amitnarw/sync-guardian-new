import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';

const C = {
  primary: '#44674d',
  surfaceContainer: '#f5ede0',
} as const;

export default function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  return (
    <SafeAreaView style={s.navSafeArea} edges={['bottom']}>
      <View style={s.bottomNav}>
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const label =
            options.tabBarLabel !== undefined
              ? options.tabBarLabel
              : options.title !== undefined
              ? options.title
              : route.name;

          const isFocused = state.index === index;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params);
            }
          };

          const onLongPress = () => {
            navigation.emit({
              type: 'tabLongPress',
              target: route.key,
            });
          };

          let iconName: any = 'help';
          if (route.name === 'home') iconName = 'dashboard';
          else if (route.name === 'activity') iconName = 'analytics';
          else if (route.name === 'insights') iconName = 'insights';
          else if (route.name === 'rules') iconName = 'gavel';
          else if (route.name === 'settings') iconName = 'settings';

          return (
            <TouchableOpacity
              key={route.key}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              accessibilityLabel={options.tabBarAccessibilityLabel}
              testID={options.tabBarButtonTestID}
              onPress={onPress}
              onLongPress={onLongPress}
              style={[s.navItem, isFocused ? s.navItemActive : s.navItemInactive]}
            >
              <MaterialIcons
                name={iconName}
                size={22}
                color={isFocused ? C.primary : 'rgba(54,50,40,0.5)'}
              />
              <Text style={[s.navLabel, isFocused && s.navLabelActive]}>
                {label as string}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  navSafeArea: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    shadowColor: '#363228',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.06,
    shadowRadius: 32,
    elevation: 8,
  },
  bottomNav: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 20,
  },
  navItem: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9999,
    gap: 2,
  },
  navItemActive: {
    backgroundColor: C.surfaceContainer,
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
