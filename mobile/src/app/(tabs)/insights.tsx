import React, { useMemo } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { ThemedView } from '@/components/themed-view';
import { EdgeFadeScrollView } from '@/components/ui/edge-fade';
import { InsightsEmptyState } from '@/components/insights-empty-state';
import { InsightsSkeleton } from '@/components/skeletons/insights-skeleton';
import { InsightsCardsSkeleton } from '@/components/skeletons/insights-cards-skeleton';
import { InsightsHeader } from '@/components/insights/insights-header';
import { InsightsSummaryCard } from '@/components/insights/insights-summary-card';
import { InsightsNarrative } from '@/components/insights/insights-narrative';
import { InsightsDailyChart } from '@/components/insights/insights-daily-chart';
import { InsightsPeakHours } from '@/components/insights/insights-peak-hours-chart';
import { InsightsCategoryDonut } from '@/components/insights/insights-category-donut';
import { InsightsTopApps } from '@/components/insights/insights-top-apps';
import { InsightsSocialSleep } from '@/components/insights/insights-social-sleep-card';
import { InsightsDayOfWeek } from '@/components/insights/insights-day-of-week';
import { InsightsHeatmap } from '@/components/insights/insights-heatmap';
import { InsightsHighlightsCarousel } from '@/components/insights/insights-highlights-carousel';
import { InsightsNewApps } from '@/components/insights/insights-new-apps';
import { InsightsPerChild } from '@/components/insights/insights-per-child';
import { InsightsLatestNotification } from '@/components/insights/insights-latest-notification';
import { InsightsWindowSelector } from '@/components/insights/insights-window-selector';
import { InsightsEncryptionBadge } from '@/components/insights/insights-encryption-badge';

import { useInsightsData, type InsightsNotification, type NotificationWindow } from '@/hooks/use-insights-data';
import { useAuthStore } from '@/hooks/use-auth-store';
import { usePairData } from '@/hooks/use-pair-data';
import { useRegisterHeaderRefresh } from '@/contexts/HeaderRefreshContext';

import {
  computeSummaryStats,
  computeDailyTrend,
  computePeakHours,
  computeTopApps,
  computeCategoryBreakdown,
  computeDayOfWeek,
  computeSocialMediaStats,
  computeSleepDisruption,
  computeNewApps,
  generateNarrative,
} from '@/lib/notification-analytics';
import { AuthColors, AuthFonts } from '@/constants/auth-theme';

const WINDOW_LABELS: Record<NotificationWindow, string> = {
  today: 'today',
  week: 'this week',
  month: 'this month',
  year: 'this year',
};

