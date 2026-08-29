import { supabase } from '@/lib/supabase';
import { isValidUUID } from '@/lib/uuid';
import { logger } from '@/services/logger';

export interface RawNotification {
  id: string;
  pair_id: string | null;
  parent_user_id: string;
  child_user_id: string;
  child_device_id: string;
  source_package: string | null;
  source_app_name: string | null;
  notification_title: string;
  notification_body: string;
  notification_posted_at: string;
  delivery_mode: string;
  app_icon_base64: string | null;
}

export interface ChildRef {
  pairId: string;
  childUserId: string;
  childDeviceId: string;
  displayName: string | null;
  isOnline: boolean;
  lastSeenAt: string | null;
  isForeground: boolean;
  pushToken: string | null;
}

export type AggregatedNotification = RawNotification & {
  child: ChildRef | null;
};

export interface AggregatedResult {
  notifications: AggregatedNotification[];
  children: ChildRef[];
}

const SERVER_PAGE_CAP = 50;
const DEFAULT_MAX_PAGES = 10;

async function readError(error: unknown): Promise<string> {
  if (!error) return 'Unknown error';
  const ctx = (error as any)?.context;
  if (ctx) {
    try {
      const body = await ctx.json();
      if (body?.error) return body.error;
    } catch {}
  }
  return error instanceof Error ? error.message : 'Unknown error';
}

async function loadChildren(parentDeviceId: string): Promise<ChildRef[]> {
  const { data, error } = await supabase
    .from('pairs')
    .select(
      'id, child_device_id, child_user_id, child_device:devices!child_device_id(is_foreground, last_seen_at, push_token), child_user:profiles!child_user_id(display_name)',
    )
    .eq('parent_device_id', parentDeviceId)
    .in('status', ['active', 'pending'])
    .order('paired_at', { ascending: true });

  if (error || !data) return [];

  return (data as any[]).map((row) => {
    const dev = row.child_device ?? null;
    const prof = row.child_user ?? null;
    const isForeground = !!dev?.is_foreground;
    const lastSeenAt = (dev?.last_seen_at as string | null) ?? null;
    const isOnline =
      isForeground ||
      (lastSeenAt !== null && Date.now() - new Date(lastSeenAt).getTime() < 120000);
    return {
      pairId: row.id as string,
      childUserId: row.child_user_id as string,
      childDeviceId: row.child_device_id as string,
      displayName: (prof?.display_name as string | null) ?? null,
      isOnline,
      lastSeenAt,
      isForeground,
      pushToken: (dev?.push_token as string | null) ?? null,
    };
  });
}

function buildRequestBody(
  childUserIds: string[],
  options: { limit?: number; since?: string | null; before?: string | null },
): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  if (childUserIds.length > 1) body.child_user_ids = childUserIds;
  else if (childUserIds.length === 1) body.child_user_id = childUserIds[0];
  if (options.limit != null) body.limit = options.limit;
  if (options.since) body.since = options.since;
  if (options.before) body.before = options.before;
  return body;
}

function tagWithChildren(
  rows: RawNotification[],
  childIndex: Map<string, ChildRef>,
): AggregatedNotification[] {
  return rows.map((n) => ({
    ...n,
    child: childIndex.get(n.child_user_id) ?? null,
  }));
}

export async function fetchParentNotifications(params: {
  parentDeviceId: string;
  selectedChildId: string | null;
  limit?: number;
  since?: string | null;
  before?: string | null;
}): Promise<AggregatedResult> {
  const { parentDeviceId, selectedChildId } = params;
  if (!isValidUUID(parentDeviceId)) {
    return { notifications: [], children: [] };
  }

  const children = await loadChildren(parentDeviceId);
  const requestedIds: string[] = selectedChildId
    ? (() => {
        const match = children.find((c) => c.childUserId === selectedChildId);
        return match ? [match.childUserId] : [];
      })()
    : children.map((c) => c.childUserId);

  if (requestedIds.length === 0) {
    return { notifications: [], children };
  }

  const body = buildRequestBody(requestedIds, params);
  const { data, error } = await supabase.functions.invoke('get-notifications', { body });

  if (error || !data?.data) {
    if (error) {
      logger.warn('[notifications-service] get-notifications error:', await readError(error));
    }
    return { notifications: [], children };
  }

  const childIndex = new Map(children.map((c) => [c.childUserId, c]));
  const rows = (data.data as RawNotification[]).map((n) => ({
    ...n,
    child: childIndex.get(n.child_user_id) ?? null,
  }));

  return { notifications: rows, children };
}

export interface PaginatedResult extends AggregatedResult {
  hasMore: boolean;
  totalFetched: number;
}

