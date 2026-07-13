import { AppRegistry, AppState, Platform } from 'react-native';
import { supabase } from '@/lib/supabase';
import { bufferNotification, flushBuffer, getProcessedKeysSet, addToProcessedKeys, NotificationPayload, QUEUE_SCHEMA_VERSION } from './mmkv-buffer';
import { logger } from '@/services/logger';
import { useAuthStore } from '@/hooks/use-auth-store';

// Must match NotificationHeadlessTaskService.kt exactly
const HEADLESS_TASK_NAME = 'RNAndroidNotificationListenerHeadlessJs';

// Expand a parsed notification into 0..N message lines to mirror.
// Group-summary notifications are expanded by individual line (via text_lines);
// group children are skipped (the summary notification covers them).
function extractLines(parsed: Record<string, any>): { title: string; body: string }[] {
  const title = parsed.title || '';
  const group = parsed.group;
  const isGroupSummary = parsed.is_group_summary === true;

  if (group && !isGroupSummary) {
    return [];
  }

  const textLines: string[] | undefined = parsed.text_lines;
  if (Array.isArray(textLines) && textLines.length > 0) {
    return textLines.map((line: string) => ({ title, body: line || '' }));
  }

  return [{ title, body: parsed.big_text || parsed.text || '' }];
}

// Derive a stable per-message-line key so each distinct message creates its own DB row
// and re-posted summaries with identical lines are naturally deduplicated.
function deriveLineKey(
  sbnKey: string,
  sbnTime: string,
  index: number,
  body: string,
): string {
  const slice = (body || '').slice(0, 140);
  return `${sbnKey}::${sbnTime}::${index}::${slice}`;
}

async function processNotification(json: string): Promise<void> {
  if (!json) return;

  try {
    const parsed = JSON.parse(json);

    const capturePkg = parsed.app_label || parsed.app || 'unknown';
    useAuthStore.setState({ lastCaptureAt: Date.now(), lastCapturePackage: capturePkg });

    // Expand into per-message lines before any gates so buffering preserves them
    const lines = extractLines(parsed);
    if (lines.length === 0) return;

    const sbnKey = parsed.notification_key || '';
    const sbnTime = parsed.time || '';
    const rows: NotificationPayload[] = lines.map((line, i) => {
      const postedAt = sbnTime
        ? new Date(parseInt(sbnTime, 10)).toISOString()
        : new Date().toISOString();
      return {
        child_device_id: '',
        pair_id: '',
        source_package: parsed.app || 'unknown.package',
        source_app_name: capturePkg,
        notification_title: line.title,
        notification_body: line.body,
        notification_posted_at: postedAt,
        notification_key: deriveLineKey(sbnKey, sbnTime, i, line.body),
        app_icon_base64: parsed.app_icon_base64 || null,
      };
    });

    // --- gates ---
    const state = useAuthStore.getState();
    if (!state._hasHydrated) {
      for (const row of rows) {
        await bufferNotification({ ...row, _schemaVersion: QUEUE_SCHEMA_VERSION });
      }
      return;
    }

    const { userRole, pairId, deviceId } = state;
    if (userRole !== 'child') return;

    if (!pairId || !deviceId) {
      for (const row of rows) {
        await bufferNotification({ ...row, _schemaVersion: QUEUE_SCHEMA_VERSION });
      }
      return;
    }

    // Dedup by per-line key
    const processedKeys = await getProcessedKeysSet();
    const toSend: NotificationPayload[] = [];
    for (const row of rows) {
      if (row.notification_key && processedKeys.has(row.notification_key)) {
        continue;
      }
      toSend.push({ ...row, child_device_id: deviceId, pair_id: pairId });
    }
    if (toSend.length === 0) return;

    // Batch-ingest all non-deduped lines
    try {
      await supabase.auth.getSession().catch(() => {});
      const { data, error } = await supabase.functions.invoke('ingest-child-notification', {
        body: { notifications: toSend },
      });
      if (error) throw error;

      if (data) {
        const d = data as { count?: number; dropped?: number; reason?: string };
        if (d.dropped && d.dropped > 0 && !d.count) {
          useAuthStore.getState().setIngestDropped(d.reason ?? 'app_filtered');
          return;
        }
        if (d.count && d.count > 0) {
          useAuthStore.getState().setIngestSuccess();
        }
      }

      for (const sent of toSend) {
        if (sent.notification_key) {
          addToProcessedKeys(sent.notification_key);
        }
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
      for (const n of toSend) {
        await bufferNotification(n);
      }
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
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { EventEmitter } = require('expo');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { NotificationAccessModule } = require('notification-access');
    const emitter = new EventEmitter(NotificationAccessModule);
    emitter.addListener('onNotificationReceived', (event: { notification: string }) => {
      processNotification(event.notification);
    });
  } catch {
    // notification-access module not available on this platform
  }
}

// Auto-flush when the child store becomes fully registered (hydration + IDs).
let prevReady = false;
useAuthStore.subscribe((s) => {
  const ready = s._hasHydrated && s.userRole === 'child' && !!s.pairId && !!s.deviceId;
  if (ready && !prevReady) flushBuffer().catch(() => {});
  prevReady = ready;
});
