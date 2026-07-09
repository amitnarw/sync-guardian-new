import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from '@/services/logger';
import { useAuthStore } from '@/hooks/use-auth-store';

const PENDING_QUEUE_KEY = 'pending_notifications_queue';
const PROCESSED_KEYS_KEY = 'processed_notification_keys';
const MAX_QUEUE_SIZE = 500;
const BATCH_SIZE = 50;
const MAX_PROCESSED_KEYS = 500;

// Bump when the buffered payload shape or flush behavior changes.
// Items with an older version are dropped on flush (one-time cleanup of stale data).
export const QUEUE_SCHEMA_VERSION = 2;

export interface NotificationPayload {
  child_device_id: string;
  pair_id: string;
  source_package: string;
  source_app_name: string;
  notification_title: string;
  notification_body: string;
  notification_posted_at: string;
  notification_key: string | null;
  app_icon_base64: string | null;
  _retryCount?: number;
  _schemaVersion?: number;
}

function dedupKey(p: NotificationPayload): string {
  return `${p.child_device_id}|${p.pair_id}|${p.notification_posted_at}|${p.notification_title}`;
}

function getMMKV() {
  try {
    const { MMKV } = require('react-native-mmkv');
    // @ts-ignore
    return new MMKV();
  } catch {
    return null;
  }
}

let _mmkv: ReturnType<typeof getMMKV> | null = null;
function mmkv() {
  if (!_mmkv) _mmkv = getMMKV();
  return _mmkv;
}

export async function getProcessedKeysSet(): Promise<Set<string>> {
  const store = mmkv();
  if (store) {
    const raw = store.getString(PROCESSED_KEYS_KEY);
    if (raw) {
      const keys: string[] = JSON.parse(raw);
      // Prune old keys if too many
      if (keys.length > MAX_PROCESSED_KEYS) {
        store.set(PROCESSED_KEYS_KEY, JSON.stringify(keys.slice(-MAX_PROCESSED_KEYS)));
      }
      return new Set(keys);
    }
  }
  return new Set();
}

export async function addToProcessedKeys(key: string): Promise<void> {
  const store = mmkv();
  if (!store) return;
  let raw = store.getString(PROCESSED_KEYS_KEY);
  let keys: string[] = raw ? JSON.parse(raw) : [];
  keys.push(key);
  // Prune old keys if too many
  if (keys.length > MAX_PROCESSED_KEYS) {
    keys = keys.slice(-MAX_PROCESSED_KEYS);
  }
  store.set(PROCESSED_KEYS_KEY, JSON.stringify(keys));
}

