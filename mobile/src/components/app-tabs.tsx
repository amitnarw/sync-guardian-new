import { Tabs } from 'expo-router';
import React, { useRef } from 'react';
import { View } from 'react-native';
import { BlurTargetView } from 'expo-blur';
import CustomTabBar from './custom-tab-bar';

export default function AppTabs() {
  const blurTargetRef = useRef<View>(null);

  return (
    <View style={{ flex: 1 }}>
      <BlurTargetView ref={blurTargetRef} style={{ flex: 1 }}>
        <Tabs
          screenOptions={{
            headerShown: false,
            tabBarStyle: { display: 'none' },
            animation: 'fade',
          }}
        >
          <Tabs.Screen
            name="home"
            options={{
              title: 'Dashboard',
            }}
          />
          <Tabs.Screen
            name="activity"
            options={{
              title: 'Activity',
            }}
          />
          <Tabs.Screen
            name="insights"
            options={{
              title: 'Insights',
            }}
          />
          <Tabs.Screen
            name="rules"
            options={{
              title: 'Rules',
            }}
          />
          <Tabs.Screen
            name="settings"
            options={{
              title: 'Settings',
            }}
          />
        </Tabs>
      </BlurTargetView>
      <CustomTabBar blurTargetRef={blurTargetRef} />
    </View>
  );
}
