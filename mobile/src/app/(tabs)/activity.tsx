import React, { useRef, useMemo, useEffect, useState, useCallback } from 'react';
import { StyleSheet, View, Text, RefreshControl, TouchableOpacity, ScrollView, TextInput, Modal, Pressable, ActivityIndicator, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, RadialGradient, Stop, Rect } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  interpolateColor,
  type SharedValue,
} from 'react-native-reanimated';
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

type SegmentDescriptor = {
  id: string;
  top: number;
  height: number;
  colors: [string, string];
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

  // Native-driven scroll offset (UI thread). The EdgeFadeScrollView writes to
  // this SharedValue on every scroll frame, and downstream animations read it
  // without causing React re-renders.
  const scrollY = useSharedValue(0);
  // Native-driven viewport height for the scroll view. Used to pin the timeline
  // playhead to the middle of the visible area.
  const viewportHeight = useSharedValue(0);

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

  // Icon positions reported by each ChildGroupSection, keyed by groupKey.
  // Stored in a SharedValue so updates do NOT cause React re-renders of
  // ActivityScreen. The PlayheadBead reads it directly inside its worklets.
  const groupPositionsRef = useRef<Map<string, IconPosition[]>>(new Map());
  const iconPositionsValue = useSharedValue<BeadPositions>({
    positions: [],
    colors: [],
    maxIconY: null,
  });

  const handleIconPositions = useCallback(
    (groupKey: string, positions: IconPosition[] | null) => {
      const map = groupPositionsRef.current;
      if (positions === null) {
        if (map.has(groupKey)) {
          map.delete(groupKey);
        }
      } else {
        map.set(groupKey, positions);
      }
      const flat: IconPosition[] = [];
      map.forEach((arr) => arr.forEach((p) => flat.push(p)));
      flat.sort((a, b) => a.y - b.y);
      iconPositionsValue.value = {
        positions: flat.map((p) => p.y),
        colors: flat.map((p) => p.accent),
        maxIconY: flat.length > 0 ? flat[flat.length - 1].y : null,
      };
    },
    [iconPositionsValue],
  );

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
        scrollOffset={scrollY}
        viewportHeight={viewportHeight}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl refreshing={isRefreshing || pairIsRefreshing} onRefresh={doRefresh} colors={[C.primary]} tintColor={C.primary} />
        }
      >
        <PlayheadBead
          scrollY={scrollY}
          viewportHeight={viewportHeight}
          iconPositionsValue={iconPositionsValue}
        />

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
          <React.Fragment>
            {groups.map((group) => {
              const groupKey = group.child?.pairId ?? 'single';
              return (
                <ChildGroupSection
                  key={groupKey}
                  group={group}
                  groupKey={groupKey}
                  firstIconY={group === groups[0] ? firstIconY : null}
                  lastIconY={group === groups[groups.length - 1] ? lastIconY : null}
                  setFirstIconY={group === groups[0] ? setFirstIconY : () => undefined}
                  setLastIconY={group === groups[groups.length - 1] ? setLastIconY : () => undefined}
                  isFirstGroup={group === groups[0]}
                  isLastGroup={group === groups[groups.length - 1]}
                  scrollY={scrollY}
                  viewportHeight={viewportHeight}
                  onIconPositions={handleIconPositions}
                />
              );
            })}
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
          </React.Fragment>
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
  scrollY: SharedValue<number>;
  viewportHeight: SharedValue<number>;
  onIconPositions: (
    groupKey: string,
    positions: { y: number; accent: string }[] | null,
  ) => void;
  groupKey: string;
}

/**
 * A native-driven timeline renderer.
 *
 * - The colored fill extends from the first icon up to the playhead position
 *   (the vertical center of the viewport). The clip container's height is
 *   animated on the UI thread.
 * - The bead is rendered as a single global overlay by `ActivityScreen`, not
 *   per-group, so it stays pinned at the middle of the screen even when
 *   multiple groups are present.
 * - All scroll-driven updates run on the UI thread for 60fps motion.
 */
