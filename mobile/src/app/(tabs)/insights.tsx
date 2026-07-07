import React from 'react';
import { StyleSheet, ScrollView, View, TouchableOpacity, Text, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

import { ThemedView } from '@/components/themed-view';
import { UserAvatar } from '@/components/user-avatar';
import { useInsightsData, type TimeWindow, type InsightsNotification } from '@/hooks/use-insights-data';

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

function getTrendBuckets(notifications: InsightsNotification[], window: TimeWindow): Bucket[] {
  if (notifications.length === 0) return [];
  switch (window) {
    case 'today': {
      const b = [
        { label: '12\u20136AM', count: 0 },
        { label: '6AM\u201312PM', count: 0 },
        { label: '12\u20136PM', count: 0 },
        { label: '6PM\u201312AM', count: 0 },
      ];
      for (const n of notifications) {
        const h = new Date(n.notification_posted_at).getHours();
        if (h < 6) b[0].count++;
        else if (h < 12) b[1].count++;
        else if (h < 18) b[2].count++;
        else b[3].count++;
      }
      return b;
    }
    case 'week': {
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const now = new Date();
      const b: Bucket[] = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date(now);
        d.setDate(d.getDate() - (6 - i));
        b.push({ label: days[d.getDay()], count: 0 });
      }
      const nowMidnight = new Date(now);
      nowMidnight.setHours(0, 0, 0, 0);
      for (const n of notifications) {
        const postDate = new Date(n.notification_posted_at);
        const postMidnight = new Date(postDate);
        postMidnight.setHours(0, 0, 0, 0);
        const diffDays = Math.floor((nowMidnight.getTime() - postMidnight.getTime()) / (24 * 60 * 60 * 1000));
        if (diffDays >= 0 && diffDays < 7) b[6 - diffDays].count++;
      }
      return b;
    }
    case 'month': {
      const now = new Date();
      const startMs = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
      const b = [
        { label: 'Wk 1', count: 0 },
        { label: 'Wk 2', count: 0 },
        { label: 'Wk 3', count: 0 },
        { label: 'Wk 4', count: 0 },
      ];
      for (const n of notifications) {
        const daysSinceStart = Math.floor((new Date(n.notification_posted_at).getTime() - startMs) / (24 * 60 * 60 * 1000));
        b[Math.min(3, Math.floor(daysSinceStart / 7))].count++;
      }
      return b;
    }
    case 'year': {
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const b = months.map(label => ({ label, count: 0 }));
      for (const n of notifications) {
        b[new Date(n.notification_posted_at).getMonth()].count++;
      }
      return b;
    }
  }
}

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

function getTopApps(notifications: InsightsNotification[], limit = 5): { name: string; count: number }[] {
  const groups: Record<string, number> = {};
  for (const n of notifications) {
    const name = n.source_app_name?.trim() || n.source_package?.trim() || 'Unknown';
    groups[name] = (groups[name] || 0) + 1;
  }
  return Object.entries(groups).sort((a, b) => b[1] - a[1]).slice(0, limit).map(([name, count]) => ({ name, count }));
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
  return `${total} signal${total !== 1 ? 's' : ''} ${period}. Most from ${name}.${peakLabel}`;
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
  if (notifications.length === 0) return 'No signals yet';
  const n = notifications[0];
  const app = n.source_app_name || n.source_package || '';
  const title = n.notification_title || '';
  if (app && title) return `${app} \u2014 ${title}`;
  if (app) return app;
  if (title) return title;
  return 'Unknown signal';
}

