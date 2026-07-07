import { getApp } from '@react-native-firebase/app';
import { getMessaging, setBackgroundMessageHandler, onMessage } from '@react-native-firebase/messaging';
import { logger } from '@/services/logger';

const messaging = getMessaging(getApp());

setBackgroundMessageHandler(messaging, async (remoteMessage) => {
  const dataType = remoteMessage.data?.type;

  if (dataType === 'wake_child_notification_listener') {
    logger.info('Child wake-up signal received, listener ready');
  }
});

onMessage(messaging, async (remoteMessage) => {
  const dataType = remoteMessage.data?.type;
  if (dataType === 'wake_child_notification_listener') {
    logger.info('Child wake-up signal received (foreground), listener active');
  }
});
