import { Tabs } from 'expo-router';
import { Dimensions, View } from 'react-native';
import { useEffect, useRef } from 'react';
import { BlurTargetView } from 'expo-blur';
import CustomTabBar from '@/components/custom-tab-bar';
import { AuthColors } from '@/constants/auth-theme';
import { useProtectedRoute } from '@/hooks/use-protected-route';
import { usePairStatusGuard } from '@/hooks/use-pair-status-guard';
import { useAuthStore } from '@/hooks/use-auth-store';
import { useAppModal } from '@/hooks/use-app-modal';

const SCREEN_W = Dimensions.get('window').width;

export default function ChildLayout() {
  const blurTargetRef = useRef<View>(null);
  useProtectedRoute('child');
  usePairStatusGuard('child');
  const syncDeviceErrorCount = useAuthStore((s) => s.syncDeviceErrorCount);
  const syncDeviceError = useAuthStore((s) => s.syncDeviceError);
  const { showModal } = useAppModal();
  const shownRef = useRef(false);

  useEffect(() => {
    if (syncDeviceErrorCount >= 3 && syncDeviceError && !shownRef.current) {
      shownRef.current = true;
      showModal({
        title: 'Sync Issue Detected',
        message: 'Your device is having trouble syncing. Please re-register or check your connection.',
        icon: 'warning',
        primaryButton: 'Okay',
        onPrimaryPress: () => { shownRef.current = false; },
      });
    }
  }, [syncDeviceErrorCount, syncDeviceError, showModal]);

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