export default function InsightsScreen() {
  const { notifications, isLoading, error, window, setWindow, refresh } = useInsightsData();

  const trendBuckets = React.useMemo(() => getTrendBuckets(notifications, window), [notifications, window]);
  const peakWindowsData = React.useMemo(() => getPeakWindows(notifications), [notifications]);
  const topApps = React.useMemo(() => getTopApps(notifications), [notifications]);
  const narrative = React.useMemo(() => generateNarrative(notifications, window), [notifications, window]);

  return (
    <ThemedView style={s.container}>
      <SafeAreaView style={s.safeArea} edges={['top']}>
        {/* Floating Glass Header */}
        <View style={s.header}>
          <View style={s.headerLeft}>
            <MaterialCommunityIcons name="spa" size={24} color={C.primary} style={s.headerIcon} />
            <Text style={s.headerTitle}>Nurturing Atelier</Text>
          </View>
          <View style={s.headerRight}>
            <UserAvatar
              fallbackSource={require('@/assets/images/mother_avatar.jpg')}
              role="parent"
            />
          </View>
        </View>

        <ScrollView
          contentContainerStyle={s.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {isLoading ? (
            <View style={s.centerState}>
              <ActivityIndicator size="large" color={C.primary} />
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
            <View style={s.centerState}>
              <Text style={s.emptyTitle}>No signals yet</Text>
              <Text style={s.emptyText}>
                Activity will appear here once{'\n'}notifications are received on the{'\n'}child device.
              </Text>
            </View>
          ) : (
            <>
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
                <Text style={s.pulseLabel}>Signal Pulse</Text>
                <Text style={s.pulseText}>{narrative}</Text>
              </View>

              {/* Activity Trend */}
              <View style={s.trendCard}>
                <Text style={s.trendTitle}>Activity Trend</Text>
                <View style={s.trendBarsRow}>
                  {trendBuckets.map((bucket, i) => {
                    const maxVal = Math.max(...trendBuckets.map(b => b.count), 1);
                    const barHeight = Math.max((bucket.count / maxVal) * 100, 4);
                    return (
                      <View key={i} style={{ flex: 1, alignItems: 'center' }}>
                        <Text style={s.trendBarCount}>{bucket.count}</Text>
                        <View style={[s.trendBar, { height: barHeight }]} />
                        <Text style={s.trendBarLabel}>{bucket.label}</Text>
                      </View>
                    );
                  })}
                </View>
              </View>

              {/* Peak Activity Windows */}
              <View style={s.peakCard}>
                <Text style={s.peakTitle}>Peak Hours</Text>
                {peakWindowsData.map((bucket, i) => {
                  const maxVal = Math.max(...peakWindowsData.map(b => b.count), 1);
                  const barWidth = Math.max((bucket.count / maxVal) * 100, 2);
                  return (
                    <View key={i} style={s.peakRow}>
                      <Text style={s.peakLabel}>{bucket.label}</Text>
                      <View style={s.peakBarBg}>
                        <View style={[s.peakBarFill, { width: `${barWidth}%` }]} />
                      </View>
                      <Text style={s.peakBarCount}>{bucket.count}</Text>
                    </View>
                  );
                })}
              </View>

              {/* App Insights */}
              <View style={s.appInsightsCard}>
                <Text style={s.appInsightsTitle}>App Insights</Text>
                {topApps.length > 0 ? topApps.map((app, i) => {
                  const maxCount = topApps[0].count;
                  const barWidth = Math.max((app.count / maxCount) * 100, 2);
                  return (
                    <View key={i} style={s.appInsightsItem}>
                      <View style={s.appInsightsIconWrap}>
                        <Ionicons name="apps-outline" size={20} color={C.primary} />
                      </View>
                      <Text style={s.appInsightsName} numberOfLines={1}>{app.name}</Text>
                      <View style={s.appInsightsBarBg}>
                        <View style={[s.appInsightsBarFill, { width: `${barWidth}%` }]} />
                      </View>
                      <Text style={s.appInsightsCount}>{app.count}</Text>
                    </View>
                  );
                }) : null}
              </View>

              {/* Latest Signal */}
              <View style={s.latestCard}>
                <View style={s.latestIcon}>
                  <Ionicons name="notifications" size={20} color={C.primary} />
                </View>
                <View style={s.latestTextWrap}>
                  <Text style={s.latestLabel}>Latest Signal</Text>
                  <Text style={s.latestTitle} numberOfLines={1}>
                    {formatLatestSignal(notifications)}
                  </Text>
                </View>
                <Text style={s.latestTimeAgo}>
                  {formatTimeAgo(notifications[0]?.notification_posted_at || '')}
                </Text>
              </View>
            </>
          )}

          {/* Spacer to avoid bottom custom tab bar overlay */}
          <View style={s.bottomSpacer} />
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

// ============================================================
// STYLES — mapped precisely from Stitch Tailwind
// ============================================================
const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.surface,
  },
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 8,
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: 'rgba(255,248,240,0.80)',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerIcon: {
    marginRight: 2,
  },
  headerTitle: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 18,
    lineHeight: 24,
    color: C.primary,
    letterSpacing: -0.5,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
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

  /* ---------- Activity Trend Card ---------- */
  trendCard: {
    backgroundColor: C.surfaceContainerLowest,
    borderRadius: 32,
    padding: 24,
    marginBottom: 16,
  },
  trendTitle: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 18,
    color: C.onSurface,
    marginBottom: 16,
  },
  trendBarsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 120,
    gap: 4,
  },
  trendBar: {
    flex: 1,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    backgroundColor: C.primary,
    minHeight: 2,
  },
  trendBarLabel: {
    fontFamily: 'Manrope-Medium',
    fontSize: 10,
    color: C.onSurfaceVariant,
    textAlign: 'center',
    marginTop: 6,
  },
  trendBarCount: {
    fontFamily: 'Manrope-Medium',
    fontSize: 10,
    color: C.onSurface,
    textAlign: 'center',
    marginBottom: 2,
  },

  /* ---------- Peak Hours Card ---------- */
  peakCard: {
    backgroundColor: C.surfaceContainerLowest,
    borderRadius: 32,
    padding: 24,
    marginBottom: 16,
  },
  peakTitle: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 18,
    color: C.onSurface,
    marginBottom: 16,
  },
  peakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 12,
  },
  peakLabel: {
    fontFamily: 'Manrope-Medium',
    fontSize: 13,
    color: C.onSurfaceVariant,
    width: 105,
  },
  peakBarBg: {
    flex: 1,
    height: 20,
    borderRadius: 6,
    backgroundColor: C.surfaceContainer,
    overflow: 'hidden',
  },
  peakBarFill: {
    height: '100%',
    borderRadius: 6,
    backgroundColor: C.secondary,
  },
  peakBarCount: {
    fontFamily: 'PlusJakartaSans-SemiBold',
    fontSize: 12,
    color: C.onSurface,
    width: 32,
    textAlign: 'right',
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
    width: 100,
  },
  appInsightsBarBg: {
    flex: 1,
    height: 16,
    borderRadius: 4,
    backgroundColor: C.surfaceContainer,
    overflow: 'hidden',
  },
  appInsightsBarFill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: C.primary,
  },
  appInsightsCount: {
    fontFamily: 'PlusJakartaSans-SemiBold',
    fontSize: 12,
    color: C.onSurfaceVariant,
    width: 32,
    textAlign: 'right',
  },

  /* ---------- Latest Signal Card ---------- */
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
});