import { AppRegistry, AppState, Platform } from 'react-native';
import { digestStringAsync, CryptoDigestAlgorithm, CryptoEncoding } from 'expo-crypto';
import { supabase } from '@/lib/supabase';
import { bufferNotification, flushBuffer, getProcessedKeysSet, addToProcessedKeys, clearProcessedKeys, NotificationPayload, QUEUE_SCHEMA_VERSION } from './mmkv-buffer';
import { logger } from '@/services/logger';
import { useAuthStore } from '@/hooks/use-auth-store';
import { useSubscriptionStore } from '@/hooks/use-subscription-store';

// Must match NotificationHeadlessTaskService.kt exactly
const HEADLESS_TASK_NAME = 'RNAndroidNotificationListenerHeadlessJs';

// Expand a parsed notification into 0..N message lines to mirror.
// Group-summary notifications are expanded per line (via text_lines).
// Group children still carry individual message content ,  don't skip them,
// because many apps (Gmail, WhatsApp) only re-post the summary for the first
// notification; subsequent arrivals only trigger child notifications.
// The content-hash dedup key naturally collapses true duplicates that
// arrive through the summary path AND the child path for the same message.
function extractLines(parsed: Record<string, any>): { title: string; body: string }[] {
  const title = parsed.title || '';
  const group = parsed.group;
  const isGroupSummary = parsed.is_group_summary === true;

  if (group && !isGroupSummary) {
    const body = parsed.big_text || parsed.text || '';
    if (body) {
      return [{ title, body }];
    }
    return [];
  }

  const textLines: string[] | undefined = parsed.text_lines;
  if (Array.isArray(textLines) && textLines.length > 0) {
    return textLines.map((line: string) => ({ title, body: line || '' }));
  }

  return [{ title, body: parsed.big_text || parsed.text || '' }];
}

// SHA-256 hex digest of a string. Used as the notification_key so the same
// message content always maps to the same notification_key, regardless of
// whether the Android notification arrives as a group-summary line or as an
// individual child notification. Edge function re-derives this exact hash
// server-side, so the client value is only an opportunistic hint.
//
// Implemented via expo-crypto because React Native's JS runtime does not
// expose the W3C `crypto.subtle` global (which we tried and broke the
// capture path with `ReferenceError: Property 'crypto' doesn't exist`).
async function sha256Hex(input: string): Promise<string> {
  return await digestStringAsync(
    CryptoDigestAlgorithm.SHA256,
    input,
    { encoding: CryptoEncoding.HEX },
  );
}

// Derive a stable per-message-line key from the message content (package,
// post time, title, body). This is the canonical notification_key and is
// what the edge function independently re-computes to detect duplicates.
//
// Why content-based and not the Android notification instance key:
//   Apps like WhatsApp / Gmail / Telegram emit the same message in two
//   different Android notifications ,  a group summary whose text_lines
//   contain the message, and an individual child notification for the same
//   message. Each has a different `StatusBarNotification.key` and the
//   `parsed.time` fields can differ by 1-15ms. Instance-based dedup keys
//   let both through, producing two rows for one message. Content-based
//   keys (with second-precision time) collapse both into a single row.
//
// Trade-off: two legitimate messages with identical (package, second, title,
// body) collapse to one. Acceptable because chat apps coalesce messages
// within the same conversation bubble, and the millisecond drift between
// the summary and child notifications for a single chat arrival is exactly
// what we want to collapse.
async function deriveLineKey(
  sourcePackage: string,
  postedAtIso: string,
  title: string,
  body: string,
): Promise<string> {
  const secondBucket = bucketToSecond(postedAtIso);
  const canonical = `${sourcePackage}|${secondBucket}|${title}|${body}`;
  const hex = await sha256Hex(canonical);
  return `auto_${hex.slice(0, 32)}`;
}

// Truncate an ISO timestamp to second precision. WhatsApp's group-summary
// and child notifications arrive milliseconds apart but represent the same
// chat message. We keep millisecond precision in `notification_posted_at`
// for accurate ordering, but use the second bucket for the dedup key.
function bucketToSecond(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toISOString().slice(0, 19); // YYYY-MM-DDTHH:mm:ss
}

// Module-level in-flight dedup window. When the same notification_key is
// already being processed in this JS context (e.g., headless task fires and
// the foreground emitter fires for the same payload within milliseconds),
// the second copy is dropped before it can race with the first batch.
const inFlightKeys = new Set<string>();
function markInFlight(key: string): boolean {
  if (inFlightKeys.has(key)) return false;
  inFlightKeys.add(key);
  return true;
}
function clearInFlight(key: string): void {
  inFlightKeys.delete(key);
}

