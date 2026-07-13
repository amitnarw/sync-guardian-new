import { useState, useEffect, useCallback } from 'react'
import { AppState, Linking, Platform } from 'react-native'
import { logger } from '@/services/logger'

interface PermissionItem {
  key: string
  label: string
  granted: boolean
  guideTitle: string
  guideMessage: string
  guideSteps: string[]
  openSettings: () => void
}

let NotificationAccess: any = null
if (Platform.OS === 'android') {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    NotificationAccess = require('notification-access')
  } catch {}
}

export function usePermissionStatus(role: 'parent' | 'child') {
  const [notifListenerEnabled, setNotifListenerEnabled] = useState(false)
  const [fcmPermissionGranted, setFcmPermissionGranted] = useState(false)
  const [batteryOptDisabled, setBatteryOptDisabled] = useState(true)

  const refresh = useCallback(() => {
    if (!NotificationAccess) {
      if (Platform.OS === 'android') {
        logger.warn('usePermissionStatus: NotificationAccess native module not loaded')
      }
      return
    }
    try {
      if (role === 'child') {
        setNotifListenerEnabled(NotificationAccess.isNotificationListenerEnabled())
      }
      setFcmPermissionGranted(NotificationAccess.isFcmPermissionGranted())
      setBatteryOptDisabled(NotificationAccess.isBatteryOptimizationDisabled())
    } catch (e) {
      logger.warn('usePermissionStatus: error reading permission status', e)
    }
  }, [role])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh()
    })
    return () => sub.remove()
  }, [refresh])

  const openNotifListenerSettings = useCallback(() => {
    if (!NotificationAccess) return
    NotificationAccess.openNotificationListenerSettings()
  }, [])

  const openAppNotifSettings = useCallback(() => {
    if (!NotificationAccess) return
    NotificationAccess.openAppNotificationSettings()
  }, [])

  const openBatteryOptSettings = useCallback(() => {
    Linking.openSettings().catch((e) =>
      logger.warn('openBatteryOptSettings: Linking.openSettings failed', e)
    )
  }, [])

  const items: PermissionItem[] = []

  if (role === 'child') {
    items.push({
      key: 'notif_listener',
      label: 'Notification Listener',
      granted: notifListenerEnabled,
      guideTitle: 'Allow Notification Access',
      guideMessage: 'Sync Guardian needs permission to read notifications so it can alert your parent when you receive messages.',
      guideSteps: [
        'Find "Sync Guardian" in the list below',
        'Tap the toggle switch next to it to turn it on',
        'Tap "Allow" on the confirmation pop-up that appears',
      ],
      openSettings: openNotifListenerSettings,
    })
  }

  items.push({
      key: 'fcm',
      label: 'Push Notifications',
      granted: fcmPermissionGranted,
    guideTitle: 'Allow Push Notifications',
    guideMessage: 'Push notifications let your device receive alerts and pings from the parent app.',
    guideSteps: [
      'Tap "Notifications" on this screen',
      'Turn on the "Show notifications" toggle at the top',
      'Make sure "Allow notification dot" is also on',
    ],
    openSettings: openAppNotifSettings,
  })

  if (role === 'child') {
    items.push({
      key: 'battery_opt',
      label: 'Battery Optimization',
      granted: !batteryOptDisabled,
      guideTitle: 'Turn Off Battery Optimization',
      guideMessage: 'Battery optimization may prevent Sync Guardian from running in the background. Open App Info and set Battery to "Unrestricted" or "Don\'t optimize".',
      guideSteps: [
        'Tap "Battery" on the App Info screen',
        'Tap "Unrestricted" or select "Don\'t optimize"',
        'Tap "Done" or "Apply" to confirm',
      ],
      openSettings: openBatteryOptSettings,
    })
  }

  return items
}
