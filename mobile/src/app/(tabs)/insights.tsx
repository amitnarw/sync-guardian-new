import React from 'react';
import { StyleSheet, View, TouchableOpacity, Text, RefreshControl } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';

import { ThemedView } from '@/components/themed-view';
import { EdgeFadeScrollView } from '@/components/ui/edge-fade';
import { InsightsEmptyState } from '@/components/insights-empty-state';
import { AppIcon } from '@/components/app-icon';
import { useInsightsData, type TimeWindow, type InsightsNotification } from '@/hooks/use-insights-data';
import { useAuthStore } from '@/hooks/use-auth-store';
import { usePairData } from '@/hooks/use-pair-data';
import { useRegisterHeaderRefresh } from '@/contexts/HeaderRefreshContext';
import { InsightsSkeleton } from '@/components/skeletons/insights-skeleton';
import { ChildSelector } from '@/components/ui/child-selector';

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

interface Bucket {
  label: string;
  count: number;
}

function getPeakWindows(notifications: InsightsNotification[]): Bucket[] {
  const b = [
    { label: '12-4AM', count: 0 },
    { label: '4-8AM', count: 0 },
    { label: '8AM-12PM', count: 0 },
    { label: '12-4PM', count: 0 },
    { label: '4-8PM', count: 0 },
    { label: '8PM-12AM', count: 0 },
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

function getTopApps(
  notifications: InsightsNotification[],
  limit = 5,
): { name: string; count: number; icon: string | null; package: string }[] {
  const groups: Record<string, { name: string; count: number; icon: string | null; package: string }> = {};
  for (const n of notifications) {
    const pkg = n.source_package?.trim() || 'unknown';
    if (!groups[pkg]) {
      groups[pkg] = { name: n.source_app_name?.trim() || pkg, count: 0, icon: n.app_icon_base64, package: pkg };
    }
    groups[pkg].count++;
  }
  return Object.values(groups)
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

function generateNarrative(
  notifications: InsightsNotification[],
  window: TimeWindow,
  childLabel: string | null,
): string {
  if (notifications.length === 0) return '';
  const top = getTopApps(notifications, 1);
  const name = top.length > 0 ? top[0].name : 'apps';
  const total = notifications.length;
  const period =
    window === 'today'
      ? 'today'
      : window === 'week'
        ? 'this week'
        : window === 'month'
          ? 'this month'
          : 'this year';
  const peaks = getPeakWindows(notifications);
  const topPeak = peaks.reduce((a, b) => (a.count > b.count ? a : b), peaks[0]);
  const peakLabel = topPeak.count > 1 ? ` Peak hours: ${topPeak.label}.` : '';
  const subject = childLabel ? `${childLabel}'s activity` : 'Activity across children';
  return `${total} notification${total !== 1 ? 's' : ''} ${period}. Most from ${name}.${peakLabel} (${subject}).`;
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
  if (app && title) return `${app} | ${title}`;
  if (app) return app;
  if (title) return title;
  return 'Unknown notification';
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
  const { notifications, isLoading, isRefreshing, error, window, setWindow, refresh, perChildBreakdown } =
    useInsightsData();
  useRegisterHeaderRefresh(refresh);
  const selectedChildId = useAuthStore((s) => s.selectedChildId);
  const setSelectedChildId = useAuthStore((s) => s.setSelectedChildId);
  const { allChildren } = usePairData();

  const showMultiSelector = allChildren.length > 1;
  const isAll = !selectedChildId;
  const selectedChildObj = !isAll
    ? allChildren.find((c) => c.pairId === selectedChildId) ?? null
    : null;
  const childLabel = selectedChildObj?.displayName ?? null;

  const topApps = React.useMemo(() => getTopApps(notifications), [notifications]);
  const narrative = React.useMemo(
    () => generateNarrative(notifications, window, childLabel),
    [notifications, window, childLabel],
  );

  const peakPoints = React.useMemo(() => {
    const data = getPeakWindows(notifications);
    const maxVal = Math.max(...data.map((b) => b.count), 1);
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
          <InsightsSkeleton />
        ) : error ? (
          <View style={s.centerState}>
            <Text style={s.emptyTitle}>Unable to load insights</Text>
            <Text style={s.emptyText}>{error}</Text>
            <TouchableOpacity style={s.retryBtn} onPress={refresh} activeOpacity={0.7}>
              <Text style={s.retryBtnText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : notifications.length === 0 ? (
          <InsightsEmptyState hasPair={allChildren.length > 0} />
        ) : (
          <>
            <View style={s.heroSection}>
              <Text style={s.heroTitle}>Insights</Text>
              <Text style={s.heroDescription}>
                {isAll
                  ? 'See when and how your connected devices are used.'
                  : `See when and how ${childLabel ?? 'this child'}'s device is used.`}
              </Text>
            </View>

            {showMultiSelector && (
              <View style={s.selectorRow}>
                <ChildSelector
                  options={allChildren.map((c) => ({
                    pairId: c.pairId,
                    childDeviceId: c.childDeviceId,
                    displayName: c.displayName,
                    isOnline: c.isOnline,
                  }))}
                  selectedPairId={selectedChildId}
                  onSelect={setSelectedChildId}
                  showAllOption
                  allLabel={`All ${allChildren.length} children`}
                />
              </View>
            )}

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

            <View style={s.pulseCard}>
              <Text style={s.pulseLabel}>
                {isAll ? 'Across all children' : `${childLabel ?? 'this child'}'s activity`}
              </Text>
              <Text style={s.pulseText}>{narrative}</Text>
            </View>

            <View style={s.peakCard}>
              <Text style={s.peakTitle}>Peak Hours</Text>
              <View style={s.chartWrapper}>
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
                  <Path d={paths.fillPath} fill="url(#fillGrad)" />
                  <Path d={paths.strokePath} fill="none" stroke="url(#strokeGrad)" strokeWidth={3} />
                </Svg>
              </View>
              <View style={s.peakXAxisRow}>
                {peakPoints.map((p, i) => {
                  const shortLabel = p.label
                    .replace('12-4AM', '12a')
                    .replace('4-8AM', '4a')
                    .replace('8AM-12PM', '8a')
                    .replace('12-4PM', '12p')
                    .replace('4-8PM', '4p')
                    .replace('8PM-12AM', '8p');
                  return (
                    <Text key={i} style={s.peakXAxisLabel}>
                      {shortLabel}
                    </Text>
                  );
                })}
              </View>
            </View>

            <View style={s.appInsightsCard}>
              <Text style={s.appInsightsTitle}>
                {isAll ? 'Top Apps (all children)' : `Top Apps (${childLabel ?? 'this child'})`}
              </Text>
              {topApps.length > 0 ? (
                topApps.map((app, i) => {
                  const maxCount = topApps[0].count;
                  const barWidth = Math.max((app.count / maxCount) * 100, 2);
                  return (
                    <View key={app.package + i} style={s.appInsightsItem}>
                      <AppIcon iconBase64={app.icon} size={40} fallbackSize={20} />
                      <Text style={s.appInsightsName} numberOfLines={1} ellipsizeMode="tail">
                        {app.name}
                      </Text>
                      <View style={s.appInsightsBarBg}>
                        <View style={[s.appInsightsBarFill, { width: `${barWidth}%` }]} />
                      </View>
                      <Text style={s.appInsightsCount}>{app.count}</Text>
                    </View>
                  );
                })
              ) : (
                <Text style={s.emptyText}>No app activity in this window.</Text>
              )}
            </View>

            {isAll && perChildBreakdown.length > 0 && (
              <View style={s.perChildCard}>
                <Text style={s.appInsightsTitle}>Notifications per child</Text>
                {perChildBreakdown
                  .sort((a, b) => b.count - a.count)
                  .map((entry) => {
                    const max = Math.max(...perChildBreakdown.map((e) => e.count), 1);
                    const barWidth = Math.max((entry.count / max) * 100, 4);
                    return (
                      <View key={entry.pairId} style={s.appInsightsItem}>
                        <View style={s.perChildAvatar}>
                          <Ionicons name="person-outline" size={16} color={C.primary} />
                        </View>
                        <Text style={s.appInsightsName} numberOfLines={1} ellipsizeMode="tail">
                          {entry.displayName || 'Child Device'}
                        </Text>
                        <View style={s.appInsightsBarBg}>
                          <View style={[s.appInsightsBarFill, { width: `${barWidth}%` }]} />
                        </View>
                        <Text style={s.appInsightsCount}>{entry.count}</Text>
                      </View>
                    );
                  })}
              </View>
            )}

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

        <View style={s.bottomSpacer} />
      </EdgeFadeScrollView>
    </ThemedView>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.surface,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 8,
  },

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

  selectorRow: {
    marginBottom: 16,
  },

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

  perChildCard: {
    backgroundColor: C.surfaceContainerLowest,
    borderRadius: 32,
    padding: 24,
    marginBottom: 16,
  },
  perChildAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: C.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },

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

  bottomSpacer: {
    height: 130,
  },
} as any);
