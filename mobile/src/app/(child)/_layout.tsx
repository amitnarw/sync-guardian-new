import { Tabs } from 'expo-router';
import { Dimensions, View } from 'react-native';
import { useRef } from 'react';
import { BlurTargetView } from 'expo-blur';
import CustomTabBar from '@/components/custom-tab-bar';
import { AuthColors } from '@/constants/auth-theme';

const SCREEN_W = Dimensions.get('window').width;

export default function ChildLayout() {
  const blurTargetRef = useRef<View>(null);

  return (
    <View style={{ flex: 1, backgroundColor: AuthColors.background }}>
      <BlurTargetView ref={blurTargetRef} style={{ flex: 1 }}>
        <Tabs
          screenOptions={{
            headerShown: false,
            tabBarStyle: { display: 'none' },
            animation: 'shift',
            sceneStyle: { backgroundColor: AuthColors.background },
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
          <Tabs.Screen name="home" />
          <Tabs.Screen name="settings" />
        </Tabs>
      </BlurTargetView>
      <CustomTabBar 
        blurTargetRef={blurTargetRef} 
        routes={[
          { name: 'home', label: 'Home', icon: 'dashboard', href: '/(child)/home' },
          { name: 'settings', label: 'Settings', icon: 'settings', href: '/(child)/settings' },
        ]}
      />
    </View>
  );
}
