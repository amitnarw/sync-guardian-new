import React from 'react';
import { StyleSheet, View, TouchableOpacity, Text, ActivityIndicator, RefreshControl } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';

import { ThemedView } from '@/components/themed-view';
import { EdgeFadeScrollView } from '@/components/ui/edge-fade';
import { InsightsEmptyState } from '@/components/insights-empty-state';
import { AppIcon } from '@/components/app-icon';
import { useInsightsData, type TimeWindow, type InsightsNotification } from '@/hooks/use-insights-data';
import { useAuthStore } from '@/hooks/use-auth-store';
import { useRegisterHeaderRefresh } from '@/contexts/HeaderRefreshContext';
import { Skeleton } from '@/components/ui/skeleton';

// ============================================================
// EXACT STITCH COLORS (from v3 HTML Tailwind config)
// ============================================================
const C = {
  primary: '#44674d',
  primaryContainer: '#c5eccc',
  onPrimary: '#e8ffea',
  secondary: '#a0412d',
  secondaryContainer: '#ffdad3',
  onSecondary: '#fff7f6',
  tertiary: '#44674e',
  tertiaryContainer: '#d3fbda',
  surface: '#fff8f0',
  surfaceBright: '#fff8f0',
  surfaceContainer: '#f5ede0',
  surfaceContainerLow: '#faf3e7',
  surfaceContainerHigh: '#efe7da',
  surfaceContainerHighest: '#eae1d2',
  surfaceContainerLowest: '#ffffff',
  surfaceVariant: '#eae1d2',
  onSurface: '#363228',
  onSurfaceVariant: '#645e53',
  outline: '#807a6d',
  outlineVariant: '#b9b1a3',
  error: '#a83836',
  white: '#ffffff',
} as const;

// ============================================================
// INSIGHTS COMPUTATION HELPERS
// ============================================================
interface Bucket { label: string; count: number; }



function getPeakWindows(notifications: InsightsNotification[]): Bucket[] {
  const b = [
    { label: '12\u20134AM', count: 0 },
    { label: '4\u20138AM', count: 0 },
    { label: '8AM\u201312PM', count: 0 },
    { label: '12\u20134PM', count: 0 },
    { label: '4\u20138PM', count: 0 },
    { label: '8PM\u201312AM', count: 0 },
  ];
  for (const n of notifications) {
    const h = new Date(n.notification_posted_at).getHours();
    if (h < 4) b[0].count++;
    else if (h < 8) b[1].count++;
    else if (h < 12) b[2].count++;
    else if (h < 16) b[3].count++;
    else if (h < 20) b[4].count++;
    else b[5].count++;
  }
  return b;
}

function getTopApps(notifications: InsightsNotification[], limit = 5): { name: string; count: number; icon: string | null; package: string }[] {
  const groups: Record<string, { name: string; count: number; icon: string | null; package: string }> = {};
  for (const n of notifications) {
    const pkg = n.source_package?.trim() || 'unknown';
    if (!groups[pkg]) groups[pkg] = { name: n.source_app_name?.trim() || pkg, count: 0, icon: n.app_icon_base64, package: pkg };
    groups[pkg].count++;
  }
  return Object.values(groups).sort((a, b) => b.count - a.count).slice(0, limit);
}

function generateNarrative(notifications: InsightsNotification[], window: TimeWindow): string {
  if (notifications.length === 0) return '';
  const top = getTopApps(notifications, 1);
  const name = top.length > 0 ? top[0].name : 'apps';
  const total = notifications.length;
  const period = window === 'today' ? 'today' : window === 'week' ? 'this week' : window === 'month' ? 'this month' : 'this year';
  const peaks = getPeakWindows(notifications);
  const topPeak = peaks.reduce((a, b) => a.count > b.count ? a : b, peaks[0]);
  const peakLabel = topPeak.count > 1 ? ` Peak hours: ${topPeak.label}.` : '';
  return `${total} notification${total !== 1 ? 's' : ''} ${period}. Most from ${name}.${peakLabel}`;
}