const ChildGroupSection = React.memo(function ChildGroupSection({
  group,
  firstIconY,
  lastIconY,
  setFirstIconY,
  setLastIconY,
  isFirstGroup,
  isLastGroup,
  scrollY,
  viewportHeight,
  onIconPositions,
  groupKey,
}: ChildGroupSectionProps) {
  const { items } = group;
  // Live icon Y map kept in a ref to avoid record allocation on each layout.
  const iconYMapRef = useRef<Record<number, number>>({});
  // Bump a tiny counter when layouts settle so colored segments and the
  // parent callback can re-run without copying the whole record.
  const [layoutVersion, setLayoutVersion] = useState(0);
  const pendingLayoutRef = useRef(false);
  const rafRef = useRef<number | null>(null);

  // Resolved first/last icon centers within this group's timeline container.
  const resolvedFirstIconY = firstIconY ?? 22;
  const resolvedLastIconY = lastIconY ?? null;

  // Native-driven Y position of this group's OUTER view relative to the
  // scroll content. The outer group View is rendered as a direct child of
  // the EdgeFadeScrollView content, so its layout.y IS the scroll-content
  // coordinate we need for the playhead math.
  const groupTopY = useSharedValue(0);
  const groupTopYStateRef = useRef(0);

  const reportPositions = useCallback(() => {
    const top = groupTopYStateRef.current;
    const localMap = iconYMapRef.current;
    const positions: { y: number; accent: string }[] = [];
    for (let i = 0; i < items.length; i++) {
      const local = localMap[i];
      if (local === undefined) continue;
      positions.push({
        y: local + top,
        accent: getSourceTheme(items[i].source_package).accent,
      });
    }
    positions.sort((a, b) => a.y - b.y);
    onIconPositions(groupKey, positions.length > 0 ? positions : null);
  }, [items, groupKey, onIconPositions]);

  // Schedule a single layout-pass commit per frame. Many item onLayout
  // callbacks can fire in the same frame; we coalesce them into one state
  // update and one parent notification per frame.
  const scheduleLayoutCommit = useCallback(() => {
    if (pendingLayoutRef.current) return;
    pendingLayoutRef.current = true;
    rafRef.current = requestAnimationFrame(() => {
      pendingLayoutRef.current = false;
      rafRef.current = null;
      setLayoutVersion((v) => v + 1);
      reportPositions();
    });
  }, [reportPositions]);

  // Static segments (the colored fill between consecutive icons). Rendered
  // with full extent and clipped by the parent Animated.View whose height
  // is driven natively. Recomputed only when layout commits settle.
  const coloredSegments: SegmentDescriptor[] = useMemo(() => {
    if (items.length < 2) return [];
    const segs: SegmentDescriptor[] = [];
    const localMap = iconYMapRef.current;
    for (let i = 0; i < items.length - 1; i++) {
      const y1 = localMap[i];
      const y2 = localMap[i + 1];
      if (y1 === undefined || y2 === undefined || y2 <= y1) continue;
      const c1 = getSourceTheme(items[i].source_package).accent;
      const c2 = getSourceTheme(items[i + 1].source_package).accent;
      segs.push({
        id: `seg-${items[i].id}-${items[i + 1].id}`,
        top: y1,
        height: y2 - y1,
        colors: [c1, c2],
      });
    }
    return segs;
    // layoutVersion triggers recompute; we read iconYMapRef.current inside.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, layoutVersion]);

  // Animated style: the colored fill container extends from the top of the
  // timeline container down to the current playhead position. The clip
  // container is at top: 0, so its height is exactly the playhead's local Y
  // (clamped to [0, lastIconY]). Static segments inside start at their own
  // icon Y, so the visible colored line naturally begins at the first icon
  // and ends exactly at the playhead.
  const fillAnimatedStyle = useAnimatedStyle(() => {
    const last = resolvedLastIconY;
    if (last === null) {
      return { height: 0 };
    }
    const playheadY = scrollY.value + viewportHeight.value * 0.5;
    const localPlayhead = playheadY - groupTopY.value;
    const fillHeight = Math.max(0, Math.min(last, localPlayhead));
    return {
      height: fillHeight,
    };
  }, [resolvedLastIconY]);

  // Cancel any pending RAF when this section unmounts.
  useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, []);

  return (
    <View
      onLayout={(e) => {
        const y = e.nativeEvent.layout.y;
        groupTopY.value = y;
        groupTopYStateRef.current = y;
        scheduleLayoutCommit();
      }}
    >
      <View style={stylesLocal.timelineContainer}>
        {/* Subtle base track line (always visible & muted by default) */}
        {items.length > 1 && (
          <View
            style={[
              stylesLocal.timelineBaseTrack,
              resolvedLastIconY !== null
                ? { top: resolvedFirstIconY, height: resolvedLastIconY - resolvedFirstIconY }
                : { top: 22, bottom: 22 },
            ]}
          />
        )}

        {/* Colored fill: animated clip container. Children are static colored
            segments rendered at full extent; the wrapper clips them based on
            the current playhead position via `fillAnimatedStyle`. */}
        {items.length > 1 && (
          <Animated.View
            style={[stylesLocal.timelineFillClip, fillAnimatedStyle]}
            pointerEvents="none"
          >
            {coloredSegments.map((seg) => (
              <View
                key={seg.id}
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
          </Animated.View>
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
          const isNearBead = false;

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
                  if (iconYMapRef.current[idx] !== y) {
                    // Mutate the ref directly to avoid record allocation.
                    iconYMapRef.current[idx] = y;
                    scheduleLayoutCommit();
                  }
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
});

interface IconPosition {
  y: number;
  accent: string;
}

interface BeadPositions {
  positions: number[];
  colors: string[];
  maxIconY: number | null;
}

interface PlayheadBeadProps {
  scrollY: SharedValue<number>;
  viewportHeight: SharedValue<number>;
  iconPositionsValue: SharedValue<BeadPositions>;
}

/**
 * Global playhead bead overlay, rendered outside the ScrollView so it stays
 * pinned to the vertical center of the screen regardless of scroll position.
 * Color is interpolated across all icons in the timeline based on the icon
 * nearest the playhead.
 *
 * The bead is hidden (instantly) once the playhead scrolls past the last
 * icon, so it never floats in empty space below the timeline.
 */
function PlayheadBead({ scrollY, viewportHeight, iconPositionsValue }: PlayheadBeadProps) {
  // Container style: pins the bead to the vertical center of the viewport
  // and snaps its opacity to 0 the instant the playhead scrolls past the
  // last icon (so the bead never appears below the timeline).
  const containerAnimatedStyle = useAnimatedStyle(() => {
    const center = viewportHeight.value * 0.5;
    const translateY = scrollY.value + center - 7;
    const playheadY = scrollY.value + center;
    const maxIconY = iconPositionsValue.value.maxIconY;
    const visible =
      maxIconY === null || playheadY <= maxIconY + 8;
    return {
      transform: [{ translateY }],
      opacity: visible ? 1 : 0,
    };
  });

  // Circle style: only animates backgroundColor / shadowColor. Reads
  // positions/colors directly from the SharedValue each frame; no React state
  // involvement.
  const circleAnimatedStyle = useAnimatedStyle(() => {
    const center = viewportHeight.value * 0.5;
    const playheadY = scrollY.value + center;
    const { positions, colors } = iconPositionsValue.value;
    const color =
      positions.length > 0
        ? interpolateColor(playheadY, positions, colors)
        : C.primary;
    return {
      backgroundColor: color,
      shadowColor: color,
    };
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[playheadStyles.container, containerAnimatedStyle]}
    >
      <Animated.View style={[playheadStyles.circle, circleAnimatedStyle]}>
        <View style={playheadStyles.innerDot} />
      </Animated.View>
    </Animated.View>
  );
}

const playheadStyles = StyleSheet.create({
  container: {
    position: 'absolute',
    // Timeline line center sits at ~34px from screen left
    // (24 scroll content padding + 8 timelineContainer margin + 2 line offset).
    // Bead width is 14, so left: 27 centers it on the line.
    top: 0,
    left: 27,
    width: 14,
    height: 14,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  circle: {
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
  },
  innerDot: {
    width: 3.5,
    height: 3.5,
    borderRadius: 2,
    backgroundColor: '#ffffff',
  },
});

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
    zIndex: 1,
    borderRadius: 1,
  },
  timelineFillClip: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    zIndex: 1,
    overflow: 'hidden',
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
    // Extra padding so the last notification icon can be scrolled up to
    // the viewport middle (where the playhead bead is fixed).
    height: 267,
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
