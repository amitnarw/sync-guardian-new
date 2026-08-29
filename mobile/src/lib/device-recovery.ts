import { supabase } from '@/lib/supabase';
import { isValidUUID } from '@/lib/uuid';
import { logger } from '@/services/logger';

// Mask a UUID before logging. Keeps the first/last 4 chars so the
// value is still recognizable across log lines, but avoids leaking
// the real identifier (AGENTS.md: "Never expose real UUIDs or
// tokens in log output"). Logger's `sanitize` only masks string args;
// object payloads are passed through, so we mask UUIDs at the call
// site instead.
function mask(id: string | null | undefined): string {
  if (!id) return '(none)';
  if (id.length <= 12) return id;
  return `${id.slice(0, 4)}…${id.slice(-4)}`;
}

/**
 * Resolve the correct parent device id for the signed-in user.
 *
 * Each parent app install generates a fresh `deviceId` that is persisted in
 * the auth storage. That id is written into `pairs.parent_device_id` when
 * the parent pairs a child. If the parent reinstalls the app, clears app
 * data, or installs the latest APK in a way that resets the persisted
 * `deviceId`, the in-memory `deviceId` will no longer match any active
 * pair — even though the parent still has an active pair in the database
 * under a previous device record.
 *
 * `loadAllChildren()` and `get-notifications` both filter by
 * `parent_device_id`, so a stale `deviceId` makes the app look like the
 * parent has no children at all (Insights / Activity show the empty state
 * and notifications disappear).
 *
 * Recovery: if the current `deviceId` does not match any active/pending
 * pair for this user, find the parent device row that IS referenced by an
 * active pair and return its id. The caller updates the auth store with
 * the recovered id and the rest of the app picks it up automatically
 * because the auth store is the single source of truth.
 */
export async function resolveParentDeviceId(
  userId: string,
  currentDeviceId: string | null,
): Promise<string | null> {
  if (!isValidUUID(userId)) return null;

  // Fast path: current deviceId is already valid and points at an active
  // pair — no recovery needed.
  if (isValidUUID(currentDeviceId)) {
    const { data: matches, error: matchErr } = await supabase
      .from('pairs')
      .select('id')
      .eq('parent_user_id', userId)
      .eq('parent_device_id', currentDeviceId)
      .in('status', ['active', 'pending'])
      .limit(1);

    if (!matchErr && matches && matches.length > 0) {
      return currentDeviceId;
    }
  }

  // Recovery path: find any parent device for this user that is referenced
  // by an active/pending pair. Pick the device referenced by the most
  // recently paired active pair so a parent with multiple devices lands
  // back on the one currently paired to a child.
  const { data: devices, error: devicesErr } = await supabase
    .from('devices')
    .select('id')
    .eq('user_id', userId)
    .eq('role', 'parent')
    .limit(20);

  if (devicesErr || !devices || devices.length === 0) {
    logger.warn(`device-recovery: no parent devices found for ${mask(userId)}`);
    return null;
  }

  const candidateIds = devices.map((d) => d.id as string).filter(isValidUUID);
  if (candidateIds.length === 0) return null;

  const { data: pairs, error: pairsErr } = await supabase
    .from('pairs')
    .select('parent_device_id, paired_at')
    .eq('parent_user_id', userId)
    .in('parent_device_id', candidateIds)
    .in('status', ['active', 'pending'])
    .order('paired_at', { ascending: false })
    .limit(1);

  if (pairsErr || !pairs || pairs.length === 0) {
    logger.info(`device-recovery: no active pairs for user ${mask(userId)}`);
    return null;
  }

  const recovered = pairs[0].parent_device_id as string;
  logger.info(
    `device-recovery: recovered parent deviceId user=${mask(userId)} from=${mask(currentDeviceId)} to=${mask(recovered)}`,
  );
  return recovered;
}

/**
 * Resolve the correct child device id for the signed-in user.
 *
 * Mirrors `resolveParentDeviceId` for child installs. Without this, a
 * child who reinstalls the app keeps a stale `deviceId` that no longer
 * matches any `pairs.child_device_id`, so `ingest-child-notification`
 * rejects their notifications with "Not authorized to post notifications
 * for this device" (HTTP 403) and `sync-device` cannot update presence.
 *
 * Recovery: if the persisted deviceId is not referenced by any active
 * pair for this user, find the child device row that IS referenced and
 * return its id. Returns null when no active pair exists yet — the caller
 * treats that as "needs pairing" and lets the regular onboarding flow
 * generate a fresh device id.
 */
export async function resolveChildDeviceId(
  userId: string,
  currentDeviceId: string | null,
): Promise<string | null> {
  if (!isValidUUID(userId)) return null;

  if (isValidUUID(currentDeviceId)) {
    const { data: matches, error: matchErr } = await supabase
      .from('pairs')
      .select('id')
      .eq('child_user_id', userId)
      .eq('child_device_id', currentDeviceId)
      .in('status', ['active', 'pending'])
      .limit(1);

    if (!matchErr && matches && matches.length > 0) {
      return currentDeviceId;
    }
  }

  const { data: devices, error: devicesErr } = await supabase
    .from('devices')
    .select('id')
    .eq('user_id', userId)
    .eq('role', 'child')
    .limit(20);

  if (devicesErr || !devices || devices.length === 0) {
    logger.info(`device-recovery: no child devices found for ${mask(userId)}`);
    return null;
  }

  const candidateIds = devices.map((d) => d.id as string).filter(isValidUUID);
  if (candidateIds.length === 0) return null;

  const { data: pairs, error: pairsErr } = await supabase
    .from('pairs')
    .select('child_device_id, paired_at')
    .eq('child_user_id', userId)
    .in('child_device_id', candidateIds)
    .in('status', ['active', 'pending'])
    .order('paired_at', { ascending: false })
    .limit(1);

  if (pairsErr || !pairs || pairs.length === 0) {
    logger.info(`device-recovery: no active child pair for user ${mask(userId)}`);
    return null;
  }

  const recovered = pairs[0].child_device_id as string;
  logger.info(
    `device-recovery: recovered child deviceId user=${mask(userId)} from=${mask(currentDeviceId)} to=${mask(recovered)}`,
  );
  return recovered;
}
