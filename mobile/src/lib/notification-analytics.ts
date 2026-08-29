/**
 * Notification analytics engine.
 *
 * Pure, framework-agnostic functions that derive insight objects from the
 * decrypted notifications we already mirror in the parent app. No backend
 * changes required. All functions are memoized-friendly (no internal state).
 */

export type NotificationWindow = 'today' | 'week' | 'month' | 'year';

export interface RawNotificationLike {
  id: string;
  notification_posted_at: string;
  source_package: string | null;
  source_app_name: string | null;
  notification_title?: string | null;
  notification_body?: string | null;
  child_user_id: string;
}

export type AppCategory =
  | 'social'
  | 'messaging'
  | 'gaming'
  | 'entertainment'
  | 'education'
  | 'shopping'
  | 'dating'
  | 'other';

export const CATEGORY_LABELS: Record<AppCategory, string> = {
  social: 'Social',
  messaging: 'Messaging',
  gaming: 'Gaming',
  entertainment: 'Entertainment',
  education: 'Education',
  shopping: 'Shopping',
  dating: 'Dating',
  other: 'Other',
};

export const CATEGORY_COLORS: Record<AppCategory, string> = {
  social: '#2f4a37',
  messaging: '#4f7d5c',
  gaming: '#a83836',
  entertainment: '#9f402d',
  education: '#44674e',
  shopping: '#745853',
  dating: '#a83836',
  other: '#9b9384',
};

const PACKAGE_PREFIX_OVERRIDES: { match: RegExp; category: AppCategory }[] = [
  { match: /^com\.(instagram|facebook|facebook\.katana|facebook\.orca|twitter|tiktok|threads|reddit|snapchat)/, category: 'social' },
  { match: /^com\.(whatsapp|telegram|messenger|signal|org\.telegram|ch\.abertschi\.telegram)/, category: 'messaging' },
  { match: /^com\.(discord|skype|viber|line|kik|wechat)/, category: 'messaging' },
  { match: /^com\.(google\.android\.dialer|android\.contacts)/, category: 'messaging' },
  { match: /^com\.(google\.android\.gm|gmail|microsoft\.office\.outlook|com\.microsoft\.office\.outlook)/, category: 'messaging' },
  { match: /^com\.(tencent\.ig|tencent\.mg|tencent\.tiwi)/, category: 'gaming' },
  { match: /^com\.(roblox|mojang|minecraft|garena|freefire|epicgames|fortnite|pubg|activision|callofduty|nianticlabs|amongus|supercell)/, category: 'gaming' },
  { match: /^com\.(google\.android\.youtube|netflix|com\.netflix|spotify|com\.spotify|disney|hbo|primevideo|com\.amazon\.primevideo|jiocinema|hotstar|zee5|sonyliv|mxplayer)/, category: 'entertainment' },
  { match: /^com\.(duolingo|byjus|khanacademy|khan\.academy|photomath|google\.classroom|quizlet|coursera|udemy|socratic)/, category: 'education' },
  { match: /^com\.(amazon\.mShop|flipkart|myntra|meesho|alibaba|aliexpress|snapdeal|nykaa)/, category: 'shopping' },
  { match: /^com\.(tinder|bumble|hinge|cmcm\.airport|trulymadly)/, category: 'dating' },
];