async function processNotification(json: string): Promise<void> {
  if (!json) return;

  try {
    const parsed = JSON.parse(json);

    const capturePkg = parsed.app_label || parsed.app || 'unknown';
    useAuthStore.setState({ lastCaptureAt: Date.now(), lastCapturePackage: capturePkg });

    // Expand into per-message lines before any gates so buffering preserves them.
    const lines = extractLines(parsed);
    if (lines.length === 0) return;

    const sbnTime = parsed.time || '';
    const sourcePackage = parsed.app || 'unknown.package';

    // Build the per-line rows. notification_key is the content hash so the
    // same message arriving as a summary line AND a child notification maps
    // to the same row.
    const rows: NotificationPayload[] = await Promise.all(
      lines.map(async (line) => {
        const postedAt = sbnTime
          ? new Date(parseInt(sbnTime, 10)).toISOString()
          : new Date().toISOString();
        return {
          child_device_id: '',
          // child_user_id is the signed-in user id (the child device owner),
          // stable across pair revoke/reconnect cycles. Filled at capture
          // time if hydration is complete, otherwise resolved at flush time.
          child_user_id: '',
          pair_id: '',
          source_package: sourcePackage,
          source_app_name: capturePkg,
          notification_title: line.title,
          notification_body: line.body,
          notification_posted_at: postedAt,
          notification_key: await deriveLineKey(sourcePackage, postedAt, line.title, line.body),
          app_icon_base64: parsed.app_icon_base64 || null,
        };
      }),
    );

    // Drop keys that are already in-flight in this JS context (headless +
    // foreground emitter races). Without this, two parallel calls would
    // both reach the network and produce two rows.
    const deduped: NotificationPayload[] = [];
    const seenInBatch = new Set<string>();
    for (const row of rows) {
      if (!row.notification_key) {
        deduped.push(row);
        continue;
      }
      if (seenInBatch.has(row.notification_key)) continue;
      if (!markInFlight(row.notification_key)) continue;
      seenInBatch.add(row.notification_key);
      deduped.push(row);
    }
    if (deduped.length === 0) return;

    // --- gates ---
    const state = useAuthStore.getState();
    if (!state._hasHydrated) {
      for (const row of deduped) {
        await bufferNotification({ ...row, _schemaVersion: QUEUE_SCHEMA_VERSION });
        // Buffered rows wait for hydration; the in-flight dedup is per
        // process, so release the slot to allow the same content to be
        // re-captured if the buffer is later cleared or replayed.
        clearInFlight(row.notification_key ?? '');
      }
      return;
    }

    const { userRole, pairId, deviceId, userId } = state;
    if (userRole !== 'child') {
      for (const row of deduped) clearInFlight(row.notification_key ?? '');
      return;
    }

    // Gate: if the subscription state is unknown (still hydrating) we
    // BUFFER the notification so it can be replayed once the state
    // resolves. This prevents a data-loss window between auth hydration
    // and subscription hydration. If access is definitively false
    // (trial expired / subscription cancelled) we drop ,  the server
    // makes the same call authoritatively and a buffered row would
    // just be rejected later anyway.
    //
    // Kick a one-shot subscription refresh on the first notification we
    // see while the state is still undefined so the gate resolves
    // quickly without waiting for the next foreground event.
    let hasAccess = useSubscriptionStore.getState().hasAccess;
    if (hasAccess === undefined) {
      useSubscriptionStore.getState().refresh().catch(() => {});
      for (const row of deduped) {
        await bufferNotification({ ...row, _schemaVersion: QUEUE_SCHEMA_VERSION });
        clearInFlight(row.notification_key ?? '');
      }
      return;
    }
    if (hasAccess === false) {
      for (const row of deduped) clearInFlight(row.notification_key ?? '');
      return;
    }

    if (!pairId || !deviceId || !userId) {
      for (const row of deduped) {
        await bufferNotification({ ...row, _schemaVersion: QUEUE_SCHEMA_VERSION });
        clearInFlight(row.notification_key ?? '');
      }
      return;
    }

    // Dedup against the persistent processed-keys set (successfully sent keys).
    const processedKeys = await getProcessedKeysSet();
    const toSend: NotificationPayload[] = [];
    for (const row of deduped) {
      if (row.notification_key && processedKeys.has(row.notification_key)) {
        clearInFlight(row.notification_key);
        continue;
      }
      toSend.push({
        ...row,
        child_device_id: deviceId,
        child_user_id: userId,
        pair_id: pairId,
      });
    }
    if (toSend.length === 0) return;

    // Batch-ingest all non-deduped lines
    try {
      await supabase.auth.getSession().catch(() => {});
      const { data, error } = await supabase.functions.invoke('ingest-child-notification', {
        body: { notifications: toSend },
      });
      if (error) throw error;

      if (data) {
        const d = data as { count?: number; dropped?: number; reason?: string };
        if (d.count && d.count > 0) {
          useAuthStore.getState().setIngestSuccess();
        }
        if (d.dropped && d.dropped > 0) {
          useAuthStore.getState().setIngestDropped(
            d.count && d.count > 0
              ? `partial: ${d.dropped} dropped (${d.reason ?? 'app_filtered'})`
              : d.reason ?? 'app_filtered',
          )
          if (!d.count) {
            for (const sent of toSend) clearInFlight(sent.notification_key ?? '');
            await flushBuffer();
            return;
          }
        }
      }

      for (const sent of toSend) {
        if (sent.notification_key) {
          addToProcessedKeys(sent.notification_key);
        }
      }

      await flushBuffer();
    } catch (e) {
      let realMsg = e instanceof Error ? e.message : 'unknown';
      try {
        const ctx = (e as any)?.context;
        if (ctx) {
          const body = await ctx.json();
          if (body?.error) realMsg = body.error;
        }
      } catch {}
      logger.warn('Failed to send notification, buffering...', new Error(realMsg));
      useAuthStore.getState().setIngestError(realMsg);
      for (const n of toSend) {
        await bufferNotification(n);
      }
    } finally {
      for (const sent of toSend) clearInFlight(sent.notification_key ?? '');
    }
  } catch (err) {
    logger.error('Error processing notification:', err);
  }
}