async function readQueue(): Promise<NotificationPayload[]> {
  const store = mmkv();
  if (store) {
    const raw = store.getString(PENDING_QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  }
  const raw = await AsyncStorage.getItem(PENDING_QUEUE_KEY);
  return raw ? JSON.parse(raw) : [];
}

async function writeQueue(queue: NotificationPayload[]) {
  const store = mmkv();
  const data = JSON.stringify(queue);
  if (store) {
    store.set(PENDING_QUEUE_KEY, data);
    return;
  }
  await AsyncStorage.setItem(PENDING_QUEUE_KEY, data);
}

async function deleteQueue() {
  const store = mmkv();
  if (store) {
    store.delete(PENDING_QUEUE_KEY);
    return;
  }
  await AsyncStorage.removeItem(PENDING_QUEUE_KEY);
}

export async function bufferNotification(payload: NotificationPayload) {
  const queue = await readQueue();

  const key = dedupKey(payload);
  if (queue.some((q) => dedupKey(q) === key)) return;

  queue.push({ ...payload, _schemaVersion: QUEUE_SCHEMA_VERSION });

  while (queue.length > MAX_QUEUE_SIZE) {
    queue.shift();
  }

  await writeQueue(queue);
}

export async function getBufferedNotifications(): Promise<NotificationPayload[]> {
  return readQueue();
}

export async function clearBufferedNotifications() {
  await deleteQueue();
}

export async function clearProcessedKeys() {
  const store = mmkv();
  if (store) {
    store.delete(PROCESSED_KEYS_KEY);
    return;
  }
  await AsyncStorage.removeItem(PROCESSED_KEYS_KEY);
}

async function replaceBufferedNotifications(queue: NotificationPayload[]) {
  await writeQueue(queue);
}

let isFlushing = false;

/** Returns true for HTTP statuses that should be retried (transient), false to drop. */
function isRetryableStatus(status: number | undefined): boolean {
  if (status === undefined) return true; // network/unknown error -> retry
  // 4xx (except 429) are permanent client errors; drop them.
  if (status >= 400 && status < 500) return status === 429;
  // 5xx are transient; retry.
  if (status >= 500 && status < 600) return true;
  return false;
}

/** Fill empty pair_id/child_device_id from current auth state at flush time. */
function resolveIdsFromStore(item: NotificationPayload): NotificationPayload {
  const state = useAuthStore.getState();
  const pairId = item.pair_id || state.pairId || '';
  const childDeviceId = item.child_device_id || state.deviceId || '';
  return { ...item, pair_id: pairId, child_device_id: childDeviceId };
}

export const flushBuffer = async () => {
  if (isFlushing) return;
  isFlushing = true;
  try {
    const queue = await readQueue();
    if (queue.length === 0) return;

    const { supabase } = require('@/lib/supabase');
    const remaining: NotificationPayload[] = [];

    // One-time cleanup: drop stale payloads from a previous queue schema.
    let droppedStale = 0;

    for (let i = 0; i < queue.length; i += BATCH_SIZE) {
      let batch = queue.slice(i, i + BATCH_SIZE).map(resolveIdsFromStore);

      // Filter out items that cannot be sent (old schema or missing ids after resolution).
      const valid: NotificationPayload[] = [];
      for (const n of batch) {
        if ((n as any)._schemaVersion !== undefined && (n as any)._schemaVersion < QUEUE_SCHEMA_VERSION) {
          droppedStale++;
          continue;
        }
        if (!n.pair_id || !n.child_device_id) {
          logger.warn('flushBuffer: dropping item with missing pair_id/child_device_id', { title: n.notification_title });
          continue;
        }
        valid.push(n);
      }
      batch = valid;

      if (batch.length === 0) continue;

      try {
        const { error, data } = await supabase.functions.invoke('ingest-child-notification', {
          body: { notifications: batch },
        });
        if (error) {
          let realMsg = error.message;
          let status: number | undefined;
          try {
            const ctx = (error as any)?.context;
            if (ctx?.status) status = ctx.status;
            const body = ctx && (await ctx.json?.());
            if (body?.error) realMsg = body.error;
          } catch {}
          logger.error('Flush batch failed', new Error(`status=${status ?? 'n/a'} ${realMsg}`));
          if (isRetryableStatus(status)) {
            for (const n of batch) {
              const retry = (n._retryCount ?? 0) + 1;
              if (retry <= 5) {
                remaining.push({ ...n, _retryCount: retry });
              }
            }
          }
        } else if (data && (data as any).reason === 'pair_inactive') {
          logger.info('Flush batch dropped: pair inactive');
        } else {
          // Track sent notification keys
          for (const n of batch) {
            if (n.notification_key) {
              addToProcessedKeys(n.notification_key);
            }
          }
        }
      } catch (err) {
        // Network/unknown error -> retry
        for (const n of batch) {
          const retry = (n._retryCount ?? 0) + 1;
          if (retry <= 5) {
            remaining.push({ ...n, _retryCount: retry });
          }
        }
        logger.error('Flush batch error, re-buffered', err);
      }
    }

    if (droppedStale > 0) {
      logger.info(`flushBuffer: dropped ${droppedStale} stale buffered item(s).`);
    }

    if (remaining.length === 0) {
      await deleteQueue();
      logger.info('Successfully flushed buffered notifications');
    } else {
      await replaceBufferedNotifications(remaining);
      logger.info(`Flushed partially. ${remaining.length} items re-buffered for retry.`);
    }
  } finally {
    isFlushing = false;
  }
};
