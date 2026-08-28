// Re-export shared entitlement so existing imports keep working.
import { getAdminClient } from './supabase-admin.ts'
export { getUserEntitlement, userHasAccess } from './subscription-entitlement.ts'
export type { Entitlement, SubscriptionRow, TrialRow } from './subscription-entitlement.ts'

/**
 * Resolve the paired parent user_id for a given child device id.
 * Returns null if the device isn't a paired child in an active pair.
 */
export async function parentUserIdForChildDevice(
  childDeviceId: string,
): Promise<string | null> {
  if (!childDeviceId) return null

  const adminClient = getAdminClient()
  const { data } = await adminClient
    .from('pairs')
    .select('parent_user_id, status')
    .eq('child_device_id', childDeviceId)
    .eq('status', 'active')
    .maybeSingle()

  return (data?.parent_user_id as string | undefined) ?? null
}