const PACKAGE_KEYWORD_OVERRIDES: Record<string, AppCategory> = {
  instagram: 'social',
  facebook: 'social',
  tiktok: 'social',
  snapchat: 'social',
  twitter: 'social',
  threads: 'social',
  reddit: 'social',
  pinterest: 'social',
  linkedin: 'social',
  whatsapp: 'messaging',
  telegram: 'messaging',
  signal: 'messaging',
  messenger: 'messaging',
  viber: 'messaging',
  discord: 'messaging',
  wechat: 'messaging',
  imessage: 'messaging',
  gmail: 'messaging',
  outlook: 'messaging',
  roblox: 'gaming',
  minecraft: 'gaming',
  pubg: 'gaming',
  fortnite: 'gaming',
  freefire: 'gaming',
  freeFire: 'gaming',
  cod: 'gaming',
  amongus: 'gaming',
  youtube: 'entertainment',
  ytmusic: 'entertainment',
  netflix: 'entertainment',
  spotify: 'entertainment',
  hotstar: 'entertainment',
  jiocinema: 'entertainment',
  amazonprimevideo: 'entertainment',
  primevideo: 'entertainment',
  duolingo: 'education',
  byjus: 'education',
  khanacademy: 'education',
  photomath: 'education',
  flipkart: 'shopping',
  amazon: 'shopping',
  myntra: 'shopping',
  meesho: 'shopping',
  aliexpress: 'shopping',
  tinder: 'dating',
  bumble: 'dating',
  hinge: 'dating',
};

export interface CategoryMap {
  has(pkg: string): boolean;
  get(pkg: string): AppCategory | undefined;
  size: number;
}

export function buildCategoryMap(entries: { package_name: string; category: string }[]): CategoryMap {
  const map = new Map<string, AppCategory>();
  for (const e of entries) {
    const normalized = normalizeCategory(e.category);
    if (normalized) map.set(e.package_name, normalized);
  }
  return {
    has: (pkg: string) => map.has(pkg),
    get: (pkg: string) => map.get(pkg),
    get size() {
      return map.size;
    },
  };
}

export function normalizeCategory(raw: string | null | undefined): AppCategory | null {
  if (!raw) return null;
  const k = raw.trim().toLowerCase();
  if (k === 'social_media' || k === 'socialmedia') return 'social';
  if (k === 'social') return 'social';
  if (k === 'messaging' || k === 'messages' || k === 'communication') return 'messaging';
  if (k === 'gaming' || k === 'game') return 'gaming';
  if (k === 'entertainment' || k === 'video' || k === 'music') return 'entertainment';
  if (k === 'education' || k === 'learning') return 'education';
  if (k === 'shopping' || k === 'commerce') return 'shopping';
  if (k === 'dating') return 'dating';
  return 'other';
}

function classifyPackage(pkg: string | null | undefined, catMap: CategoryMap): AppCategory {
  if (!pkg) return 'other';
  const fromServer = catMap.get(pkg);
  if (fromServer) return fromServer;

  for (const { match, category } of PACKAGE_PREFIX_OVERRIDES) {
    if (match.test(pkg)) return category;
  }

  const lower = pkg.toLowerCase();
  for (const [kw, cat] of Object.entries(PACKAGE_KEYWORD_OVERRIDES)) {
    if (lower.includes(kw)) return cat;
  }
  return 'other';
}

export function classifyNotification(
  n: RawNotificationLike,
  catMap: CategoryMap,
): AppCategory {
  return classifyPackage(n.source_package, catMap);
}

function startOfWindow(window: NotificationWindow, now = new Date()): Date {
  const d = new Date(now);
  switch (window) {
    case 'today':
      d.setHours(0, 0, 0, 0);
      return d;
    case 'week':
      d.setDate(d.getDate() - 7);
      return d;
    case 'month':
      d.setDate(d.getDate() - 30);
      return d;
    case 'year':
      d.setDate(d.getDate() - 365);
      return d;
  }
}

export interface PeakBucket {
  label: string;
  hourStart: number;
  hourEnd: number;
  count: number;
}

export function computePeakHours(notifications: RawNotificationLike[], granularity: 4 | 6 = 6): PeakBucket[] {
  const bucketHours = granularity === 4 ? [0, 4, 8, 12, 16, 20] : [0, 4, 8, 12, 16, 20];
  const labels4 = ['12–4 AM', '4–8 AM', '8 AM–12 PM', '12–4 PM', '4–8 PM', '8 PM–12 AM'];
  const labels6 = labels4;
  const labels = granularity === 4 ? labels4 : labels6;
  const buckets: PeakBucket[] = bucketHours.map((h, i) => ({
    hourStart: h,
    hourEnd: (h + 4) % 24,
    count: 0,
    label: labels[i],
  }));
  for (const n of notifications) {
    const h = new Date(n.notification_posted_at).getHours();
    const idx = Math.min(Math.floor(h / 4), 5);
    buckets[idx].count += 1;
  }
  return buckets;
}