function formatTimeAgo(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime();
  if (diff < 60000) return 'Just now';
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function formatLatestSignal(notifications: InsightsNotification[]): string {
  if (notifications.length === 0) return 'No notifications yet';
  const n = notifications[0];
  const app = n.source_app_name || n.source_package || '';
  const title = n.notification_title || '';
  if (app && title) return `${app} \u2014 ${title}`;
  if (app) return app;
  if (title) return title;
  return 'Unknown notification';
}

// ============================================================
// TOTAL USAGE GRAPH HELPERS
// ============================================================
function getUsageData(window: TimeWindow) {
  switch (window) {
    case 'today':
      return {
        time: '4h 12m',
        trend: '+18% from yesterday',
        trendColor: '#a0412d', // C.secondary
        subtitle: 'Active device time today',
        barWidth: 42,
        bars: [
          { label: '08', height: '25%', color: '#44674d' },
          { label: '12', height: '60%', color: '#44674d' },
          { label: '16', height: '90%', color: '#44674d' },
          { label: '20', height: '45%', color: '#44674d' },
          { label: '24', height: '20%', color: '#a0412d' },
        ]
      };
    case 'week':
      return {
        time: '24h 45m',
        trend: '+5% from last week',
        trendColor: '#a0412d', // C.secondary
        subtitle: 'Active device time this week',
        barWidth: 32,
        bars: [
          { label: 'M', height: '55%', color: '#44674d' },
          { label: 'T', height: '75%', color: '#44674d' },
          { label: 'W', height: '95%', color: '#44674d' },
          { label: 'T', height: '55%', color: '#44674d' },
          { label: 'F', height: '30%', color: '#a0412d' },
          { label: 'S', height: '70%', color: '#44674d' },
          { label: 'S', height: '40%', color: '#44674d' },
        ]
      };
    case 'month':
      return {
        time: '98h 15m',
        trend: '-2% from last month',
        trendColor: '#645e53', // C.onSurfaceVariant
        subtitle: 'Active device time this month',
        barWidth: 52,
        bars: [
          { label: 'W1', height: '50%', color: '#44674d' },
          { label: 'W2', height: '75%', color: '#44674d' },
          { label: 'W3', height: '90%', color: '#44674d' },
          { label: 'W4', height: '35%', color: '#a0412d' },
        ]
      };
    case 'year':
      return {
        time: '1120h 30m',
        trend: '+12% from last year',
        trendColor: '#a0412d', // C.secondary
        subtitle: 'Active device time this year',
        barWidth: 18,
        bars: [
          { label: 'J', height: '45%', color: '#44674d' },
          { label: 'F', height: '35%', color: '#44674d' },
          { label: 'M', height: '60%', color: '#44674d' },
          { label: 'A', height: '70%', color: '#44674d' },
          { label: 'M', height: '85%', color: '#44674d' },
          { label: 'J', height: '90%', color: '#44674d' },
          { label: 'J', height: '80%', color: '#44674d' },
          { label: 'A', height: '70%', color: '#44674d' },
          { label: 'S', height: '60%', color: '#44674d' },
          { label: 'O', height: '75%', color: '#44674d' },
          { label: 'N', height: '80%', color: '#44674d' },
          { label: 'D', height: '95%', color: '#a0412d' },
        ]
      };
  }
}
function getBezierPath(points: { x: number; y: number }[]): { strokePath: string; fillPath: string } {
  if (points.length === 0) return { strokePath: '', fillPath: '' };

  let strokePath = `M ${points[0].x},${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    const cpX1 = p0.x + 31;
    const cpY1 = p0.y;
    const cpX2 = p1.x - 31;
    const cpY2 = p1.y;
    strokePath += ` C ${cpX1},${cpY1} ${cpX2},${cpY2} ${p1.x},${p1.y}`;
  }

  const first = points[0];
  const last = points[points.length - 1];
  const fillPath = `${strokePath} L ${last.x},120 L ${first.x},120 Z`;

  return { strokePath, fillPath };
}

export default function InsightsScreen() {
  const { notifications, isLoading, isRefreshing, error, window, setWindow, refresh } = useInsightsData();
  useRegisterHeaderRefresh(refresh);
  const { pairId } = useAuthStore();

  const topApps = React.useMemo(() => getTopApps(notifications), [notifications]);
  const narrative = React.useMemo(() => generateNarrative(notifications, window), [notifications, window]);
  const usageData = React.useMemo(() => getUsageData(window), [window]);

  const peakPoints = React.useMemo(() => {
    const data = getPeakWindows(notifications);
    const maxVal = Math.max(...data.map(b => b.count), 1);
    const W = 388;

    return data.map((bucket, i) => {
      const x = (i * W) / 5;
      const y = 105 - (bucket.count / maxVal) * 90;
      return { x, y, label: bucket.label };
    });
  }, [notifications]);

  const paths = React.useMemo(() => getBezierPath(peakPoints), [peakPoints]);

  return (
    <ThemedView style={s.container}>
        <EdgeFadeScrollView
          contentContainerStyle={s.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={refresh} colors={[C.primary]} tintColor={C.primary} />
          }
        >
          {isLoading && !isRefreshing ? (
            <View style={{ gap: 16, paddingTop: 16 }}>
              {/* Selector placeholder */}
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} width={70} height={32} borderRadius={9999} />
                ))}
              </View>
              {/* Pulse Narrative Card placeholder */}
              <View style={{ backgroundColor: C.surfaceContainerLowest, borderRadius: 32, padding: 24, gap: 10 }}>
                <Skeleton width={100} height={12} borderRadius={6} />
                <Skeleton width="90%" height={16} borderRadius={8} />
                <Skeleton width="60%" height={16} borderRadius={8} />
              </View>
              {/* Total Usage Card placeholder */}
              <View style={{ backgroundColor: C.surfaceContainerLowest, borderRadius: 32, padding: 24, gap: 16 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <View style={{ gap: 6 }}>
                    <Skeleton width={120} height={20} borderRadius={10} />
                    <Skeleton width={160} height={12} borderRadius={6} />
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 6 }}>
                    <Skeleton width={80} height={24} borderRadius={12} />
                    <Skeleton width={120} height={12} borderRadius={6} />
                  </View>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', height: 120, alignItems: 'flex-end', paddingTop: 16 }}>
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} width={42} height={`${20 + i * 15}%`} borderRadius={9999} />
                  ))}
                </View>
              </View>
            </View>
          ) : error ? (
            <View style={s.centerState}>
              <Text style={s.emptyTitle}>Unable to load insights</Text>
              <Text style={s.emptyText}>{error}</Text>
              <TouchableOpacity style={s.retryBtn} onPress={refresh} activeOpacity={0.7}>
                <Text style={s.retryBtnText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : notifications.length === 0 ? (
            <InsightsEmptyState hasPair={!!pairId} />
          ) : (
            <>
              {/* ========== HERO HEADING ========== */}
              <View style={s.heroSection}>
                <Text style={s.heroTitle}>Insights</Text>
                <Text style={s.heroDescription}>
                  See when and how the connected device is used.
                </Text>
              </View>

              {/* Window Selector */}
              <View style={s.windowSelectorRow}>
                {(['today', 'week', 'month', 'year'] as TimeWindow[]).map((w) => (
                  <TouchableOpacity
                    key={w}
                    style={[s.windowPill, window === w && s.windowPillActive]}
                    onPress={() => setWindow(w)}
                    activeOpacity={0.7}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: window === w }}
                  >
                    <Text style={[s.windowPillText, window === w && s.windowPillTextActive]}>
                      {w.charAt(0).toUpperCase() + w.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Pulse Narrative */}
              <View style={s.pulseCard}>
                <Text style={s.pulseLabel}>Activity Overview</Text>
                <Text style={s.pulseText}>{narrative}</Text>
              </View>

              {/* Total Usage Card */}
              <View style={s.usageCard}>
                <View style={s.usageHeader}>
                  <View style={s.usageHeaderLeft}>
                    <View>
                      <Text style={s.usageTitle}>Total Usage</Text>
                      <Text style={s.usageSubtitle}>{usageData.subtitle}</Text>
                    </View>
                  </View>
                  <View style={s.usageHeaderRight}>
                    <Text style={s.usageTimeText}>{usageData.time}</Text>
                    <Text style={[s.usageTrendText, { color: usageData.trendColor }]}>{usageData.trend}</Text>
                  </View>
                </View>

                {/* Usage Graph */}
                <View style={s.graphContainer}>
                  <View style={s.barsContainer}>
                    {usageData.bars.map((bar, i) => (
                      <View key={i} style={s.pillColumn}>
                        {/* Pill Background */}
                        <View style={[s.pillBg, { width: usageData.barWidth }]}>
                          {/* Pill Fill */}
                          <View
                            style={[
                              s.pillFill,
                              {
                                height: bar.height as any,
                                backgroundColor: bar.color,
                              }
                            ]}
                          />
                        </View>
                        {/* Matching Color Label */}
                        <Text style={[s.barLabel, { color: bar.color }]}>
                          {bar.label}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              </View>

              {/* Peak Activity Windows */}
              <View style={s.peakCard}>
                <Text style={s.peakTitle}>Peak Hours</Text>

                <View style={s.chartWrapper}>
                  {/* Y-Axis Legend overlay */}
                  <View style={s.peakYAxis}>
                    <Text style={s.peakYLabel}>High</Text>
                    <Text style={s.peakYLabel}>Med</Text>
                    <Text style={s.peakYLabel}>Low</Text>
                  </View>

                  <Svg width="100%" height={120} viewBox="0 0 388 120">
                    <Defs>
                      <LinearGradient id="fillGrad" x1="0" y1="0" x2="0" y2="1">
                        <Stop offset="0%" stopColor={C.primary} stopOpacity={0.15} />
                        <Stop offset="100%" stopColor="#ffffff" stopOpacity={0} />
                      </LinearGradient>
                      <LinearGradient id="strokeGrad" x1="0" y1="0" x2="0" y2="1">
                        <Stop offset="0%" stopColor={C.primary} stopOpacity={1.0} />
                        <Stop offset="70%" stopColor={C.primary} stopOpacity={0.5} />
                        <Stop offset="100%" stopColor={C.primary} stopOpacity={0.1} />
                      </LinearGradient>
                    </Defs>

                    {/* Area path */}
                    <Path
                      d={paths.fillPath}
                      fill="url(#fillGrad)"
                    />

                    {/* Stroke path */}
                    <Path
                      d={paths.strokePath}
                      fill="none"
                      stroke="url(#strokeGrad)"
                      strokeWidth={3}
                    />
                  </Svg>
                </View>

                {/* Graph Legends (Positioned below graph) */}
                <View style={s.peakXAxisRow}>
                  {peakPoints.map((p, i) => {
                    const shortLabel = p.label
                      .replace('12\u20134AM', '12a')
                      .replace('4\u20138AM', '4a')
                      .replace('8AM\u201312PM', '8a')
                      .replace('12\u20134PM', '12p')
                      .replace('4\u20138PM', '4p')
                      .replace('8PM\u201312AM', '8p');
                    return (
                      <Text key={i} style={s.peakXAxisLabel}>
                        {shortLabel}
                      </Text>
                    );
                  })}
                </View>
              </View>

              {/* App Insights */}
              <View style={s.appInsightsCard}>
                <Text style={s.appInsightsTitle}>App Insights</Text>
                {topApps.length > 0 ? topApps.map((app, i) => {
                  const maxCount = topApps[0].count;
                  const barWidth = Math.max((app.count / maxCount) * 100, 2);
                  return (
                    <View key={app.package + i} style={s.appInsightsItem}>
                      <AppIcon iconBase64={app.icon} size={40} fallbackSize={20} />
                      <Text style={s.appInsightsName} numberOfLines={1} ellipsizeMode="tail">{app.name}</Text>
                      <View style={s.appInsightsBarBg}>
                        <View style={[s.appInsightsBarFill, { width: `${barWidth}%` }]} />
                      </View>
                      <Text style={s.appInsightsCount}>{app.count}</Text>
                    </View>
                  );
                }) : null}
              </View>

              {/* Latest Notification */}
              <View style={s.latestCard}>
                <AppIcon iconBase64={notifications[0]?.app_icon_base64} size={40} fallbackSize={20} />
                <View style={s.latestTextWrap}>
                  <Text style={s.latestLabel}>Latest Notification</Text>
                  <Text style={s.latestTitle} numberOfLines={1}>
                    {formatLatestSignal(notifications)}
                  </Text>
                </View>
                <Text style={s.latestTimeAgo}>
                  {formatTimeAgo(notifications[0]?.notification_posted_at || '')}
                </Text>
              </View>

              <View style={s.encryptBadge}>
                <Ionicons name="shield-checkmark" size={14} color={C.primary} />
                <Text style={s.encryptBadgeText}>All notification contents are securely encrypted at rest</Text>
              </View>
            </>
          )}

          {/* Spacer to avoid bottom custom tab bar overlay */}
          <View style={s.bottomSpacer} />
        </EdgeFadeScrollView>
    </ThemedView>
  );
}

// ============================================================
// STYLES - mapped precisely from Stitch Tailwind
// ============================================================
const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.surface,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 8,
  },

  /* ---------- Hero Section ---------- */
  heroSection: {
    marginBottom: 24,
    gap: 12,
  },
  flowLabel: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 12,
    letterSpacing: 2.5,
    color: C.secondary,
    textTransform: 'uppercase',
  },
  heroTitle: {
    fontFamily: 'PlusJakartaSans-ExtraBold',
    fontSize: 40,
    color: C.onSurface,
  },
  heroDescription: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 16,
    lineHeight: 24,
    color: C.onSurfaceVariant,
    maxWidth: 320,
  },

  /* ---------- Window Selector ---------- */
  windowSelectorRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 24,
    marginTop: 16,
  },
  windowPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 9999,
    backgroundColor: C.surfaceContainer,
  },
  windowPillActive: {
    backgroundColor: C.primary,
  },
  windowPillText: {
    fontFamily: 'PlusJakartaSans-SemiBold',
    fontSize: 13,
    color: C.onSurfaceVariant,
  },
  windowPillTextActive: {
    color: C.white,
  },

  /* ---------- Pulse Narrative Card ---------- */
  pulseCard: {
    backgroundColor: C.surfaceContainerLowest,
    borderRadius: 32,
    padding: 24,
    marginBottom: 16,
  },
  pulseLabel: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 12,
    color: C.onSurfaceVariant,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  pulseText: {
    fontFamily: 'Manrope-Regular',
    fontSize: 15,
    lineHeight: 22,
    color: C.onSurface,
  },

  /* ---------- Peak Hours Card ---------- */
  peakCard: {
    backgroundColor: C.surfaceContainerLowest,
    borderRadius: 32,
    paddingTop: 24,
    paddingHorizontal: 24,
    paddingBottom: 20,
    marginBottom: 16,
    overflow: 'hidden',
  },
  peakTitle: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 18,
    color: C.onSurface,
    marginBottom: 16,
  },
  chartWrapper: {
    width: 'auto',
    height: 120,
    marginHorizontal: -24,
    marginTop: 16,
    overflow: 'hidden',
    position: 'relative',
  },
  peakYAxis: {
    position: 'absolute',
    left: 24,
    top: 10,
    bottom: 20,
    justifyContent: 'space-between',
    zIndex: 10,
  },
  peakYLabel: {
    fontFamily: 'Manrope-SemiBold',
    fontSize: 10,
    color: C.onSurfaceVariant,
    opacity: 0.5,
  },
  peakXAxisRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    marginBottom: 0,
  },
  peakXAxisLabel: {
    fontFamily: 'Manrope-SemiBold',
    fontSize: 11,
    color: C.onSurfaceVariant,
    width: 32,
    textAlign: 'center',
  },

  /* ---------- App Insights Card ---------- */
  appInsightsCard: {
    backgroundColor: C.surfaceContainerLowest,
    borderRadius: 32,
    padding: 24,
    marginBottom: 16,
  },
  appInsightsTitle: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 18,
    color: C.onSurface,
    marginBottom: 16,
  },
  appInsightsItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  appInsightsIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: C.surfaceContainer,
    justifyContent: 'center',
    alignItems: 'center',
  },
  appInsightsName: {
    fontFamily: 'PlusJakartaSans-SemiBold',
    fontSize: 14,
    color: C.onSurface,
    flexBasis: 100,
    flexShrink: 1,
    marginRight: 12,
  },
  appInsightsBarBg: {
    flex: 1,
    height: 16,
    borderRadius: 9999,
    backgroundColor: C.surfaceContainer,
    overflow: 'hidden',
  },
  appInsightsBarFill: {
    height: '100%',
    borderRadius: 9999,
    backgroundColor: C.primary,
  },
  appInsightsCount: {
    fontFamily: 'PlusJakartaSans-SemiBold',
    fontSize: 12,
    color: C.onSurfaceVariant,
    width: 32,
    textAlign: 'right',
    flexShrink: 0,
  },

  /* ---------- Latest Notification Card ---------- */
  latestCard: {
    backgroundColor: C.surfaceContainerLow,
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  latestIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: C.primaryContainer,
    justifyContent: 'center',
    alignItems: 'center',
  },
  latestTextWrap: {
    flex: 1,
  },
  latestLabel: {
    fontFamily: 'Manrope-Medium',
    fontSize: 12,
    color: C.onSurfaceVariant,
  },
  latestTitle: {
    fontFamily: 'PlusJakartaSans-SemiBold',
    fontSize: 15,
    color: C.onSurface,
  },
  latestTimeAgo: {
    fontFamily: 'Manrope-Medium',
    fontSize: 12,
    color: C.onSurfaceVariant,
  },

  encryptBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(68, 103, 77, 0.08)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 9999,
    marginTop: 8,
    marginBottom: 8,
    gap: 6,
  },
  encryptBadgeText: {
    fontFamily: 'PlusJakartaSans-SemiBold',
    fontSize: 11,
    color: C.primary,
  },

  /* ---------- Total Usage Card ---------- */
  usageCard: {
    backgroundColor: C.surfaceContainerLowest,
    borderRadius: 32,
    padding: 24,
    marginBottom: 16,
  },
  usageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  usageHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  usageTitle: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 20,
    color: C.onSurface,
  },
  usageSubtitle: {
    fontFamily: 'Manrope-Regular',
    fontSize: 13,
    color: C.onSurfaceVariant,
    marginTop: 2,
  },
  usageHeaderRight: {
    alignItems: 'flex-end',
  },
  usageTimeText: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 22,
    color: C.primary,
    lineHeight: 28,
  },
  usageTrendText: {
    fontFamily: 'Manrope-Medium',
    fontSize: 11,
    color: C.secondary,
    marginTop: 2,
  },
  graphContainer: {
    minHeight: 180,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 16,
  },
  barsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 8,
  },
  pillColumn: {
    alignItems: 'center',
  },
  pillBg: {
    height: 120,
    backgroundColor: C.surfaceContainer,
    borderRadius: 9999,
    justifyContent: 'flex-end',
    overflow: 'hidden',
    marginBottom: 8,
  },
  pillFill: {
    width: '100%',
    borderRadius: 9999,
  },
  barLabel: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 14,
    textAlign: 'center',
  },

  /* ---------- Loading / Empty / Error ---------- */
  centerState: {
    paddingVertical: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 18,
    color: C.onSurface,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyText: {
    fontFamily: 'Manrope-Regular',
    fontSize: 15,
    color: C.onSurfaceVariant,
    textAlign: 'center',
  },
  errorText: {
    fontFamily: 'Manrope-Regular',
    fontSize: 14,
    color: C.error,
    textAlign: 'center',
  },
  retryBtn: {
    marginTop: 16,
    backgroundColor: C.primary,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 9999,
  },
  retryBtnText: {
    fontFamily: 'PlusJakartaSans-SemiBold',
    fontSize: 14,
    color: C.white,
  },

  /* ---------- Spacer ---------- */
  bottomSpacer: {
    height: 130,
  },
} as any);