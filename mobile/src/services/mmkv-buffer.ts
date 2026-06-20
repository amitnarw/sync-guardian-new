import { MMKV } from 'react-native-mmkv';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/hooks/use-auth-store';

// @ts-ignore - TS sometimes resolves react-native-mmkv index.d.ts which exports class as type
export const storage = new MMKV();

const PENDING_QUEUE_KEY = 'pending_notifications_queue';

export interface NotificationPayload {
  id: string;
  source_app_name: string;
  source_package: string;
  title: string;
  body: string;
  posted_at: string;
  pair_id: string;
}

export const bufferNotification = (payload: NotificationPayload) => {
  const currentQueueStr = storage.getString(PENDING_QUEUE_KEY);
  const currentQueue: NotificationPayload[] = currentQueueStr ? JSON.parse(currentQueueStr) : [];
  currentQueue.push(payload);
  storage.set(PENDING_QUEUE_KEY, JSON.stringify(currentQueue));
};

export const getBufferedNotifications = (): NotificationPayload[] => {
  const currentQueueStr = storage.getString(PENDING_QUEUE_KEY);
  return currentQueueStr ? JSON.parse(currentQueueStr) : [];
};

export const clearBufferedNotifications = () => {
  storage.delete(PENDING_QUEUE_KEY);
};

export const flushBuffer = async () => {
  const queue = getBufferedNotifications();
  if (queue.length === 0) return;

  try {
    const { error } = await supabase.functions.invoke('ingest-child-notification', {
      body: { notifications: queue },
    });

    if (!error) {
      clearBufferedNotifications();
      console.log('Successfully flushed buffered notifications');
    } else {
      console.error('Failed to flush buffer', error);
    }
  } catch (error) {
    console.error('Failed to flush buffer', error);
  }
};
