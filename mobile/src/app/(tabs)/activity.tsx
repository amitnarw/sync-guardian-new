import React, { useRef, useMemo, useEffect, useState, useCallback } from 'react';
import { StyleSheet, View, Text, RefreshControl, TouchableOpacity, ScrollView, TextInput, Modal, Pressable, ActivityIndicator, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, RadialGradient, Stop, Rect } from 'react-native-svg';
import { ThemedView } from '@/components/themed-view';
import { EdgeFadeScrollView } from '@/components/ui/edge-fade';
import { usePairData } from '@/hooks/use-pair-data';
import { AppIcon } from '@/components/app-icon';
import { NotificationSourceCard } from '@/components/notification-source-card';
import { useRegisterHeaderRefresh } from '@/contexts/HeaderRefreshContext';
import { ActivitySkeleton } from '@/components/skeletons/activity-skeleton';
import { OfflineBanner } from '@/components/ui/offline-banner';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { useAuthStore } from '@/hooks/use-auth-store';
import { fetchParentNotifications, fetchMoreNotificationsOlderThan, type AggregatedNotification, type ChildRef, type MoreNotificationsCursor } from '@/services/notifications-service';
import { getSourceTheme } from '@/constants/source-app-themes';

const C = {
  primary: '#2f4a37',
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
  primaryDeep: '#2f4a37',
} as const;

type Group = {
  child: ChildRef | null;
  items: AggregatedNotification[];
};

