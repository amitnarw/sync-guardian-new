import { RNAndroidNotificationListenerHeadlessJsName } from 'react-native-android-notification-listener';
import { AppRegistry } from 'react-native';
import { supabase } from '@/lib/supabase';
import { bufferNotification, flushBuffer } from './mmkv-buffer';
import { useAuthStore } from '@/hooks/use-auth-store';

export const headlessNotificationListener = async ({ notification }: { notification: string }) => {
  if (!notification) return;

  try {
    const parsed = JSON.parse(notification);
    
    // Check if the device is a child and has a pairId
    const { userRole, pairId } = useAuthStore.getState();
    if (userRole !== 'child' || !pairId) {
      return;
    }

    const payload = {
      id: parsed.id || Math.random().toString(36).substring(7),
      source_app_name: parsed.app || 'Unknown App',
      source_package: parsed.app || 'unknown.package',
      title: parsed.title || '',
      body: parsed.text || '',
      posted_at: parsed.time ? new Date(parseInt(parsed.time, 10)).toISOString() : new Date().toISOString(),
      pair_id: pairId,
    };

    // Filter logic placeholder (allow all for now, to be expanded)
    // if (!isAppAllowed(payload.source_package)) return;

    // Try to send to Supabase
    try {
      const { error } = await supabase.functions.invoke('ingest-child-notification', {
        body: { notifications: [payload] },
      });
      if (error) throw error;
      
      // If success, attempt to flush any previously buffered notifications
      flushBuffer();
    } catch (e) {
      // If offline or fails, buffer it
      console.log("Failed to send notification, buffering...", e);
      bufferNotification(payload);
    }
  } catch (err) {
    console.error('Error processing notification:', err);
  }
};

AppRegistry.registerHeadlessTask(
  RNAndroidNotificationListenerHeadlessJsName,
  () => headlessNotificationListener
);
