import { AppRegistry } from 'react-native';
import { supabase } from '@/lib/supabase';
import { bufferNotification, flushBuffer, getProcessedKeysSet, addToProcessedKeys } from './mmkv-buffer';
import { useAuthStore } from '@/hooks/use-auth-store';

// Headless task name matching NotificationHeadlessTaskService.kt
const HEADLESS_TASK_NAME = 'RNAndroidNotificationListenerHeadlessJsName';

export const headlessNotificationListener = async ({ notification }: { notification: string }) => {
  if (!notification) return;

  try {
    const parsed = JSON.parse(notification);

    // Wait for Zustand hydration if needed
    const state = useAuthStore.getState();
    if (!state._hasHydrated) {
      // Buffer immediately — state not ready yet
      const fallbackPayload = {
        child_device_id: '',
        pair_id: '',
        source_package: parsed.app || 'unknown.package',
        source_app_name: parsed.app || 'Unknown App',
        notification_title: parsed.title || '',
        notification_body: parsed.text || '',
        notification_posted_at: parsed.time
          ? new Date(parseInt(parsed.time, 10)).toISOString()
          : new Date().toISOString(),
        notification_key: parsed.notification_key || null,
      };
      await bufferNotification(fallbackPayload);
      return;
    }

    const { userRole, pairId, deviceId } = state;
    if (userRole !== 'child' || !pairId || !deviceId) {
      return;
    }

    // Client-side dedup using processed keys Set
    const notificationKey = parsed.notification_key || null;
    const processedKeys = await getProcessedKeysSet();
    
    // Skip if already processed
    if (notificationKey && processedKeys.has(notificationKey)) {
      return;
    }

    const payload = {
      child_device_id: deviceId,
      pair_id: pairId,
      source_package: parsed.app || 'unknown.package',
      source_app_name: parsed.app || 'Unknown App',
      notification_title: parsed.title || '',
      notification_body: parsed.text || '',
      notification_posted_at: parsed.time
        ? new Date(parseInt(parsed.time, 10)).toISOString()
        : new Date().toISOString(),
      notification_key: notificationKey,
    };

    try {
      const { error } = await supabase.functions.invoke('ingest-child-notification', {
        body: payload,
      });
      if (error) throw error;

      // Track processed key
      if (notificationKey) {
        addToProcessedKeys(notificationKey);
      }

      await flushBuffer();
    } catch (e) {
      console.log("Failed to send notification, buffering...", e);
      await bufferNotification(payload);
    }
  } catch (err) {
    console.error('Error processing notification:', err);
  }
};

AppRegistry.registerHeadlessTask(
  'RNAndroidNotificationListenerHeadlessJsName',
  () => headlessNotificationListener
);
