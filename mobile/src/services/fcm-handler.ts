import { getApp } from '@react-native-firebase/app';
import { getMessaging, setBackgroundMessageHandler, onMessage } from '@react-native-firebase/messaging';
import { logger } from '@/services/logger';
import { useAuthStore } from '@/hooks/use-auth-store';
import { supabase } from '@/lib/supabase';
import { flushBuffer } from '@/services/mmkv-buffer';

const messaging = getMessaging(getApp());

function handlePairRevoked(revokedBy: unknown) {
  if (revokedBy === 'parent') {
    useAuthStore.getState().clearPair()
    logger.info('Pair revoked by parent - cleared local pair state')
  } else if (revokedBy === 'child') {
    useAuthStore.getState().markPairRevoked()
    logger.info('Child self-disconnected - pair revoke signal sent')
  }
}

async function handleWakeSignal() {
  const { deviceId } = useAuthStore.getState();
  if (deviceId) {
    try {
      await supabase.functions.invoke('sync-device', { body: { device_id: deviceId } });
    } catch (e) {
      logger.warn('ping wake: presence sync failed', e);
    }
  }
  try {
    await flushBuffer();
  } catch (e) {
    logger.warn('ping wake: flush failed', e);
  }
}

setBackgroundMessageHandler(messaging, async (remoteMessage) => {
  const dataType = remoteMessage.data?.type;

  if (dataType === 'wake_child_notification_listener') {
    logger.info('Child wake-up signal received, flushing buffer');
    await handleWakeSignal();
  } else if (dataType === 'pair_revoked') {
    handlePairRevoked(remoteMessage.data?.revoked_by)
  }
});

onMessage(messaging, async (remoteMessage) => {
  const dataType = remoteMessage.data?.type;
  if (dataType === 'wake_child_notification_listener') {
    logger.info('Child wake-up signal received (foreground), flushing buffer');
    await handleWakeSignal();
  } else if (dataType === 'pair_revoked') {
    handlePairRevoked(remoteMessage.data?.revoked_by)
  }
});
