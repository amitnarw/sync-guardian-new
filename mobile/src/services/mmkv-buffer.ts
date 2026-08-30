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
// v3: switch dedup key to use `child_user_id` (stable across pair revoke/reconnect)
// instead of `pair_id` (transient, regenerates on every new pairing). Adding
// `child_user_id` to the payload resolves the relationship key directly,
// so the edge function never needs to look up the pair by pair_id at ingest.
export const QUEUE_SCHEMA_VERSION = 3;

export interface NotificationPayload {
  child_device_id: string;
  /**
   * Stable user id of the child device owner. Used by the edge function
   * to derive the encryption relationship key. `pair_id` is kept for
   * audit only; if missing at capture time it is filled in from auth
   * state at flush time.
   */
  child_user_id: string;
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

// Dedup uses child_user_id (stable across reconnect cycles) instead of
// pair_id (transient). If two pairs exist for the same child user, the
// combination with notification_key is still unique.
function dedupKey(p: NotificationPayload): string {
  return `${p.child_user_id}|${p.notification_key}`;
}

function getMMKV() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
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
  // 4xx: 429 (rate-limit) and 401/403 (first-run auth/registration race) are retryable.
  if (status >= 400 && status < 500) return status === 429 || status === 401 || status === 403;
  // 5xx are transient; retry.
  if (status >= 500 && status < 600) return true;
  return false;
}

/**
 * Resolve pair_id / child_device_id / child_user_id at flush time.
 *
 * When a child reinstalls the app, the buffered queue may contain rows
 * captured against an OLD `child_device_id` from the previous install.
 * At flush time we always prefer the LIVE values from the auth store
 * over the stale ones captured at write time, so a recovered device
 * id (or any other corrected store value) wins. We only fall back to
 * the item values when the store has not hydrated yet.
 */
function resolveIdsFromStore(item: NotificationPayload): NotificationPayload {
  const state = useAuthStore.getState();
  const pairId = state.pairId || item.pair_id || '';
  const childDeviceId = state.deviceId || item.child_device_id || '';
  const childUserId = state.userId || item.child_user_id || '';
  return {
    ...item,
    pair_id: pairId,
    child_device_id: childDeviceId,
    child_user_id: childUserId,
  };
}

export const flushBuffer = async () => {
  if (isFlushing) return;
  isFlushing = true;
  try {
    const initialQueue = await readQueue();
    if (initialQueue.length === 0) return;

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { supabase } = require('@/lib/supabase');
    const remaining: NotificationPayload[] = [];

    // One-time cleanup: drop stale payloads from a previous queue schema.
    let droppedStale = 0;

    for (let i = 0; i < initialQueue.length; i += BATCH_SIZE) {
      let batch = initialQueue.slice(i, i + BATCH_SIZE).map(resolveIdsFromStore);

      // Filter out items that cannot be sent (old schema or missing ids after resolution).
      const valid: NotificationPayload[] = [];
      for (const n of batch) {
        if ((n as any)._schemaVersion !== undefined && (n as any)._schemaVersion < QUEUE_SCHEMA_VERSION) {
          droppedStale++;
          continue;
        }
        if (!n.pair_id || !n.child_device_id || !n.child_user_id) {
          const st = useAuthStore.getState();
          if (!st.pairId || !st.deviceId || !st.userId) {
            const retry = (n._retryCount ?? 0) + 1;
            if (retry <= 5) remaining.push({ ...n, _retryCount: retry });
            continue;
          }
          logger.warn('flushBuffer: dropping item with missing pair_id/child_device_id/child_user_id', { title: n.notification_title });
          continue;
        }
        valid.push(n);
      }
      batch = valid;

      if (batch.length === 0) continue;

      try {
        await supabase.auth.getSession().catch(() => {});
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
          for (const n of batch) {
            const retry = (n._retryCount ?? 0) + 1;
            if (retry <= 5) remaining.push({ ...n, _retryCount: retry });
          }
          logger.info('Flush batch re-buffered: pair inactive');
        } else if (data && (data as any).reason === 'no_access') {
          // Parent's trial/subscription has lapsed. Terminal drop ,  do not
          // re-buffer. Once renewed, new notifications resume; these ones
          // are intentionally lost (per product decision: stop capture
          // entirely while access is expired).
          logger.info(
            `Flush batch dropped: parent has no active access (${batch.length} item(s))`,
          );
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

    // Merge any items that were appended to the queue while we were flushing.
    // Without this, a notification captured between `await readQueue()` and
    // `await replaceBufferedNotifications(remaining)` would be overwritten by
    // `remaining` (which is a strict subset of the original queue) and lost.
    // We re-read the queue, drop anything we already processed (matched by
    // notification_key), and concatenate the new arrivals with `remaining`.
    const finalQueue = await readQueue();
    const remainingKeys = new Set(
      remaining.map((n) => n.notification_key).filter((k): k is string => !!k),
    );
    const processedKeys = new Set(
      initialQueue
        .filter((n) => !remaining.find((r) => r.notification_key === n.notification_key))
        .map((n) => n.notification_key)
        .filter((k): k is string => !!k),
    );

    const freshlyCaptured: NotificationPayload[] = [];
    for (const item of finalQueue) {
      const key = item.notification_key;
      if (!key) {
        // Items without a notification_key were never counted as "processed";
        // preserve them as freshly-captured so they survive the merge.
        freshlyCaptured.push(item);
        continue;
      }
      if (remainingKeys.has(key)) continue;
      if (processedKeys.has(key)) continue;
      freshlyCaptured.push(item);
    }

    const merged: NotificationPayload[] = [...remaining, ...freshlyCaptured];
    // Cap to MAX_QUEUE_SIZE so a runaway producer cannot blow past the
    // MMKV budget; drop oldest first.
    while (merged.length > MAX_QUEUE_SIZE) {
      merged.shift();
    }

    if (merged.length === 0) {
      await deleteQueue();
      logger.info('Successfully flushed buffered notifications');
    } else {
      await replaceBufferedNotifications(merged);
      logger.info(
        `Flushed partially. remaining=${remaining.length} captured-mid-flush=${freshlyCaptured.length} total=${merged.length}`,
      );
    }
  } finally {
    isFlushing = false;
  }
};
