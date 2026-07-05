import NotificationAccessModule from "./src/NotificationAccess"

export function isNotificationListenerEnabled(): boolean {
  return NotificationAccessModule.isNotificationListenerEnabled()
}

export function openNotificationListenerSettings(): void {
  return NotificationAccessModule.openNotificationListenerSettings()
}

export function isFcmPermissionGranted(): boolean {
  return NotificationAccessModule.isFcmPermissionGranted()
}

export function openAppNotificationSettings(): void {
  return NotificationAccessModule.openAppNotificationSettings()
}

export function isBatteryOptimizationDisabled(): boolean {
  return NotificationAccessModule.isBatteryOptimizationDisabled()
}

export function openBatteryOptimizationSettings(): void {
  return NotificationAccessModule.openBatteryOptimizationSettings()
}

export function resolveAppInfo(packageName: string): { label: string; icon: string | null } {
  return NotificationAccessModule.resolveAppInfo(packageName)
}

export function resolveAppLabel(packageName: string): string {
  return NotificationAccessModule.resolveAppLabel(packageName)
}

export { NotificationAccessModule }