/**
 * Paginated fetch that loops with a (before, before_id) cursor until either
 * the requested window is exhausted or the page budget is hit. Used by long
 * analytical windows (week/month/year across all children).
 */
export async function fetchParentNotificationsPaginated(
  params: {
    parentDeviceId: string;
    selectedChildId: string | null;
    since?: string | null;
    before?: string | null;
    beforeId?: string | null;
    maxPages?: number;
  },
): Promise<PaginatedResult> {
  const { parentDeviceId, selectedChildId, since, maxPages } = params;
  const pageBudget = maxPages ?? DEFAULT_MAX_PAGES;
  if (!isValidUUID(parentDeviceId)) {
    return { notifications: [], children: [], hasMore: false, totalFetched: 0 };
  }

  const children = await loadChildren(parentDeviceId);
  const requestedIds: string[] = selectedChildId
    ? (() => {
        const match = children.find((c) => c.childUserId === selectedChildId);
        return match ? [match.childUserId] : [];
      })()
    : children.map((c) => c.childUserId);

  if (requestedIds.length === 0) {
    return { notifications: [], children, hasMore: false, totalFetched: 0 };
  }

  const childIndex = new Map(children.map((c) => [c.childUserId, c]));
  const all: AggregatedNotification[] = [];
  let before: string | null = params.before ?? null;
  let beforeId: string | null = params.beforeId ?? null;
  let pages = 0;
  let hasMore = false;

  while (pages < pageBudget) {
    pages += 1;
    const body: Record<string, unknown> = {
      limit: SERVER_PAGE_CAP,
    };
    if (requestedIds.length > 1) body.child_user_ids = requestedIds;
    else body.child_user_id = requestedIds[0];
    if (since) body.since = since;
    if (before) body.before = before;
    if (before && beforeId) body.before_id = beforeId;

    const { data, error } = await supabase.functions.invoke('get-notifications', { body });

    if (error || !data?.data) {
      if (error) {
        logger.warn('[notifications-service] paginated get-notifications error:', await readError(error));
      }
      break;
    }

    const rows = (data.data as RawNotification[]) ?? [];
    if (rows.length === 0) {
      hasMore = false;
      break;
    }

    all.push(...tagWithChildren(rows, childIndex));
    if (rows.length < SERVER_PAGE_CAP) {
      hasMore = false;
      break;
    }
    const oldest = rows[rows.length - 1];
    if (!oldest?.notification_posted_at || !oldest?.id) {
      hasMore = false;
      break;
    }
    before = oldest.notification_posted_at;
    beforeId = oldest.id;
    hasMore = true;
  }

  return {
    notifications: all,
    children,
    hasMore,
    totalFetched: all.length,
  };
}

export interface MoreNotificationsCursor {
  before: string;
  beforeId: string;
}

export async function fetchMoreNotificationsOlderThan(params: {
  parentDeviceId: string;
  selectedChildId: string | null;
  cursor: MoreNotificationsCursor;
}): Promise<AggregatedResult & { nextCursor: MoreNotificationsCursor | null; hasMore: boolean }> {
  if (!isValidUUID(params.parentDeviceId)) {
    return {
      notifications: [],
      children: [],
      nextCursor: null,
      hasMore: false,
    };
  }

  const children = await loadChildren(params.parentDeviceId);
  const requestedIds: string[] = params.selectedChildId
    ? (() => {
        const match = children.find((c) => c.childUserId === params.selectedChildId);
        return match ? [match.childUserId] : [];
      })()
    : children.map((c) => c.childUserId);

  if (requestedIds.length === 0) {
    return { notifications: [], children, nextCursor: null, hasMore: false };
  }

  const body: Record<string, unknown> = {
    limit: SERVER_PAGE_CAP,
    before: params.cursor.before,
    before_id: params.cursor.beforeId,
  };
  if (requestedIds.length > 1) body.child_user_ids = requestedIds;
  else body.child_user_id = requestedIds[0];

  const { data, error } = await supabase.functions.invoke('get-notifications', { body });

  if (error || !data?.data) {
    if (error) {
      logger.warn('[notifications-service] load-more get-notifications error:', await readError(error));
    }
    return { notifications: [], children, nextCursor: null, hasMore: false };
  }

  const childIndex = new Map(children.map((c) => [c.childUserId, c]));
  const rows = (data.data as RawNotification[]) ?? [];
  const hasMore = rows.length >= SERVER_PAGE_CAP;
  const nextCursor =
    hasMore && rows.length > 0
      ? {
          before: rows[rows.length - 1].notification_posted_at,
          beforeId: rows[rows.length - 1].id,
        }
      : null;

  return {
    notifications: tagWithChildren(rows, childIndex),
    children,
    nextCursor,
    hasMore,
  };
}
