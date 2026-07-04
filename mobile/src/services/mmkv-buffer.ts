import AsyncStorage from '@react-native-async-storage/async-storage';

const PENDING_QUEUE_KEY = 'pending_notifications_queue';
const MAX_QUEUE_SIZE = 500;
const BATCH_SIZE = 50;

export interface NotificationPayload {
  child_device_id: string;
  pair_id: string;
  source_package: string;
  source_app_name: string;
  notification_title: string;
  notification_body: string;
  notification_posted_at: string;
  _retryCount?: number;
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

  queue.push(payload);

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

async function replaceBufferedNotifications(queue: NotificationPayload[]) {
  await writeQueue(queue);
}

export const flushBuffer = async () => {
  const queue = await readQueue();
  if (queue.length === 0) return;

  const { supabase } = require('@/lib/supabase');
  const remaining: NotificationPayload[] = [];

  for (let i = 0; i < queue.length; i += BATCH_SIZE) {
    const batch = queue.slice(i, i + BATCH_SIZE);
    try {
      const { error } = await supabase.functions.invoke('ingest-child-notification', {
        body: { notifications: batch },
      });
      if (error) {
        for (const n of batch) {
          const retry = (n._retryCount ?? 0) + 1;
          if (retry <= 5) {
            remaining.push({ ...n, _retryCount: retry });
          }
        }
        console.error('Flush batch failed, re-buffered', error);
      }
    } catch (err) {
      for (const n of batch) {
        const retry = (n._retryCount ?? 0) + 1;
        if (retry <= 5) {
          remaining.push({ ...n, _retryCount: retry });
        }
      }
      console.error('Flush batch error, re-buffered', err);
    }
  }

  if (remaining.length === 0) {
    await deleteQueue();
    console.log('Successfully flushed buffered notifications');
  } else {
    await replaceBufferedNotifications(remaining);
    console.log(`Flushed partially. ${remaining.length} items re-buffered for retry.`);
  }
};