export default function ActivityScreen() {
  const { allChildren, refresh, isRefreshing: pairIsRefreshing } = usePairData();
  const selectedChildId = useAuthStore((s) => s.selectedChildId);
  const setSelectedChildId = useAuthStore((s) => s.setSelectedChildId);
  const deviceId = useAuthStore((s) => s.deviceId);

  const [aggregated, setAggregated] = useState<AggregatedNotification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<MoreNotificationsCursor | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [scrollY, setScrollY] = useState(0);

  const allChildrenKey = allChildren.map((c) => c.childUserId).join(',');
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const load = useCallback(
    async (isRefresh = false) => {
      if (!deviceId) return;
      if (isRefresh) setIsRefreshing(true);
      else setIsLoading(true);
      setError(null);
      try {
        const result = await fetchParentNotifications({
          parentDeviceId: deviceId,
          selectedChildId,
          limit: 50,
        });
        setAggregated(result.notifications);
        setHasMore(result.notifications.length >= 50);
        setNextCursor(
          result.notifications.length >= 50 && result.notifications.length > 0
            ? {
                before: result.notifications[result.notifications.length - 1].notification_posted_at,
                beforeId: result.notifications[result.notifications.length - 1].id,
              }
            : null,
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load activity');
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [deviceId, selectedChildId],
  );

  useEffect(() => {
    load(false);
  }, [load, allChildrenKey]);

  const loadMoreRequestIdRef = useRef(0);
  const loadMore = useCallback(async () => {
    if (!deviceId || aggregated.length === 0 || isLoadingMore || !hasMore || !nextCursor) return;
    const requestId = ++loadMoreRequestIdRef.current;
    const expectedSelection = selectedChildId;
    setIsLoadingMore(true);
    try {
      const result = await fetchMoreNotificationsOlderThan({
        parentDeviceId: deviceId,
        selectedChildId: expectedSelection,
        cursor: nextCursor,
      });
      // Discard stale result if the user switched selection while the
      // request was in flight.
      if (requestId !== loadMoreRequestIdRef.current) return;
      if (!mountedRef.current) return;
      const currentSelection = useAuthStore.getState().selectedChildId;
      if (currentSelection !== expectedSelection) return;
      if (result.notifications.length === 0) {
        setHasMore(false);
        setNextCursor(null);
      } else {
        setAggregated((prev) => [...prev, ...result.notifications]);
        setHasMore(result.hasMore);
        setNextCursor(result.nextCursor);
      }
    } catch {
      if (requestId === loadMoreRequestIdRef.current && mountedRef.current) {
        setHasMore(false);
        setNextCursor(null);
      }
    } finally {
      if (requestId === loadMoreRequestIdRef.current && mountedRef.current) {
        setIsLoadingMore(false);
      }
    }
  }, [aggregated, deviceId, selectedChildId, isLoadingMore, hasMore, nextCursor]);

  const doRefresh = useCallback(async () => {
    await Promise.all([load(true), refresh()]);
  }, [load, refresh]);
  useRegisterHeaderRefresh(doRefresh);

  const [firstIconY, setFirstIconY] = useState<number | null>(null);
  const [lastIconY, setLastIconY] = useState<number | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPackage, setSelectedPackage] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<'all' | 'custom'>('all');
  const [showChildSelector, setShowChildSelector] = useState(false);
  const [showAppSelector, setShowAppSelector] = useState(false);
  const [showDateSelector, setShowDateSelector] = useState(false);

  const [customStartDate, setCustomStartDate] = useState<Date | null>(null);
  const [customEndDate, setCustomEndDate] = useState<Date | null>(null);
  const [customStartTime, setCustomStartTime] = useState('00:00');
  const [customEndTime, setCustomEndTime] = useState('23:59');

  const openAppDropdown = () => {
    setShowAppSelector(true);
    setShowChildSelector(false);
    setShowDateSelector(false);
  };

  const openDateDropdown = () => {
    setShowDateSelector(true);
    setShowChildSelector(false);
    setShowAppSelector(false);
  };

  const uniqueApps = useMemo(() => {
    const appsMap = new Map<string, { name: string; icon: string | null; count: number }>();
    for (const n of aggregated) {
      const pkg = n.source_package;
      if (pkg) {
        const existing = appsMap.get(pkg);
        if (existing) {
          existing.count++;
        } else {
          appsMap.set(pkg, {
            name: n.source_app_name || pkg,
            icon: n.app_icon_base64,
            count: 1,
          });
        }
      }
    }
    return Array.from(appsMap.entries()).map(([pkg, data]) => ({
      package: pkg,
      name: data.name,
      icon: data.icon,
      count: data.count,
    })).sort((a, b) => b.count - a.count);
  }, [aggregated]);

  const filters = useMemo(
    () => ({
      searchQuery,
      selectedPackage,
      dateRange,
      customStartDate,
      customEndDate,
      customStartTime,
      customEndTime,
    }),
    [
      searchQuery,
      selectedPackage,
      dateRange,
      customStartDate,
      customEndDate,
      customStartTime,
      customEndTime,
    ],
  );

  const passesFilters = useCallback(
    (n: AggregatedNotification) => {
      const matchesApp = !filters.selectedPackage || n.source_package === filters.selectedPackage;
      const matchesSearch =
        !filters.searchQuery ||
        (n.notification_title || '').toLowerCase().includes(filters.searchQuery.toLowerCase()) ||
        (n.notification_body || '').toLowerCase().includes(filters.searchQuery.toLowerCase()) ||
        (n.source_app_name || '').toLowerCase().includes(filters.searchQuery.toLowerCase());

      let matchesDate = true;
      if (filters.dateRange === 'custom') {
        const postedDate = new Date(n.notification_posted_at);
        let startBound: Date | null = null;
        if (filters.customStartDate) {
          startBound = new Date(filters.customStartDate);
          const [sh, sm] = filters.customStartTime.split(':').map(Number);
          startBound.setHours(isNaN(sh) ? 0 : sh, isNaN(sm) ? 0 : sm, 0, 0);
        }
        let endBound: Date | null = null;
        if (filters.customEndDate) {
          endBound = new Date(filters.customEndDate);
          const [eh, em] = filters.customEndTime.split(':').map(Number);
          endBound.setHours(isNaN(eh) ? 23 : eh, isNaN(em) ? 59 : em, 59, 999);
        } else if (filters.customStartDate) {
          endBound = new Date(filters.customStartDate);
          const [eh, em] = filters.customEndTime.split(':').map(Number);
          endBound.setHours(isNaN(eh) ? 23 : eh, isNaN(em) ? 59 : em, 59, 999);
        }
        if (startBound && postedDate < startBound) matchesDate = false;
        if (endBound && postedDate > endBound) matchesDate = false;
      }
      return matchesApp && matchesSearch && matchesDate;
    },
    [filters],
  );

  const filtered = useMemo(() => aggregated.filter(passesFilters), [aggregated, passesFilters]);

  const isAllMode = !selectedChildId;
  const groups: Group[] = useMemo(() => {
    if (!isAllMode) {
      return [{ child: null, items: filtered }];
    }
    const byChild = new Map<string, Group>();
    for (const n of filtered) {
      const key = n.child_user_id;
      let entry = byChild.get(key);
      if (!entry) {
        entry = { child: n.child, items: [] };
        byChild.set(key, entry);
      }
      entry.items.push(n);
    }
    return allChildren
      .map((c) => byChild.get(c.childUserId))
      .filter((g): g is Group => !!g);
  }, [filtered, isAllMode, allChildren]);

  const selectedChild = useMemo(
    () => allChildren.find((c) => c.childUserId === selectedChildId) ?? null,
    [allChildren, selectedChildId],
  );
  const heroDescription = (() => {
    if (allChildren.length === 0) {
      return 'Pair a child device to start mirroring notifications.';
    }
    if (selectedChild) {
      const name = selectedChild.displayName || 'this child';
      return `Every notification mirrored from ${name}, in one timeline.`;
    }
    if (isAllMode) {
      return `Every notification mirrored from your ${allChildren.length} connected devices, in one timeline.`;
    }
    return 'Every notification mirrored from your connected devices, in one timeline.';
  })();

  return (
    <ThemedView style={s.container}>
      <EdgeFadeScrollView
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
        onScroll={(e) => setScrollY(e.nativeEvent.contentOffset.y)}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl refreshing={isRefreshing || pairIsRefreshing} onRefresh={doRefresh} colors={[C.primary]} tintColor={C.primary} />
        }
      >
        <View style={s.heroSection}>
          <LinearGradient
            colors={[C.primaryDeep, C.primary]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
          <Svg style={StyleSheet.absoluteFillObject} width="100%" height="100%">
            <Defs>
              <RadialGradient id="heroGlow" cx="82%" cy="12%" r="65%">
                <Stop offset="0%" stopColor={C.primaryContainer} stopOpacity={0.5} />
                <Stop offset="100%" stopColor={C.primaryContainer} stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Rect x="0" y="0" width="100%" height="100%" fill="url(#heroGlow)" />
          </Svg>
          <LinearGradient
            colors={['rgba(255,255,255,0.14)', 'rgba(255,255,255,0)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />

          <View style={s.heroContent}>
            <Text style={s.heroTitle}>Activity</Text>
            <Text style={s.heroDescription}>{heroDescription}</Text>
          </View>
        </View>

        <View style={s.encryptBadge}>
          <Ionicons name="shield-checkmark" size={14} color={C.primary} />
          <Text style={s.encryptBadgeText}>All notification contents are securely encrypted at rest</Text>
        </View>

        <Text style={s.sectionTitle}>Recent Activity</Text>

        {!isLoading && aggregated.length > 0 && (
          <View style={{ zIndex: 100, position: 'relative' }}>
            <View style={s.filterBarContainer}>
              <View style={s.searchBar}>
                <Ionicons name="search-outline" size={18} color={C.onSurfaceVariant} style={s.searchIcon} />
                <TextInput
                  style={s.searchInput}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder="Search notifications..."
                  placeholderTextColor={C.onSurfaceVariant}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setSearchQuery('')} activeOpacity={0.7} style={s.searchClear}>
                    <Ionicons name="close-circle" size={18} color={C.outline} />
                  </TouchableOpacity>
                )}
              </View>

              {allChildren.length > 0 && (
                <TouchableOpacity
                  style={[s.filterTriggerBtn, selectedChildId && s.filterTriggerBtnActive]}
                  onPress={() => {
                    setShowChildSelector(true);
                    setShowAppSelector(false);
                    setShowDateSelector(false);
                  }}
                  activeOpacity={0.7}
                >
                  <Ionicons name="people-outline" size={20} color={selectedChildId ? C.white : C.primary} />
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[s.filterTriggerBtn, selectedPackage && s.filterTriggerBtnActive]}
                onPress={openAppDropdown}
                activeOpacity={0.7}
              >
                <Ionicons name="apps-outline" size={20} color={selectedPackage ? C.white : C.primary} />
              </TouchableOpacity>

              <TouchableOpacity
                style={[s.filterTriggerBtn, dateRange !== 'all' && s.filterTriggerBtnActive]}
                onPress={openDateDropdown}
                activeOpacity={0.7}
              >
                <Ionicons name="calendar-outline" size={20} color={dateRange !== 'all' ? C.white : C.primary} />
              </TouchableOpacity>
            </View>

            {/* ========== CHILD FILTER BOTTOM SHEET ========== */}
            <Modal
              visible={showChildSelector}
              transparent
              animationType="slide"
              onRequestClose={() => setShowChildSelector(false)}
            >
              <View style={s.modalBackdrop}>
                <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setShowChildSelector(false)} />
                <View style={s.bottomSheetContainer}>
                  <View style={s.sheetHandle} />
                  <View style={s.sheetHeader}>
                    <View>
                      <Text style={s.sheetTitle}>Filter by Child Device</Text>
                      <Text style={s.sheetSubtitle}>Choose a child to view their activity</Text>
                    </View>
                    <TouchableOpacity
                      style={s.sheetCloseBtn}
                      onPress={() => setShowChildSelector(false)}
                      hitSlop={8}
                    >
                      <Ionicons name="close" size={20} color={C.onSurface} />
                    </TouchableOpacity>
                  </View>
                  <ScrollView style={s.sheetList} showsVerticalScrollIndicator={false} contentContainerStyle={s.sheetListContent}>
                    <TouchableOpacity
                      style={[s.sheetAppRow, !selectedChildId && s.sheetAppRowActive]}
                      onPress={() => {
                        setSelectedChildId(null);
                        setShowChildSelector(false);
                      }}
                      activeOpacity={0.7}
                    >
                      <View style={[s.sheetAppIconWrap, { backgroundColor: C.primaryContainer }]}>
                        <Ionicons name="people" size={20} color={C.primary} />
                      </View>
                      <View style={s.sheetAppDetails}>
                        <Text style={[s.sheetAppName, !selectedChildId && s.sheetAppNameActive]}>All Children</Text>
                        <Text style={s.sheetAppSub}>View activity across all {allChildren.length} devices</Text>
                      </View>
                      {!selectedChildId && (
                        <Ionicons name="checkmark-circle" size={22} color={C.primary} />
                      )}
                    </TouchableOpacity>
                    {allChildren.map((c) => {
                      const isSelected = selectedChildId === c.childUserId;
                      return (
                        <TouchableOpacity
                          key={c.pairId}
                          style={[s.sheetAppRow, isSelected && s.sheetAppRowActive]}
                          onPress={() => {
                            setSelectedChildId(c.childUserId);
                            setShowChildSelector(false);
                          }}
                          activeOpacity={0.7}
                        >
                          <Image
                            source={require('@/assets/images/leo_avatar.jpg')}
                            style={s.sheetChildAvatar}
                          />
                          <View style={s.sheetAppDetails}>
                            <Text style={[s.sheetAppName, isSelected && s.sheetAppNameActive]} numberOfLines={1}>
                              {c.displayName || 'Child Device'}
                            </Text>
                            <View style={s.sheetChildStatusRow}>
                              <View style={[s.statusDotSmall, { backgroundColor: c.isOnline ? '#31A24C' : C.outline }]} />
                              <Text style={s.sheetAppSub}>{c.isOnline ? 'Online' : 'Offline'}</Text>
                            </View>
                          </View>
                          {isSelected && (
                            <Ionicons name="checkmark-circle" size={22} color={C.primary} />
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              </View>
            </Modal>

            <Modal
              visible={showAppSelector}
              transparent
              animationType="slide"
              onRequestClose={() => setShowAppSelector(false)}
            >
              <View style={s.modalBackdrop}>
                <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setShowAppSelector(false)} />
                <View style={s.bottomSheetContainer}>
                  {/* Drag Handle */}
                  <View style={s.sheetHandle} />

                  {/* Header */}
                  <View style={s.sheetHeader}>
                    <View>
                      <Text style={s.sheetTitle}>Filter by Application</Text>
                      <Text style={s.sheetSubtitle}>Choose an app to narrow down activity</Text>
                    </View>
                    <TouchableOpacity
                      style={s.sheetCloseBtn}
                      onPress={() => setShowAppSelector(false)}
                      hitSlop={8}
                    >
                      <Ionicons name="close" size={20} color={C.onSurface} />
                    </TouchableOpacity>
                  </View>

                  {/* List */}
                  <ScrollView style={s.sheetList} showsVerticalScrollIndicator={false} contentContainerStyle={s.sheetListContent}>
                    {/* All Apps Option */}
                    <TouchableOpacity
                      style={[s.sheetAppRow, !selectedPackage && s.sheetAppRowActive]}
                      onPress={() => {
                        setSelectedPackage(null);
                        setShowAppSelector(false);
                      }}
                      activeOpacity={0.7}
                    >
                      <View style={[s.sheetAppIconWrap, { backgroundColor: C.primaryContainer }]}>
                        <Ionicons name="apps" size={22} color={C.primary} />
                      </View>
                      <View style={s.sheetAppDetails}>
                        <Text style={[s.sheetAppName, !selectedPackage && s.sheetAppNameActive]}>All Applications</Text>
                        <Text style={s.sheetAppSub}>Show all {aggregated.length} notifications</Text>
                      </View>
                      {!selectedPackage ? (
                        <Ionicons name="checkmark-circle" size={22} color={C.primary} />
                      ) : (
                        <View style={s.sheetBadge}>
                          <Text style={s.sheetBadgeText}>{aggregated.length}</Text>
                        </View>
                      )}
                    </TouchableOpacity>

                    {/* App Rows */}
                    {uniqueApps.map((app) => {
                      const isSelected = selectedPackage === app.package;
                      return (
                        <TouchableOpacity
                          key={app.package}
                          style={[s.sheetAppRow, isSelected && s.sheetAppRowActive]}
                          onPress={() => {
                            setSelectedPackage(app.package);
                            setShowAppSelector(false);
                          }}
                          activeOpacity={0.7}
                        >
                          <AppIcon iconBase64={app.icon} size={36} fallbackSize={16} />
                          <View style={s.sheetAppDetails}>
                            <Text style={[s.sheetAppName, isSelected && s.sheetAppNameActive]} numberOfLines={1}>
                              {app.name}
                            </Text>
                            <Text style={s.sheetAppSub}>
                              {app.count} {app.count === 1 ? 'notification' : 'notifications'}
                            </Text>
                          </View>
                          {isSelected ? (
                            <Ionicons name="checkmark-circle" size={22} color={C.primary} />
                          ) : (
                            <View style={s.sheetBadge}>
                              <Text style={s.sheetBadgeText}>{app.count}</Text>
                            </View>
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              </View>
            </Modal>

            <DateRangePicker
              visible={showDateSelector}
              onClose={() => setShowDateSelector(false)}
              startDate={customStartDate}
              endDate={customEndDate}
              startTime={customStartTime}
              endTime={customEndTime}
              onApply={(start, end, startTime, endTime) => {
                setCustomStartDate(start);
                setCustomEndDate(end);
                setCustomStartTime(startTime);
                setCustomEndTime(endTime);
                setDateRange('custom');
                setShowDateSelector(false);
              }}
              onReset={() => {
                setCustomStartDate(null);
                setCustomEndDate(null);
                setCustomStartTime('00:00');
                setCustomEndTime('23:59');
                setDateRange('all');
                setShowDateSelector(false);
              }}
            />
          </View>
        )}

        {isLoading ? (
          <ActivitySkeleton />
        ) : error && aggregated.length === 0 ? (
          <View style={{ paddingVertical: 16 }}>
            <OfflineBanner onRetry={doRefresh} message={error} />
          </View>
        ) : aggregated.length === 0 ? (
          <View style={{ padding: 32, alignItems: 'center' }}>
            <Ionicons name="notifications-off-outline" size={40} color={C.outline} />
            <Text style={{ fontFamily: 'PlusJakartaSans-Medium', fontSize: 14, color: C.outline, marginTop: 12 }}>
              {allChildren.length === 0 ? 'No device paired yet' : 'No notifications yet'}
            </Text>
          </View>
        ) : filtered.length === 0 ? (
          <View style={{ padding: 48, alignItems: 'center' }}>
            <Ionicons name="search-outline" size={40} color={C.outline} />
            <Text style={{ fontFamily: 'PlusJakartaSans-Medium', fontSize: 15, color: C.outline, marginTop: 12, textAlign: 'center' }}>
              No notifications match your filters
            </Text>
            <TouchableOpacity
              onPress={() => {
                setSearchQuery('');
                setSelectedPackage(null);
                setCustomStartDate(null);
                setCustomEndDate(null);
                setCustomStartTime('00:00');
                setCustomEndTime('23:59');
                setDateRange('all');
              }}
              activeOpacity={0.7}
              style={{ marginTop: 16, backgroundColor: C.primary, paddingHorizontal: 20, paddingVertical: 8, borderRadius: 9999 }}
            >
              <Text style={{ fontFamily: 'PlusJakartaSans-Bold', fontSize: 13, color: C.white }}>Reset Filters</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View>
            {groups.map((group) => (
              <ChildGroupSection
                key={group.child?.pairId ?? 'single'}
                group={group}
                firstIconY={group === groups[0] ? firstIconY : null}
                lastIconY={group === groups[groups.length - 1] ? lastIconY : null}
                setFirstIconY={group === groups[0] ? setFirstIconY : () => undefined}
                setLastIconY={group === groups[groups.length - 1] ? setLastIconY : () => undefined}
                isFirstGroup={group === groups[0]}
                isLastGroup={group === groups[groups.length - 1]}
                scrollY={scrollY}
              />
            ))}
            {hasMore && (!selectedPackage || filtered.length >= 50) ? (
              <View style={s.loadMoreSection}>
                <TouchableOpacity
                  onPress={loadMore}
                  disabled={isLoadingMore}
                  activeOpacity={0.7}
                  style={s.premiumLoadMoreBtn}
                >
                  {isLoadingMore ? (
                    <ActivityIndicator size="small" color={C.primary} style={{ marginRight: 4 }} />
                  ) : (
                    <Ionicons name="arrow-down-circle-outline" size={16} color={C.primary} />
                  )}
                  <Text style={s.loadMoreTitle}>
                    {isLoadingMore ? 'Loading Older Activity...' : 'Load Older Activity'}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : filtered.length > 0 ? (
              <View style={s.caughtUpContainer}>
                <View style={s.caughtUpCard}>
                  <Ionicons name="checkmark-done" size={15} color={C.primary} />
                  <Text style={s.caughtUpHeading}>{"You're all caught up"}</Text>
                </View>
              </View>
            ) : null}
          </View>
        )}

        <View style={s.bottomSpacer} />
      </EdgeFadeScrollView>
    </ThemedView>
  );
}

interface ChildGroupSectionProps {
  group: Group;
  firstIconY: number | null;
  lastIconY: number | null;
  setFirstIconY: (y: number | null) => void;
  setLastIconY: (y: number | null) => void;
  isFirstGroup: boolean;
  isLastGroup: boolean;
  scrollY: number;
}

function interpolateRgb(hex1: string, hex2: string, ratio: number): string {
  const f = Math.max(0, Math.min(1, ratio));
  const parseHex = (hex: string) => {
    let clean = hex.replace('#', '');
    if (clean.length === 3) {
      clean = clean.split('').map((c) => c + c).join('');
    }
    const num = parseInt(clean, 16);
    if (isNaN(num)) return { r: 47, g: 74, b: 55 };
    return {
      r: (num >> 16) & 255,
      g: (num >> 8) & 255,
      b: num & 255,
    };
  };

  const c1 = parseHex(hex1);
  const c2 = parseHex(hex2);
  const r = Math.round(c1.r + (c2.r - c1.r) * f);
  const g = Math.round(c1.g + (c2.g - c1.g) * f);
  const b = Math.round(c1.b + (c2.b - c1.b) * f);
  return `rgb(${r}, ${g}, ${b})`;
}

function ChildGroupSection({
  group,
  firstIconY,
  lastIconY,
  setFirstIconY,
  setLastIconY,
  isFirstGroup,
  isLastGroup,
  scrollY,
}: ChildGroupSectionProps) {
  const { items } = group;
  const [iconYMap, setIconYMap] = useState<Record<number, number>>({});

  // Active scroll tracking & bead position
  const activeData = useMemo(() => {
    if (items.length === 0) return null;
    const firstY = iconYMap[0] ?? (firstIconY ?? 22);
    const lastY = iconYMap[items.length - 1] ?? (lastIconY ?? 22);

    // Initial position before user scrolls: bead stays precisely at first icon
    const scrollDistance = Math.max(0, scrollY);
    const clampedBeamY = Math.min(lastY, firstY + scrollDistance);

    // Find the segment [i, i+1] that currently contains clampedBeamY
    let currentColor = getSourceTheme(items[0]?.source_package).accent;

    for (let i = 0; i < items.length - 1; i++) {
      const y1 = iconYMap[i];
      const y2 = iconYMap[i + 1];
      if (y1 !== undefined && y2 !== undefined && y2 > y1) {
        if (clampedBeamY >= y1 && clampedBeamY <= y2) {
          const ratio = (clampedBeamY - y1) / (y2 - y1);
          const c1 = getSourceTheme(items[i].source_package).accent;
          const c2 = getSourceTheme(items[i + 1].source_package).accent;
          currentColor = interpolateRgb(c1, c2, ratio);
          break;
        } else if (clampedBeamY > y2) {
          currentColor = getSourceTheme(items[i + 1]?.source_package).accent;
        }
      }
    }

    return {
      beamY: clampedBeamY,
      firstY,
      lastY,
      currentColor,
      isScrolled: scrollDistance > 4,
    };
  }, [items, iconYMap, scrollY, firstIconY, lastIconY]);

  // Compute filled connecting segments (ONLY above the bead)
  const filledSegments = useMemo(() => {
    if (items.length < 2 || !activeData || !activeData.isScrolled) return [];
    const segs: {
      key: string;
      top: number;
      height: number;
      colors: [string, string];
    }[] = [];

    const { beamY } = activeData;

    for (let i = 0; i < items.length - 1; i++) {
      const y1 = iconYMap[i];
      const y2 = iconYMap[i + 1];
      if (y1 === undefined || y2 === undefined || y2 <= y1) continue;

      // If beam hasn't reached this segment yet, keep it muted (do not render colored overlay)
      if (beamY <= y1) break;

      const c1 = getSourceTheme(items[i].source_package).accent;
      const c2 = getSourceTheme(items[i + 1].source_package).accent;

      if (beamY >= y2) {
        // Fully passed segment: full height from y1 to y2
        segs.push({
          key: `seg-full-${items[i].id}-${items[i + 1].id}`,
          top: y1,
          height: y2 - y1,
          colors: [c1, c2],
        });
      } else {
        // Partially passed segment containing the bead: fill from y1 up to beamY
        const ratio = (beamY - y1) / (y2 - y1);
        const interpolatedColor = interpolateRgb(c1, c2, ratio);
        segs.push({
          key: `seg-partial-${items[i].id}-${items[i + 1].id}`,
          top: y1,
          height: beamY - y1,
          colors: [c1, interpolatedColor],
        });
        break; // Everything below beamY stays completely muted
      }
    }

    return segs;
  }, [items, iconYMap, activeData]);

  return (
    <View>
      <View style={stylesLocal.timelineContainer}>
        {/* Subtle base track line (always visible & muted by default) */}
        {items.length > 1 && (
          <View
            style={[
              stylesLocal.timelineBaseTrack,
              isFirstGroup && firstIconY !== null && isLastGroup && lastIconY !== null
                ? { top: firstIconY, height: lastIconY - firstIconY }
                : isFirstGroup && firstIconY !== null && !isLastGroup
                  ? { top: firstIconY, height: undefined, bottom: 26 }
                  : !isFirstGroup && isLastGroup && lastIconY !== null
                    ? { top: 26, bottom: undefined, height: lastIconY }
                    : { top: 26, bottom: 26 },
            ]}
          />
        )}

        {/* Multi-brand colored liquid segments (ONLY above the bead) */}
        {filledSegments.map((seg) => (
          <View
            key={seg.key}
            style={[
              stylesLocal.timelineSegment,
              {
                top: seg.top,
                height: seg.height,
              },
            ]}
            pointerEvents="none"
          >
            <LinearGradient
              colors={seg.colors}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={StyleSheet.absoluteFillObject}
            />
          </View>
        ))}

        {/* Scroll-driven bead & top trailing glow (only when scrolled) */}
        {activeData && items.length > 1 && activeData.isScrolled && (
          <View
            style={[
              stylesLocal.beadContainer,
              {
                top: activeData.beamY - 6,
              },
            ]}
            pointerEvents="none"
          >
            {/* Soft trailing upward light beam (no glow below) */}
            <LinearGradient
              colors={['transparent', activeData.currentColor]}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={stylesLocal.beadTrailGlow}
            />
            {/* Glowing Bead */}
            <View
              style={[
                stylesLocal.beadCircle,
                {
                  backgroundColor: activeData.currentColor,
                  shadowColor: activeData.currentColor,
                },
              ]}
            >
              <View style={stylesLocal.beadInnerDot} />
            </View>
          </View>
        )}

        {items.map((n, idx) => {
          const isToday = new Date(n.notification_posted_at).toDateString() === new Date().toDateString();
          const isYesterday =
            new Date(n.notification_posted_at).toDateString() === new Date(Date.now() - 86400000).toDateString();
          const showDateMarker =
            idx === 0 ||
            new Date(n.notification_posted_at).toDateString() !==
              new Date(items[idx - 1].notification_posted_at).toDateString();
          const isFirstInList = isFirstGroup && idx === 0;
          const isLastInList = isLastGroup && idx === items.length - 1;
          const isFacebook =
            n.source_package &&
            (n.source_package.includes('facebook') || n.source_package.includes('orca'));
          const theme = getSourceTheme(n.source_package);
          const itemY = iconYMap[idx];
          const isNearBead =
            activeData &&
            activeData.isScrolled &&
            itemY !== undefined &&
            Math.abs(activeData.beamY - itemY) < 24;

          return (
            <React.Fragment key={n.id}>
              {showDateMarker && (
                <View style={[stylesLocal.dateMarkerContainer, idx > 0 ? { marginTop: 14 } : undefined]}>
                  <View style={stylesLocal.dateHairline} />
                  <View
                    style={[
                      stylesLocal.dateCapsule,
                      isToday && stylesLocal.dateCapsuleToday,
                    ]}
                  >
                    <View style={[stylesLocal.dateCapsuleDot, isToday && stylesLocal.dateCapsuleDotToday]} />
                    <Text
                      style={[
                        stylesLocal.dateCapsuleText,
                        isToday && stylesLocal.dateCapsuleTextToday,
                      ]}
                    >
                      {isToday
                        ? 'Today'
                        : isYesterday
                          ? 'Yesterday'
                          : new Date(n.notification_posted_at).toLocaleDateString([], {
                              weekday: 'short',
                              month: 'short',
                              day: 'numeric',
                            })}
                    </Text>
                  </View>
                  <View style={stylesLocal.dateHairline} />
                </View>
              )}
              <View
                style={stylesLocal.activityRow}
                onLayout={(e) => {
                  const y = e.nativeEvent.layout.y + 22;
                  setIconYMap((prev) => (prev[idx] === y ? prev : { ...prev, [idx]: y }));
                  if (isFirstInList) setFirstIconY(y);
                  if (isLastInList) setLastIconY(y);
                }}
              >
                <View
                  style={[
                    stylesLocal.iconNodeWrap,
                    isNearBead && [
                      stylesLocal.iconNodeWrapActive,
                      {
                        borderColor: theme.accent,
                        shadowColor: theme.accent,
                      },
                    ],
                  ]}
                >
                  <AppIcon iconBase64={n.app_icon_base64} size={44} fallbackSize={18} />
                  {isFacebook && <View style={stylesLocal.onlineBadgeDot} />}
                </View>
                <View style={stylesLocal.activityCardWrap}>
                  <NotificationSourceCard notification={n} />
                </View>
              </View>
            </React.Fragment>
          );
        })}
      </View>
    </View>
  );
}

const stylesLocal = StyleSheet.create({
  timelineContainer: {
    position: 'relative',
    marginLeft: 8,
    paddingLeft: 24,
  },
  timelineBaseTrack: {
    position: 'absolute',
    left: 2,
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: C.surfaceContainerHigh,
    zIndex: 0,
    borderRadius: 1,
  },
  timelineSegment: {
    position: 'absolute',
    left: 1.5,
    width: 3,
    borderRadius: 1.5,
    overflow: 'hidden',
    zIndex: 1,
  },
  beadContainer: {
    position: 'absolute',
    left: -4,
    width: 14,
    height: 14,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  beadTrailGlow: {
    position: 'absolute',
    bottom: 7,
    left: 5.5,
    width: 3,
    height: 32,
    borderRadius: 1.5,
    zIndex: 1,
  },
  beadCircle: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.95,
    shadowRadius: 6,
    elevation: 5,
    zIndex: 2,
  },
  beadInnerDot: {
    width: 3.5,
    height: 3.5,
    borderRadius: 2,
    backgroundColor: '#ffffff',
  },
  dateMarkerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -24,
    marginRight: 0,
    marginVertical: 16,
    zIndex: 2,
  },
  dateHairline: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(47, 74, 55, 0.10)',
  },
  dateCapsule: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#faf3e7',
    paddingHorizontal: 12,
    paddingVertical: 4.5,
    borderRadius: 9999,
    marginHorizontal: 10,
    borderWidth: 1,
    borderColor: 'rgba(47, 74, 55, 0.10)',
    gap: 6,
  },
  dateCapsuleToday: {
    backgroundColor: '#e8ffea',
    borderColor: 'rgba(47, 74, 55, 0.20)',
  },
  dateCapsuleDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#807a6d',
  },
  dateCapsuleDotToday: {
    backgroundColor: '#2f4a37',
  },
  dateCapsuleText: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 10.5,
    color: '#645e53',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  dateCapsuleTextToday: {
    color: '#2f4a37',
  },
  activityRow: {
    flexDirection: 'row',
    marginBottom: 20,
    position: 'relative',
    alignItems: 'flex-start',
  },
  iconNodeWrap: {
    position: 'absolute',
    left: -44,
    top: 0,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: C.surfaceContainerLowest,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 3,
    borderWidth: 1.5,
    borderColor: 'transparent',
    shadowColor: '#363228',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 2,
  },
  iconNodeWrapActive: {
    borderWidth: 2,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 4,
  },
  onlineBadgeDot: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#31A24C',
    borderWidth: 2.5,
    borderColor: C.surfaceContainerLowest,
    zIndex: 4,
  },
  activityCardWrap: {
    flex: 1,
    marginLeft: 6,
  },
});

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.surface,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 8,
  },

  filterBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.surfaceContainerLowest,
    borderRadius: 24,
    paddingHorizontal: 12,
    height: 48,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 14,
    color: C.onSurface,
    paddingVertical: 8,
  },
  searchClear: {
    padding: 4,
  },
  filterTriggerBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: C.surfaceContainerLowest,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(68, 103, 77, 0.12)',
  },
  filterTriggerBtnActive: {
    backgroundColor: C.primary,
    borderColor: C.primary,
  },
  heroSection: {
    position: 'relative',
    paddingVertical: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 16,
    marginBottom: 2,
    borderRadius: 32,
    overflow: 'hidden',
    shadowColor: '#1c2a20',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 32,
    elevation: 8,
  },
  sectionTitle: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 20,
    lineHeight: 26,
    color: C.onSurface,
    marginTop: 8,
    marginBottom: 8,
    marginHorizontal: 16,
  },
  heroContent: {
    zIndex: 2,
    alignItems: 'center',
    gap: 14,
  },
  heroTitle: {
    fontFamily: 'PlusJakartaSans-ExtraBold',
    fontSize: 38,
    lineHeight: 44,
    color: C.white,
    letterSpacing: -1,
    textShadowColor: 'rgba(0,0,0,0.18)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  heroDescription: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 15,
    lineHeight: 22,
    color: 'rgba(255,255,255,0.88)',
    textAlign: 'center',
    maxWidth: 300,
  },
  encryptBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(68, 103, 77, 0.08)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 9999,
    marginTop: 8,
    marginBottom: 24,
    marginHorizontal: 10,
    gap: 6,
  },
  encryptBadgeText: {
    fontFamily: 'PlusJakartaSans-SemiBold',
    fontSize: 11,
    color: C.primary,
  },
  bottomSpacer: {
    height: 160,
  },

  /* Load More Section - Flat, Sleek, Minimalist */
  loadMoreSection: {
    marginVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  premiumLoadMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.surfaceContainerLowest,
    paddingVertical: 10,
    paddingHorizontal: 22,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: 'rgba(47, 74, 55, 0.16)',
    gap: 8,
    alignSelf: 'center',
  },
  loadMoreTitle: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 13,
    color: C.primary,
    letterSpacing: 0.2,
  },

  /* All Caught Up - Flat & Refined */
  caughtUpContainer: {
    marginVertical: 20,
    alignItems: 'center',
  },
  caughtUpCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 9999,
    backgroundColor: 'rgba(47, 74, 55, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(47, 74, 55, 0.10)',
    gap: 6,
    alignSelf: 'center',
  },
  caughtUpHeading: {
    fontFamily: 'PlusJakartaSans-SemiBold',
    fontSize: 12,
    color: C.primary,
  },

  /* Bottom Sheet Modal */
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'flex-end',
  },
  bottomSheetContainer: {
    backgroundColor: C.surface,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingTop: 12,
    paddingBottom: 36,
    maxHeight: '75%',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 10,
  },
  sheetHandle: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: C.surfaceContainerHighest,
    alignSelf: 'center',
    marginBottom: 12,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: C.surfaceContainerHigh,
  },
  sheetTitle: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 18,
    color: C.onSurface,
  },
  sheetSubtitle: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    color: C.onSurfaceVariant,
    marginTop: 2,
  },
  sheetCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: C.surfaceContainerLow,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sheetList: {
    paddingHorizontal: 16,
  },
  sheetListContent: {
    paddingTop: 12,
    paddingBottom: 16,
    gap: 8,
  },
  sheetAppRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: C.surfaceContainerLowest,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'transparent',
    shadowColor: '#363228',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 8,
    elevation: 1,
  },
  sheetAppRowActive: {
    backgroundColor: C.primaryContainer,
    borderColor: 'rgba(68, 103, 77, 0.25)',
  },
  sheetAppIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sheetAppDetails: {
    flex: 1,
    gap: 2,
  },
  sheetAppName: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 15,
    color: C.onSurface,
  },
  sheetAppNameActive: {
    color: C.primary,
  },
  sheetAppSub: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    color: C.onSurfaceVariant,
  },
  sheetBadge: {
    backgroundColor: C.surfaceContainerHighest,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 9999,
  },
  sheetBadgeText: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 12,
    color: C.onSurfaceVariant,
  },
  sheetChildAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  sheetChildStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDotSmall: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
});
