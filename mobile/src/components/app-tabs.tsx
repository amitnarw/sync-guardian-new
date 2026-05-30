import { Tabs } from 'expo-router';
import React, { useRef } from 'react';
import { Dimensions, View } from 'react-native';
import { BlurTargetView } from 'expo-blur';
import CustomTabBar from './custom-tab-bar';

const SCREEN_W = Dimensions.get('window').width;

export default function AppTabs() {
  const blurTargetRef = useRef<View>(null);

  return (
    <View style={{ flex: 1, backgroundColor: '#ffffff' }}>
      <BlurTargetView ref={blurTargetRef} style={{ flex: 1 }}>
        <Tabs
          screenOptions={{
            headerShown: false,
            tabBarStyle: { display: 'none' },
            animation: 'shift',
            sceneStyle: { backgroundColor: '#ffffff' },
            sceneStyleInterpolator: ({ current }) => ({
              sceneStyle: {
                transform: [
                  {
                    translateX: current.progress.interpolate({
                      inputRange: [-1, 0, 1],
                      outputRange: [-SCREEN_W, 0, SCREEN_W],
                    }),
                  },
                ],
              },
            }),
          }}
          detachInactiveScreens={false}
        >
          <Tabs.Screen
            name="home"
            options={{
              title: 'Home',
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
