import { getApp } from '@react-native-firebase/app';
import { getMessaging, setBackgroundMessageHandler, onMessage, getToken } from '@react-native-firebase/messaging';
import * as Notifications from 'expo-notifications';
import { AppState, Platform } from 'react-native';
import { router } from 'expo-router';
import { logger } from '@/services/logger';
import { useAuthStore } from '@/hooks/use-auth-store';
import { supabase } from '@/lib/supabase';
import { flushBuffer } from '@/services/mmkv-buffer';

const messaging = getMessaging(getApp());

let NotificationAccess: any = null
if (Platform.OS === 'android') {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    NotificationAccess = require('notification-access')
  } catch {}
}

// Required on Android 13+ so the OS surfaces the POST_NOTIFICATIONS runtime
// dialog when the user taps "Yes". Per Expo docs, the dialog will never appear
// until at least one notification channel exists. We memoize the channel-create
// promise so every permission request can await it (channel race previously
// caused the dialog to never show if the user tapped Yes before this resolved).
let channelReady: Promise<void> | null = null
function ensureNotificationChannel(): Promise<void> {
  if (channelReady) return channelReady
  if (Platform.OS !== 'android') {
    channelReady = Promise.resolve()
    return channelReady
  }
  channelReady = Notifications.setNotificationChannelAsync('default', {
    name: 'Sync Guardian alerts',
    importance: Notifications.AndroidImportance.DEFAULT,
  })
    .then(() => undefined)
    .catch((e) => {
      logger.warn('fcm-handler: failed to create notification channel', e)
    })
  return channelReady
}

// Requests push-notification permission (Android 13+ system overlay, iOS APNs
// prompt) via the canonical Expo API, and on grant registers the FCM token with
// the Firebase SDK. Returns whether the user authorized notifications plus an
// Android permanent-denial flag used by the permission UI.
export async function requestFcmPermission(): Promise<{
  granted: boolean
  permanentlyDenied: boolean
}> {
  try {
    await ensureNotificationChannel()
    type PermResult = { status?: 'granted' | 'denied' | 'undetermined'; granted?: boolean }
    const initial = (await Notifications.getPermissionsAsync()) as PermResult
    logger.info('requestFcmPermission: getPermissionsAsync result', { status: initial.status, granted: initial.granted })
    let finalStatus = initial.status
    if (finalStatus !== 'granted') {
      if (Platform.OS === 'android' && NotificationAccess?.requestPostNotificationsPermission) {
        const granted = await NotificationAccess.requestPostNotificationsPermission()
        logger.info('requestFcmPermission: native requestPostNotificationsPermission result', { granted })
        finalStatus = granted ? 'granted' : 'denied'
      } else {
        const result = (await Notifications.requestPermissionsAsync({
          ios: { allowAlert: true, allowBadge: true, allowSound: true },
        })) as PermResult
        logger.info('requestFcmPermission: requestPermissionsAsync result', { status: result.status, granted: result.granted })
        finalStatus = result.status
      }
    }
    const enabled = finalStatus === 'granted'
    if (enabled) {
      const token = await getToken(messaging)
      logger.info('requestFcmPermission: granted, token fetched', { tokenLength: token?.length ?? 0 })
      useAuthStore.getState().setFcmToken(token)
      useAuthStore.getState().setFcmRequestedOnce(true)
      return { granted: true, permanentlyDenied: false }
    }
    useAuthStore.getState().setFcmRequestedOnce(true)
    let permanentlyDenied = false
    try {
      permanentlyDenied = NotificationAccess?.wasFcmPermissionPermanentlyDenied?.() ?? false
      logger.info('requestFcmPermission: native permanentlyDenied check', { permanentlyDenied })
    } catch (e) {
      logger.warn('requestFcmPermission: permanent-denial check failed', e)
    }
    return { granted: false, permanentlyDenied }
  } catch (err) {
    logger.warn('requestFcmPermission: failed', err)
    return { granted: false, permanentlyDenied: false }
  }
}

function handlePairRevoked(revokedBy: unknown) {
  if (revokedBy === 'parent') {
    useAuthStore.getState().clearPair()
    // Only navigate when the app is foregrounded — the usePairStatusGuard
    // redirects on the persisted null pairId when the user returns.
    if (AppState.currentState === 'active') {
      router.replace('/pairing')
    }
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
