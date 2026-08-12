import { useState, useEffect, useCallback, useRef } from 'react'
import { AppState, Linking, Platform } from 'react-native'
import { logger } from '@/services/logger'
import { useAuthStore } from '@/hooks/use-auth-store'
import { requestFcmPermission } from '@/services/fcm-handler'

interface PermissionItem {
  key: string
  label: string
  granted: boolean
  promptTitle: string
  promptMessage: string
  requestPermission: () => Promise<unknown>
  permanentlyDenied?: boolean
}

let NotificationAccess: any = null
if (Platform.OS === 'android') {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    NotificationAccess = require('notification-access')
  } catch {}
}

export interface PermissionStatusResult {
  items: PermissionItem[]
  notifListenerModalOpen: boolean
  openNotifListenerModal: () => void
  closeNotifListenerModal: () => void
  recentlyGrantedNotifListener: boolean
}

export function usePermissionStatus(role: 'parent' | 'child'): PermissionStatusResult {
  const [notifListenerEnabled, setNotifListenerEnabled] = useState(false)
  const [fcmPermissionGranted, setFcmPermissionGranted] = useState(false)
  const [fcmPermanentlyDenied, setFcmPermanentlyDenied] = useState(false)
  const [batteryOptDisabled, setBatteryOptDisabled] = useState(true)
  const [notifListenerModalOpen, setNotifListenerModalOpen] = useState(false)
  const [recentlyGrantedNotifListener, setRecentlyGrantedNotifListener] = useState(false)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const prevNotifListenerEnabled = useRef(notifListenerEnabled)

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
      const fcmGranted = NotificationAccess.isFcmPermissionGranted()
      setFcmPermissionGranted(fcmGranted)
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

  // Detect the grant transition (false → true) and flash a success banner
  useEffect(() => {
    if (!prevNotifListenerEnabled.current && notifListenerEnabled) {
      setRecentlyGrantedNotifListener(true)
      const timer = setTimeout(() => setRecentlyGrantedNotifListener(false), 2500)
      return () => clearTimeout(timer)
    }
    prevNotifListenerEnabled.current = notifListenerEnabled
  }, [notifListenerEnabled])

  const requestBatteryOptPermission = useCallback((): boolean => {
    if (Platform.OS !== 'android') {
      Linking.openSettings().catch((e) =>
        logger.warn('requestBatteryOptPermission: iOS Linking.openSettings failed', e)
      )
      return false
    }
    // AOSP shows the "Allow Sync Guardian to ignore battery optimizations?"
    // dialog over the app. Some OEMs silently accept this intent without a
    // dialog — in that case the key-aware refresh below falls back to the App
    // Info settings chain so the user can flip the OEM toggle.
    if (NotificationAccess?.requestBatteryOptimizationExemption) {
      try {
        const opened = NotificationAccess.requestBatteryOptimizationExemption()
        if (opened) return true
      } catch (e) {
        logger.warn('requestBatteryOptPermission: native dialog failed', e)
      }
    }
    if (NotificationAccess?.openBatteryOptimizationSettings) {
      try {
        NotificationAccess.openBatteryOptimizationSettings()
        return true
      } catch (e) {
        logger.warn('requestBatteryOptPermission: native settings fallback failed', e)
      }
    }
    return false
  }, [])

  // Key-aware refresh:
  // - battery_opt: poll for up to 2.5s since OEMs may silently accept the
  //   battery dialog; if the status never flips AND we know a dialog was shown,
  //   open the App Info chain so the user can flip the OEM toggle. We don't
  //   fallback when the user explicitly denied (dialogFired=true but they said
  //   no) — they're taken back to the screen and the AppState listener picks up
  //   any further changes.
  // - anything else: a single short refresh; full status is re-read via the
  //   AppState listener when the user returns to the app.
  const refreshSoon = useCallback(
    (key?: string, dialogFired?: boolean) => {
      if (key !== 'battery_opt') {
        setTimeout(refresh, 700)
        return
      }
      let elapsed = 0
      const step = 500
      const max = 2500
      const handle = setInterval(() => {
        elapsed += step
        const granted = !NotificationAccess?.isBatteryOptimizationDisabled()
        refresh()
        if (granted || elapsed >= max) {
          clearInterval(handle)
          if (
            !granted &&
            dialogFired &&
            NotificationAccess?.openBatteryOptimizationSettings
          ) {
            try {
              NotificationAccess.openBatteryOptimizationSettings()
            } catch (e) {
              logger.warn('battery_opt: fallback openBatteryOptimizationSettings failed', e)
            }
          }
        }
      }, step)
    },
    [refresh],
  )

  const items: PermissionItem[] = []

  if (Platform.OS === 'android' && role === 'child') {
    items.push({
      key: 'notif_listener',
      label: 'Notification Listener',
      granted: notifListenerEnabled,
      promptTitle: 'Turn on notification access?',
      promptMessage:
        'Sync Guardian will open Settings. Find "Sync Guardian" in the list (it may already be highlighted), flip the toggle on, then tap your back button to return here.',
      requestPermission: () => {
        setNotifListenerModalOpen(true)
        return Promise.resolve()
      },
    })
  }

  items.push({
    key: 'fcm',
    label: 'Push Notifications',
    granted: fcmPermissionGranted,
    permanentlyDenied: fcmPermanentlyDenied,
    promptTitle: fcmPermanentlyDenied
      ? 'Open notification settings'
      : 'Allow Sync Guardian to send you notifications?',
    promptMessage: fcmPermanentlyDenied
      ? 'Notifications were blocked. Enable them in system settings to receive alerts.'
      : 'Push notifications let your device receive alerts and pings from the parent app.',
    requestPermission: async () => {
      if (fcmPermanentlyDenied) {
        NotificationAccess?.openAppNotificationSettings?.()
        return
      }
      await new Promise<void>((resolve) => setTimeout(resolve, 250))
      const askedBefore = useAuthStore.getState().fcmRequestedOnce
      const result = await requestFcmPermission()
      if (!result.granted) {
        // Native dialogBlocked is authoritative on AOSP + most OEMs. On OEMs
        // where shouldShowRequestPermissionRationale lies, fall back to the
        // AppOps signal combined with a prior request attempt.
        const appOpsBlocked = NotificationAccess?.isFcmNotificationsBlocked?.() ?? false
        if (result.permanentlyDenied || (appOpsBlocked && askedBefore)) {
          setFcmPermanentlyDenied(true)
        }
      }
      refreshSoon('fcm')
    },
  })

  if (Platform.OS === 'android' && role === 'child') {
    items.push({
      key: 'battery_opt',
      label: 'Battery Optimization',
      granted: !batteryOptDisabled,
      promptTitle: 'Allow Sync Guardian to run in the background?',
      promptMessage:
        'Background access keeps Sync Guardian working even when it\'s not open.',
      requestPermission: () => {
        const dialogFired = requestBatteryOptPermission()
        refreshSoon('battery_opt', dialogFired)
        return Promise.resolve()
      },
    })
  }

  return { items, notifListenerModalOpen, openNotifListenerModal: () => setNotifListenerModalOpen(true), closeNotifListenerModal: () => setNotifListenerModalOpen(false), recentlyGrantedNotifListener }
}