import NotificationAccessModule from "./src/NotificationAccess"

export function isNotificationListenerEnabled(): boolean {
  return NotificationAccessModule.isNotificationListenerEnabled()
}

export function openNotificationListenerSettings(): void {
  return NotificationAccessModule.openNotificationListenerSettings()
}

export function openNotificationListenerSettingsForApp(): boolean {
  return NotificationAccessModule.openNotificationListenerSettingsForApp()
}

export function isFcmPermissionGranted(): boolean {
  return NotificationAccessModule.isFcmPermissionGranted()
}

export function wasFcmPermissionPermanentlyDenied(): boolean {
  return NotificationAccessModule.wasFcmPermissionPermanentlyDenied()
}

export function requestPostNotificationsPermission(): Promise<boolean> {
  return NotificationAccessModule.requestPostNotificationsPermission()
}

export function isFcmNotificationsBlocked(): boolean {
  return NotificationAccessModule.isFcmNotificationsBlocked()
}

export function openAppNotificationSettings(): void {
  return NotificationAccessModule.openAppNotificationSettings()
}

export function isBatteryOptimizationDisabled(): boolean {
  return NotificationAccessModule.isBatteryOptimizationDisabled()
}

export function openBatteryOptimizationSettings(): boolean {
  return NotificationAccessModule.openBatteryOptimizationSettings()
}

export function requestBatteryOptimizationExemption(): boolean {
  return NotificationAccessModule.requestBatteryOptimizationExemption()
}

export function resolveAppInfo(packageName: string): { label: string; icon: string | null } {
  return NotificationAccessModule.resolveAppInfo(packageName)
}

export function resolveAppLabel(packageName: string): string {
  return NotificationAccessModule.resolveAppLabel(packageName)
}

export interface InstalledApp {
  packageName: string
  appName: string
  appIconBase64: string | null
}

export function getInstalledApps(): InstalledApp[] {
  return NotificationAccessModule.getInstalledApps() ?? []
}

export { NotificationAccessModule }