function formatTimeAgo(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime();
  if (diff < 60000) return 'Just now';
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function formatLatestTitle(n: InsightsNotification): string {
  const app = n.source_app_name || n.source_package || '';
  const title = n.notification_title || '';
  if (app && title) return `${app} · ${title}`;
  if (app) return app;
  if (title) return title;
  return 'Unknown notification';
}

export default function InsightsScreen() {
  const {
    notifications,
    previousNotifications,
    isLoading,
    isInitializing,
    isRefreshing,
    error,
    window,
    setWindow,
    refresh,
    perChildBreakdown,
    categoryMap,
  } = useInsightsData();

  useRegisterHeaderRefresh(refresh);
  const selectedChildId = useAuthStore((s) => s.selectedChildId);
  const setSelectedChildId = useAuthStore((s) => s.setSelectedChildId);
  const { allChildren } = usePairData();

  const isAll = !selectedChildId;
  const selectedChildObj = !isAll
    ? allChildren.find((c) => c.childUserId === selectedChildId) ?? null
    : null;
  const childLabel = selectedChildObj?.displayName ?? null;

  const childOptions = useMemo(
    () =>
      allChildren.map((c) => ({
        childUserId: c.childUserId,
        pairId: c.pairId,
        childDeviceId: c.childDeviceId,
        displayName: c.displayName,
        isOnline: c.isOnline,
      })),
    [allChildren],
  );

  const headerSubtitle = isAll
    ? 'See when and how your connected devices are used.'
    : `See when and how ${childLabel ?? 'this child'}'s device is used.`;

  const summary = useMemo(
    () =>
      computeSummaryStats({
        current: notifications,
        previous: previousNotifications,
        window,
        catMap: categoryMap,
      }),
    [notifications, previousNotifications, window, categoryMap],
  );

  const dailyTrend = useMemo(
    () => computeDailyTrend(notifications, window),
    [notifications, window],
  );

  const peakBuckets = useMemo(() => computePeakHours(notifications, 6), [notifications]);
  const mostActivePeak = useMemo(
    () => peakBuckets.reduce((max, b) => (b.count > max.count ? b : max), peakBuckets[0]),
    [peakBuckets],
  );

  const topApps = useMemo(
    () => computeTopApps(notifications, categoryMap, 5),
    [notifications, categoryMap],
  );

  const categorySlices = useMemo(
    () => computeCategoryBreakdown(notifications, categoryMap),
    [notifications, categoryMap],
  );

  const dayOfWeek = useMemo(() => computeDayOfWeek(notifications), [notifications]);
  const socialStats = useMemo(
    () => computeSocialMediaStats(notifications, categoryMap),
    [notifications, categoryMap],
  );
  const sleepStats = useMemo(
    () => computeSleepDisruption(notifications, categoryMap),
    [notifications, categoryMap],
  );
  const newApps = useMemo(
    () => computeNewApps(notifications, previousNotifications, categoryMap, 6),
    [notifications, previousNotifications, categoryMap],
  );

  const narrative = useMemo(
    () => generateNarrative(summary, childLabel, window),
    [summary, childLabel, window],
  );

  const latest = notifications[0];

  return (
    <ThemedView style={s.container}>
      <EdgeFadeScrollView
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={refresh}
            colors={[AuthColors.primary]}
            tintColor={AuthColors.primary}
          />
        }
      >
        {isInitializing ? (
          <InsightsSkeleton />
        ) : (
          <>
            {/* Selectors stay mounted across window/child changes so users can
                keep orientation while data re-fetches in the background. */}
            {allChildren.length > 0 && (
              <>
                <InsightsHeader
                  childOptions={childOptions}
                  selectedChildId={selectedChildId}
                  onSelect={setSelectedChildId}
                  subtitle={headerSubtitle}
                  disabled={isLoading || isRefreshing}
                />

                <InsightsWindowSelector
                  window={window}
                  onChange={setWindow}
                  disabled={isLoading || isRefreshing}
                />
              </>
            )}

            {isLoading && !isRefreshing ? (
              <InsightsCardsSkeleton />
            ) : error ? (
              <View style={s.errorState}>
                <View style={s.errorIconWrap}>
                  <Ionicons name="alert-circle-outline" size={32} color={AuthColors.error} />
                </View>
                <Text style={s.errorTitle}>Unable to load insights</Text>
                <Text style={s.errorText}>{error}</Text>
                <TouchableOpacity style={s.retryBtn} onPress={refresh} activeOpacity={0.7}>
                  <Text style={s.retryBtnText}>Retry</Text>
                </TouchableOpacity>
              </View>
            ) : notifications.length === 0 ? (
              <InsightsEmptyState hasPair={allChildren.length > 0} />
            ) : (
              <>
                <InsightsSummaryCard stats={summary} childLabel={childLabel} />

                <InsightsHighlightsCarousel
                  stats={summary}
                  sleep={sleepStats}
                  topApps={topApps}
                />

                <InsightsNarrative text={narrative} childLabel={childLabel} />

                <InsightsDailyChart
                  data={dailyTrend}
                  windowLabel={WINDOW_LABELS[window]}
                />

                <InsightsPeakHours
                  buckets={peakBuckets}
                  mostActiveBucket={mostActivePeak.count > 0 ? mostActivePeak : null}
                />

                <InsightsHeatmap notifications={notifications} />

                {categorySlices.length > 0 ? (
                  <InsightsCategoryDonut slices={categorySlices} total={notifications.length} />
                ) : null}

                <InsightsSocialSleep social={socialStats} sleep={sleepStats} />

                <InsightsTopApps apps={topApps} childLabel={childLabel} />

                <InsightsDayOfWeek buckets={dayOfWeek} />

                {newApps.length > 0 ? <InsightsNewApps newApps={newApps} /> : null}

                {isAll && perChildBreakdown.length > 1 ? (
                  <InsightsPerChild entries={perChildBreakdown} />
                ) : null}

                {latest ? (
                  <View style={{ marginTop: 4 }}>
                    <InsightsLatestNotification
                      appName={latest.source_app_name}
                      iconBase64={latest.app_icon_base64}
                      title={formatLatestTitle(latest)}
                      timeAgo={formatTimeAgo(latest.notification_posted_at)}
                    />
                  </View>
                ) : null}

                <InsightsEncryptionBadge />

                <TouchableOpacity
                  style={s.activityLink}
                  onPress={() => router.push('/(tabs)/activity')}
                  activeOpacity={0.7}
                >
                  <Text style={s.activityLinkText}>Open full activity feed</Text>
                  <Ionicons name="arrow-forward" size={14} color={AuthColors.primary} />
                </TouchableOpacity>
              </>
            )}
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
    backgroundColor: AuthColors.surface,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    gap: 14,
  },
  errorState: {
    paddingVertical: 80,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  errorIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: AuthColors.errorContainer,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  errorTitle: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 18,
    color: AuthColors.onSurface,
    textAlign: 'center',
  },
  errorText: {
    ...AuthFonts.bodyMedium,
    color: AuthColors.onSurfaceVariant,
    textAlign: 'center',
    maxWidth: 280,
  },
  retryBtn: {
    marginTop: 16,
    backgroundColor: AuthColors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 9999,
  },
  retryBtnText: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 14,
    color: AuthColors.onPrimary,
  },
  activityLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    marginTop: 4,
  },
  activityLinkText: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 13,
    color: AuthColors.primary,
  },
  bottomSpacer: {
    height: 130,
  },
});
