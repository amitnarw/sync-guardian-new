import { AppRegistry } from 'react-native';
import { supabase } from '@/lib/supabase';
import { bufferNotification, flushBuffer, getProcessedKeysSet, addToProcessedKeys, QUEUE_SCHEMA_VERSION } from './mmkv-buffer';
import { logger } from '@/services/logger';
import { useAuthStore } from '@/hooks/use-auth-store';

// Must match NotificationHeadlessTaskService.kt exactly
const HEADLESS_TASK_NAME = 'RNAndroidNotificationListenerHeadlessJs';

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
        source_app_name: parsed.app_label || parsed.app || 'Unknown App',
        notification_title: parsed.title || '',
        notification_body: parsed.text || '',
        notification_posted_at: parsed.time
          ? new Date(parseInt(parsed.time, 10)).toISOString()
          : new Date().toISOString(),
        notification_key: parsed.notification_key || null,
        app_icon_base64: parsed.app_icon_base64 || null,
        _schemaVersion: QUEUE_SCHEMA_VERSION,
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
      source_app_name: parsed.app_label || parsed.app || 'Unknown App',
      notification_title: parsed.title || '',
      notification_body: parsed.text || '',
      notification_posted_at: parsed.time
        ? new Date(parseInt(parsed.time, 10)).toISOString()
        : new Date().toISOString(),
      notification_key: notificationKey,
      app_icon_base64: parsed.app_icon_base64 || null,
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
      let realMsg = e instanceof Error ? e.message : 'unknown';
      try {
        const ctx = (e as any)?.context;
        if (ctx) {
          const body = await ctx.json();
          if (body?.error) realMsg = body.error;
        }
      } catch {}
      logger.warn('Failed to send notification, buffering...', new Error(realMsg));
      await bufferNotification(payload);
    }
  } catch (err) {
    logger.error('Error processing notification:', err);
  }
};

AppRegistry.registerHeadlessTask(
  HEADLESS_TASK_NAME,
  () => headlessNotificationListener
);