export interface TopApp {
  name: string;
  package: string;
  count: number;
  icon: string | null;
  category: AppCategory;
  percent: number;
}

export function computeTopApps(
  notifications: RawNotificationLike[],
  catMap: CategoryMap,
  limit = 5,
): TopApp[] {
  const groups = new Map<string, { name: string; package: string; count: number; icon: string | null }>();
  for (const n of notifications) {
    const pkg = n.source_package?.trim() || 'unknown';
    const existing = groups.get(pkg);
    if (existing) {
      existing.count += 1;
    } else {
      groups.set(pkg, {
        name: n.source_app_name?.trim() || pkg,
        package: pkg,
        count: 1,
        icon: (n as any).app_icon_base64 ?? null,
      });
    }
  }
  const total = notifications.length || 1;
  const arr: TopApp[] = [];
  for (const v of groups.values()) {
    arr.push({
      name: v.name,
      package: v.package,
      count: v.count,
      icon: v.icon,
      category: classifyPackage(v.package, catMap),
      percent: Math.round((v.count / total) * 100),
    });
  }
  arr.sort((a, b) => b.count - a.count);
  return arr.slice(0, limit);
}

export interface CategorySlice {
  category: AppCategory;
  count: number;
  percent: number;
}

export function computeCategoryBreakdown(
  notifications: RawNotificationLike[],
  catMap: CategoryMap,
): CategorySlice[] {
  const counts: Record<AppCategory, number> = {
    social: 0,
    messaging: 0,
    gaming: 0,
    entertainment: 0,
    education: 0,
    shopping: 0,
    dating: 0,
    other: 0,
  };
  for (const n of notifications) {
    counts[classifyNotification(n, catMap)] += 1;
  }
  const total = notifications.length || 1;
  const keys = Object.keys(counts) as AppCategory[];
  const all: CategorySlice[] = [];
  for (const c of keys) {
    all.push({ category: c, count: counts[c], percent: Math.round((counts[c] / total) * 100) });
  }
  const filtered = all.filter((s) => s.count > 0);
  filtered.sort((a, b) => b.count - a.count);
  return filtered;
}

export interface DayPoint {
  dateKey: string;
  date: Date;
  count: number;
}

function dayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function computeDailyTrend(
  notifications: RawNotificationLike[],
  window: NotificationWindow,
  now = new Date(),
): DayPoint[] {
  const start = startOfWindow(window, now);
  const days = Math.max(1, Math.ceil((now.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1);
  const counts = new Map<string, number>();
  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    counts.set(dayKey(d), 0);
  }
  for (const n of notifications) {
    const d = new Date(n.notification_posted_at);
    if (isNaN(d.getTime())) continue;
    if (d.getTime() < start.getTime()) continue;
    const k = dayKey(d);
    if (counts.has(k)) counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const points: DayPoint[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    const k = dayKey(d);
    points.push({ dateKey: k, date: d, count: counts.get(k) ?? 0 });
  }
  return points;
}

export interface DayOfWeekBucket {
  label: string;
  short: string;
  count: number;
}

const DAY_LABELS_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_LABELS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function computeDayOfWeek(notifications: RawNotificationLike[]): DayOfWeekBucket[] {
  const buckets: DayOfWeekBucket[] = DAY_LABELS_FULL.map((label, i) => ({
    label,
    short: DAY_LABELS_SHORT[i],
    count: 0,
  }));
  for (const n of notifications) {
    const d = new Date(n.notification_posted_at);
    if (isNaN(d.getTime())) continue;
    buckets[d.getDay()].count += 1;
  }
  return buckets;
}

export interface SleepDisruptionStats {
  lateNightCount: number;
  lateNightPercent: number;
  topLateApp: TopApp | null;
}

export const LATE_NIGHT_START_HOUR = 22;
export const LATE_NIGHT_END_HOUR = 6;

export function computeSleepDisruption(
  notifications: RawNotificationLike[],
  catMap: CategoryMap,
): SleepDisruptionStats {
  const late = notifications.filter((n) => {
    const d = new Date(n.notification_posted_at);
    const h = d.getHours();
    return h >= LATE_NIGHT_START_HOUR || h < LATE_NIGHT_END_HOUR;
  });
  const total = notifications.length || 1;
  let topLateApp: TopApp | null = null;
  if (late.length > 0) {
    const tops = computeTopApps(late, catMap, 1);
    topLateApp = tops[0] ?? null;
  }
  return {
    lateNightCount: late.length,
    lateNightPercent: Math.round((late.length / total) * 100),
    topLateApp,
  };
}

export interface SocialMediaStats {
  socialCount: number;
  socialPercent: number;
  lateNightSocialCount: number;
  topSocialApp: TopApp | null;
}

export function computeSocialMediaStats(
  notifications: RawNotificationLike[],
  catMap: CategoryMap,
): SocialMediaStats {
  const social = notifications.filter((n) => classifyNotification(n, catMap) === 'social');
  const total = notifications.length || 1;
  let lateNightSocial = 0;
  for (const n of social) {
    const h = new Date(n.notification_posted_at).getHours();
    if (h >= LATE_NIGHT_START_HOUR || h < LATE_NIGHT_END_HOUR) lateNightSocial += 1;
  }
  const tops = social.length > 0 ? computeTopApps(social, catMap, 1) : [];
  return {
    socialCount: social.length,
    socialPercent: Math.round((social.length / total) * 100),
    lateNightSocialCount: lateNightSocial,
    topSocialApp: tops[0] ?? null,
  };
}

export interface TrendComparison {
  current: number;
  previous: number;
  delta: number;
  deltaPercent: number;
  direction: 'up' | 'down' | 'flat';
}

export function computeTrendVsPrevious(
  current: RawNotificationLike[],
  previous: RawNotificationLike[],
): TrendComparison {
  const curr = current.length;
  const prev = previous.length;
  const delta = curr - prev;
  const deltaPercent = prev === 0 ? (curr > 0 ? 100 : 0) : Math.round((delta / prev) * 100);
  const direction: TrendComparison['direction'] = delta === 0 ? 'flat' : delta > 0 ? 'up' : 'down';
  return { current: curr, previous: prev, delta, deltaPercent, direction };
}

export interface VelocityStats {
  perHour: number;
  mostActiveHourLabel: string | null;
  mostActiveDayLabel: string | null;
  peakHourCount: number;
}

export function computeVelocity(
  notifications: RawNotificationLike[],
  window: NotificationWindow,
): VelocityStats {
  const total = notifications.length;
  let hours = 1;
  switch (window) {
    case 'today': hours = 24; break;
    case 'week': hours = 24 * 7; break;
    case 'month': hours = 24 * 30; break;
    case 'year': hours = 24 * 365; break;
  }
  const perHour = +(total / hours).toFixed(2);
  const peak = computePeakHours(notifications, 6).reduce((max, b) => (b.count > max.count ? b : max), computePeakHours(notifications, 6)[0]);
  const dow = computeDayOfWeek(notifications).reduce((max, b) => (b.count > max.count ? b : max), computeDayOfWeek(notifications)[0]);
  return {
    perHour,
    mostActiveHourLabel: peak && peak.count > 0 ? peak.label : null,
    mostActiveDayLabel: dow && dow.count > 0 ? dow.label : null,
    peakHourCount: peak?.count ?? 0,
  };
}

export interface NewAppEntry {
  name: string;
  package: string;
  icon: string | null;
  category: AppCategory;
  count: number;
  firstSeenAt: Date;
}

export function computeNewApps(
  current: RawNotificationLike[],
  prior: RawNotificationLike[],
  catMap: CategoryMap,
  limit = 6,
): NewAppEntry[] {
  const priorPkgs = new Set<string>();
  for (const n of prior) if (n.source_package) priorPkgs.add(n.source_package);

  const groups = new Map<string, NewAppEntry>();
  for (const n of current) {
    const pkg = n.source_package?.trim();
    if (!pkg) continue;
    if (priorPkgs.has(pkg)) continue;
    const d = new Date(n.notification_posted_at);
    const existing = groups.get(pkg);
    if (!existing) {
      groups.set(pkg, {
        name: n.source_app_name?.trim() || pkg,
        package: pkg,
        icon: (n as any).app_icon_base64 ?? null,
        category: classifyPackage(pkg, catMap),
        count: 1,
        firstSeenAt: d,
      });
    } else {
      existing.count += 1;
      if (d.getTime() < existing.firstSeenAt.getTime()) existing.firstSeenAt = d;
    }
  }
  const arr = Array.from(groups.values());
  arr.sort((a, b) => b.count - a.count);
  return arr.slice(0, limit);
}

export interface SummaryStats {
  total: number;
  topApp: TopApp | null;
  peakBucket: PeakBucket | null;
  trend: TrendComparison;
  velocity: VelocityStats;
  social: SocialMediaStats;
  sleep: SleepDisruptionStats;
  uniqueApps: number;
}

export interface InsightInputs {
  current: RawNotificationLike[];
  previous: RawNotificationLike[];
  window: NotificationWindow;
  catMap: CategoryMap;
}

export function computeSummaryStats({ current, previous, window, catMap }: InsightInputs): SummaryStats {
  const topApps = computeTopApps(current, catMap, 1);
  const peakBuckets = computePeakHours(current, 6);
  const peakBucket = peakBuckets.reduce((max, b) => (b.count > max.count ? b : max), peakBuckets[0]);
  const uniqueApps = new Set(current.map((n) => n.source_package).filter(Boolean)).size;
  return {
    total: current.length,
    topApp: topApps[0] ?? null,
    peakBucket: peakBucket && peakBucket.count > 0 ? peakBucket : null,
    trend: computeTrendVsPrevious(current, previous),
    velocity: computeVelocity(current, window),
    social: computeSocialMediaStats(current, catMap),
    sleep: computeSleepDisruption(current, catMap),
    uniqueApps,
  };
}

export function generateNarrative(
  stats: SummaryStats,
  childLabel: string | null,
  window: NotificationWindow,
): string {
  if (stats.total === 0) {
    return childLabel
      ? `No notification activity for ${childLabel} in this window yet.`
      : 'No notification activity across your children in this window yet.';
  }
  const subject = childLabel ? childLabel : 'your children';
  const period =
    window === 'today' ? 'today' : window === 'week' ? 'this week' : window === 'month' ? 'this month' : 'this year';
  const parts: string[] = [];
  parts.push(`${subject} received ${stats.total} notification${stats.total === 1 ? '' : 's'} ${period}.`);
  if (stats.topApp) {
    parts.push(`${stats.topApp.name} led with ${stats.topApp.count} ping${stats.topApp.count === 1 ? '' : 's'}.`);
  }
  if (stats.peakBucket) {
    parts.push(`Most activity fell in the ${stats.peakBucket.label} window.`);
  }
  if (stats.trend.direction === 'up' && stats.trend.deltaPercent > 0) {
    parts.push(`Activity is up ${stats.trend.deltaPercent}% versus the prior window.`);
  } else if (stats.trend.direction === 'down' && stats.trend.deltaPercent < 0) {
    parts.push(`Activity is down ${Math.abs(stats.trend.deltaPercent)}% versus the prior window.`);
  }
  if (stats.sleep.lateNightPercent >= 25) {
    parts.push(`${stats.sleep.lateNightPercent}% arrived after 10 PM — a gentle check-in moment.`);
  }
  return parts.join(' ');
}
