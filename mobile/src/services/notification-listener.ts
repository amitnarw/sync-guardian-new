import { AppRegistry, AppState, Platform } from 'react-native';
import { supabase } from '@/lib/supabase';
import { bufferNotification, flushBuffer, getProcessedKeysSet, addToProcessedKeys, QUEUE_SCHEMA_VERSION } from './mmkv-buffer';
import { logger } from '@/services/logger';
import { useAuthStore } from '@/hooks/use-auth-store';

// Must match NotificationHeadlessTaskService.kt exactly
const HEADLESS_TASK_NAME = 'RNAndroidNotificationListenerHeadlessJs';

async function processNotification(json: string): Promise<void> {
  if (!json) return;

  try {
    const parsed = JSON.parse(json);

    // Record capture immediatement (before any gates) for observability
    const capturePkg = parsed.app_label || parsed.app || 'unknown';
    useAuthStore.setState({ lastCaptureAt: Date.now(), lastCapturePackage: capturePkg });

    // Wait for Zustand hydration if needed
    const state = useAuthStore.getState();
    if (!state._hasHydrated) {
      const fallbackPayload = {
        child_device_id: '',
        pair_id: '',
        source_package: parsed.app || 'unknown.package',
        source_app_name: capturePkg,
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
      source_app_name: capturePkg,
      notification_title: parsed.title || '',
      notification_body: parsed.text || '',
      notification_posted_at: parsed.time
        ? new Date(parseInt(parsed.time, 10)).toISOString()
        : new Date().toISOString(),
      notification_key: notificationKey,
      app_icon_base64: parsed.app_icon_base64 || null,
    };

    try {
      const { data, error } = await supabase.functions.invoke('ingest-child-notification', {
        body: payload,
      });
      if (error) throw error;

      if (data) {
        const d = data as { count?: number; dropped?: number; reason?: string };
        if (d.dropped && d.dropped > 0) {
          useAuthStore.getState().setIngestDropped(d.reason ?? 'app_filtered');
          return;
        }
        if (d.count && d.count > 0) {
          useAuthStore.getState().setIngestSuccess();
        }
      }

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
      useAuthStore.getState().setIngestError(realMsg);
      await bufferNotification(payload);
    }
  } catch (err) {
    logger.error('Error processing notification:', err);
  }
}

export const headlessNotificationListener = async ({ notification }: { notification: string }): Promise<void> => {
  await processNotification(notification);
};

AppRegistry.registerHeadlessTask(
  HEADLESS_TASK_NAME,
  () => headlessNotificationListener
);

// Flush buffered notifications whenever the app comes to the foreground.
// This handles the killed-app scenario: items buffered with empty IDs
// get their IDs resolved from the hydrated store and sent.
let resumeFlushRegistered = false;
if (!resumeFlushRegistered) {
  resumeFlushRegistered = true;
  AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      flushBuffer();
    }
  });
}

// Subscribe to foreground notification events (Android only)
if (Platform.OS === 'android') {
  try {
    const { EventEmitter } = require('expo');
    const { NotificationAccessModule } = require('notification-access');
    const emitter = new EventEmitter(NotificationAccessModule);
    emitter.addListener('onNotificationReceived', (event: { notification: string }) => {
      processNotification(event.notification);
    });
  } catch {
    // notification-access module not available on this platform
  }
}
