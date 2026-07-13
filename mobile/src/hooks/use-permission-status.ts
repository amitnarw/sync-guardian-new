import { useState, useEffect, useCallback, useRef } from 'react'
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
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stopPolling = useCallback(() => {
    if (pollingRef.current !== null) {
      clearInterval(pollingRef.current)
      pollingRef.current = null
    }
  }, [])

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
    let pollCount = 0
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return
      refresh()
      // Poll for 5 seconds after returning from settings to catch delayed system updates
      stopPolling()
      pollCount = 0
      pollingRef.current = setInterval(() => {
        pollCount++
        refresh()
        if (pollCount >= 5) stopPolling()
      }, 1000)
    })
    return () => {
      sub.remove()
      stopPolling()
    }
  }, [refresh, stopPolling])

  const openNotifListenerSettings = useCallback(() => {
    if (!NotificationAccess) return
    NotificationAccess.openNotificationListenerSettings()
  }, [])

  const openAppNotifSettings = useCallback(() => {
    if (!NotificationAccess) return
    NotificationAccess.openAppNotificationSettings()
  }, [])

  const openBatteryOptSettings = useCallback(() => {
    if (Platform.OS !== 'android') {
      Linking.openSettings().catch((e) =>
        logger.warn('openBatteryOptSettings: iOS Linking.openSettings failed', e)
      )
      return
    }

    // Native module opens the best available battery settings screen with fallback chain
    if (NotificationAccess?.openBatteryOptimizationSettings) {
      try {
        const opened = NotificationAccess.openBatteryOptimizationSettings()
        if (opened) return
      } catch (e) {
        logger.warn('openBatteryOptSettings: native open failed', e)
      }
    }

    // Last resort: open the app's system settings screen
    Linking.openSettings().catch((e) =>
      logger.warn('openBatteryOptSettings: app settings fallback failed', e)
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
      guideTitle: 'Allow Background Running',
      guideMessage: 'Sync Guardian must be allowed to run in the background. Tap Fix, then in the App Info screen tap "Battery" (or "Battery usage"), then choose "Unrestricted". On some phones the setting may show as "Don\'t optimize".',
      guideSteps: [
        'Tap "Battery" or "Battery usage" on the App Info page that opens',
        'Select "Unrestricted" or "Don\'t optimize" for Sync Guardian',
        'Return here and the status will refresh automatically',
      ],
      openSettings: openBatteryOptSettings,
    })
  }

  return items
}