export const headlessNotificationListener = async ({ notification }: { notification: string }): Promise<void> => {
  await processNotification(notification);
};

AppRegistry.registerHeadlessTask(
  HEADLESS_TASK_NAME,
  () => headlessNotificationListener
);

// Flush buffered notifications whenever the app comes to the foreground.
// This handles the killed-app scenario: items buffered with empty IDs
// get their IDs resolved from the hydrated store and sent.
let resumeFlushRegistered = false;
if (!resumeFlushRegistered) {
  resumeFlushRegistered = true;
  AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      flushBuffer();
    }
  });
}

// Subscribe to foreground notification events (Android only)
if (Platform.OS === 'android') {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { EventEmitter } = require('expo');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { NotificationAccessModule } = require('notification-access');
    const emitter = new EventEmitter(NotificationAccessModule);
    emitter.addListener('onNotificationReceived', (event: { notification: string }) => {
      processNotification(event.notification);
    });
  } catch {
    // notification-access module not available on this platform
  }
}

// Auto-flush when the child store becomes fully registered (hydration + IDs).
let prevReady = false;
// Track the last-seen relationship so we can wipe the processed-keys
// dedup set whenever the user signs out, switches roles, or re-pairs
// to a different child/parent. Without this, a new relationship
// inherits the old relationship's content-hash dedup state and could
// silently drop a notification that happens to collide with an old key.
let prevRelationship = '';
// Track the last-seen subscription access state so we can trigger a
// flush as soon as `hasAccess` resolves from `undefined` to a concrete
// value. Without this, buffered notifications would stay in MMKV until
// the next foreground event.
let prevHasAccess: boolean | undefined;
useAuthStore.subscribe((s) => {
  const ready = s._hasHydrated && s.userRole === 'child' && !!s.pairId && !!s.deviceId;
  if (ready && !prevReady) flushBuffer().catch(() => {});
  prevReady = ready;

  const relationship = `${s.userRole ?? ''}|${s.userId ?? ''}|${s.pairId ?? ''}`;
  if (prevRelationship && relationship !== prevRelationship) {
    clearProcessedKeys().catch(() => {});
  }
  prevRelationship = relationship;
});

useSubscriptionStore.subscribe((s) => {
  const prev = prevHasAccess;
  const curr = s.hasAccess;
  // As soon as subscription state resolves from undefined to a concrete
  // value (true or false), attempt to flush. If access is now true the
  // buffered notifications will be sent; if false the flush returns
  // `no_access` and the buffered rows are dropped per the standard
  // gate policy.
  if (prev === undefined && curr !== undefined) {
    flushBuffer().catch(() => {});
  }
  prevHasAccess = curr;
});
