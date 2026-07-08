import { getApp } from '@react-native-firebase/app';
import { getMessaging, setBackgroundMessageHandler, onMessage } from '@react-native-firebase/messaging';
import { logger } from '@/services/logger';
import { useAuthStore } from '@/hooks/use-auth-store';

const messaging = getMessaging(getApp());

function handlePairRevoked(revokedBy: unknown) {
  if (revokedBy === 'parent') {
    // Child device received notification that parent revoked the pair
    useAuthStore.getState().clearPair()
    logger.info('Pair revoked by parent — cleared local pair state')
  }
  // If revoked_by === 'child', it's the parent receiving — nothing to clear
}

setBackgroundMessageHandler(messaging, async (remoteMessage) => {
  const dataType = remoteMessage.data?.type;

  if (dataType === 'wake_child_notification_listener') {
    logger.info('Child wake-up signal received, listener ready');
  } else if (dataType === 'pair_revoked') {
    handlePairRevoked(remoteMessage.data?.revoked_by)
  }
});

onMessage(messaging, async (remoteMessage) => {
  const dataType = remoteMessage.data?.type;
  if (dataType === 'wake_child_notification_listener') {
    logger.info('Child wake-up signal received (foreground), listener active');
  } else if (dataType === 'pair_revoked') {
    handlePairRevoked(remoteMessage.data?.revoked_by)
  }
});
