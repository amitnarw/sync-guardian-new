import React, { useRef, useMemo, useEffect, useState, useCallback } from 'react';
import { StyleSheet, View, Text, RefreshControl, TouchableOpacity, ScrollView, TextInput, Modal, Pressable, Dimensions, ActivityIndicator } from 'react-native';
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
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { ChildSelector } from '@/components/ui/child-selector';
import { useAuthStore } from '@/hooks/use-auth-store';
import { fetchParentNotifications, fetchMoreNotificationsOlderThan, type AggregatedNotification, type ChildRef, type MoreNotificationsCursor } from '@/services/notifications-service';

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

  const allChildrenKey = allChildren.map((c) => c.pairId).join(',');
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
  const [showAppSelector, setShowAppSelector] = useState(false);
  const [showDateSelector, setShowDateSelector] = useState(false);

  const appButtonRef = useRef<View>(null);
  const dateButtonRef = useRef<View>(null);
  const [appDropdownTop, setAppDropdownTop] = useState(0);
  const [appDropdownRight, setAppDropdownRight] = useState(0);
  const [customStartDate, setCustomStartDate] = useState<Date | null>(null);
  const [customEndDate, setCustomEndDate] = useState<Date | null>(null);
  const [customStartTime, setCustomStartTime] = useState('00:00');
  const [customEndTime, setCustomEndTime] = useState('23:59');

  const openAppDropdown = () => {
    appButtonRef.current?.measureInWindow((x, y, width, height) => {
      const screenWidth = Dimensions.get('window').width;
      setAppDropdownTop(y + height + 4);
      setAppDropdownRight(screenWidth - (x + width));
      setShowAppSelector(true);
      setShowDateSelector(false);
    });
  };

  const openDateDropdown = () => {
    setShowDateSelector(true);
    setShowAppSelector(false);
  };

  const uniqueApps = useMemo(() => {
    const appsMap = new Map<string, { name: string; icon: string | null }>();
    for (const n of aggregated) {
      const pkg = n.source_package;
      if (pkg) {
        appsMap.set(pkg, {
          name: n.source_app_name || pkg,
          icon: n.app_icon_base64,
        });
      }
    }
    return Array.from(appsMap.entries()).map(([pkg, data]) => ({
      package: pkg,
      name: data.name,
      icon: data.icon,
    }));
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
      const key = n.pair_id;
      let entry = byChild.get(key);
      if (!entry) {
        entry = { child: n.child, items: [] };
        byChild.set(key, entry);
      }
      entry.items.push(n);
    }
    return allChildren
      .map((c) => byChild.get(c.pairId))
      .filter((g): g is Group => !!g);
  }, [filtered, isAllMode, allChildren]);

  const showMultiSelector = allChildren.length > 1;
  const selectedChild = useMemo(
    () => allChildren.find((c) => c.pairId === selectedChildId) ?? null,
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
            {showMultiSelector && (
              <View style={s.heroSelectorWrap}>
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
          </View>
        </View>

        <View style={s.encryptBadge}>
          <Ionicons name="shield-checkmark" size={14} color={C.primary} />
          <Text style={s.encryptBadgeText}>All notification contents are securely encrypted at rest</Text>
        </View>

        <Text style={s.sectionTitle}>Recent Activity</Text>

        {!isLoading && aggregated.length > 0 && showMultiSelector === false && selectedChild && (
          <View style={s.singleChildHint}>
            <Text style={s.singleChildHintText}>
              Showing {selectedChild.displayName || 'this child'}. Pair more devices from Settings to view together.
            </Text>
          </View>
        )}

        {!isLoading && aggregated.length > 0 && (
          <View style={{ zIndex: 100, position: 'relative' }}>
            <View style={s.filterBarContainer}>
              <View style={s.searchBar}>
                <Ionicons name="search-outline" size={18} color={C.onSurfaceVariant} style={s.searchIcon} />
                <TextInput
                  style={s.searchInput}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder="Search..."
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

              <TouchableOpacity
                ref={appButtonRef}
                style={[s.filterTriggerBtn, selectedPackage && s.filterTriggerBtnActive]}
                onPress={openAppDropdown}
                activeOpacity={0.7}
              >
                <Ionicons name="apps-outline" size={20} color={selectedPackage ? C.white : C.primary} />
              </TouchableOpacity>

              <TouchableOpacity
                ref={dateButtonRef}
                style={[s.filterTriggerBtn, dateRange !== 'all' && s.filterTriggerBtnActive]}
                onPress={openDateDropdown}
                activeOpacity={0.7}
              >
                <Ionicons name="calendar-outline" size={20} color={dateRange !== 'all' ? C.white : C.primary} />
              </TouchableOpacity>
            </View>

            <Modal
              visible={showAppSelector}
              transparent
              animationType="fade"
              onRequestClose={() => setShowAppSelector(false)}
            >
              <Pressable style={s.dropdownOverlay} onPress={() => setShowAppSelector(false)}>
                <View style={[s.dropdownMenuFloating, { top: appDropdownTop, right: appDropdownRight }]}>
                  <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled showsVerticalScrollIndicator>
                    <TouchableOpacity
                      style={[s.dropdownItem, !selectedPackage && s.dropdownItemActive]}
                      onPress={() => {
                        setSelectedPackage(null);
                        setShowAppSelector(false);
                      }}
                    >
                      <Text style={[s.dropdownItemText, !selectedPackage && s.dropdownItemTextActive]}>All Apps</Text>
                    </TouchableOpacity>
                    {uniqueApps.map((app) => (
                      <TouchableOpacity
                        key={app.package}
                        style={[s.dropdownItem, selectedPackage === app.package && s.dropdownItemActive]}
                        onPress={() => {
                          setSelectedPackage(app.package);
                          setShowAppSelector(false);
                        }}
                      >
                        <AppIcon iconBase64={app.icon} size={20} fallbackSize={10} />
                        <Text style={[s.dropdownItemText, selectedPackage === app.package && s.dropdownItemTextActive]} numberOfLines={1}>
                          {app.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              </Pressable>
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
          <View style={{ padding: 32, alignItems: 'center' }}>
            <Text style={{ fontFamily: 'PlusJakartaSans-Medium', fontSize: 14, color: C.error }}>{error}</Text>
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
              />
            ))}
            {hasMore && aggregated.length >= 50 && (
              <View style={s.loadMoreWrap}>
                <TouchableOpacity
                  onPress={loadMore}
                  disabled={isLoadingMore}
                  activeOpacity={0.7}
                  style={s.loadMoreBtn}
                >
                  {isLoadingMore ? (
                    <ActivityIndicator size="small" color={C.primary} />
                  ) : (
                    <Text style={s.loadMoreText}>Load older activity</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
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
}

function ChildGroupSection({
  group,
  firstIconY,
  lastIconY,
  setFirstIconY,
  setLastIconY,
  isFirstGroup,
  isLastGroup,
}: ChildGroupSectionProps) {
  const { child, items } = group;
  return (
    <View>
      {child && (
        <View style={s.childGroupHeader}>
          <View style={s.childGroupAvatar}>
            <Ionicons name="person-outline" size={16} color={C.primary} />
            <View
              style={[
                s.childGroupOnlineDot,
                { backgroundColor: child.isOnline ? '#31A24C' : C.outline },
              ]}
            />
          </View>
          <View style={s.childGroupText}>
            <Text style={s.childGroupName}>{child.displayName || 'Child Device'}</Text>
            <Text style={s.childGroupSub}>
              {child.isOnline
                ? 'Online'
                : child.lastSeenAt
                  ? `Last seen ${new Date(child.lastSeenAt).toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' })}`
                  : 'Offline'}
            </Text>
          </View>
        </View>
      )}

      <View style={stylesLocal.timelineContainer}>
        <View
          style={[
            stylesLocal.timelineLine,
            isFirstGroup && firstIconY !== null && isLastGroup && lastIconY !== null
              ? { top: firstIconY, height: lastIconY - firstIconY }
              : isFirstGroup && firstIconY !== null && !isLastGroup
                ? { top: firstIconY, height: undefined, bottom: 26 }
                : !isFirstGroup && isLastGroup && lastIconY !== null
                  ? { top: 26, bottom: undefined, height: lastIconY }
                  : { top: 26, bottom: 26 },
          ]}
        />

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

          return (
            <React.Fragment key={n.id}>
              {showDateMarker && (
                <View style={[stylesLocal.dateMarkerRow, idx > 0 ? { marginTop: 10 } : undefined]}>
                  <View
                    style={[
                      stylesLocal.dateMarkerPill,
                      !isToday ? stylesLocal.dateMarkerPillYesterday : undefined,
                    ]}
                  >
                    <Text
                      style={[
                        stylesLocal.dateMarkerText,
                        !isToday ? { color: C.onSurfaceVariant } : undefined,
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
                </View>
              )}
              <View
                style={stylesLocal.activityRow}
                onLayout={(e) => {
                  if (isFirstInList) setFirstIconY(e.nativeEvent.layout.y + 22);
                  if (isLastInList) setLastIconY(e.nativeEvent.layout.y + 22);
                }}
              >
                <View style={stylesLocal.iconNodeWrap}>
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
  timelineLine: {
    position: 'absolute',
    left: 2,
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: C.surfaceContainerHigh,
    zIndex: 0,
  },
  dateMarkerRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    marginLeft: -44,
    marginBottom: 24,
    zIndex: 2,
  },
  dateMarkerPill: {
    backgroundColor: 'rgba(255, 248, 240, 0.75)',
    paddingHorizontal: 20,
    paddingTop: 8,
    borderRadius: 9999,
    shadowColor: '#363228',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 32,
  },
  dateMarkerPillYesterday: {
    shadowColor: '#363228',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 16,
  },
  dateMarkerText: {
    fontFamily: 'PlusJakartaSans-SemiBold',
    fontSize: 14,
    lineHeight: 20,
    color: C.onSurface,
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
    zIndex: 2,
    shadowColor: '#363228',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
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
  },
  filterTriggerBtnActive: {
    backgroundColor: C.primary,
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
  heroSelectorWrap: {
    marginTop: 4,
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
  childGroupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
  },
  childGroupAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: C.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  childGroupOnlineDot: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: C.surface,
  },
  childGroupText: {
    flex: 1,
  },
  childGroupName: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 15,
    color: C.onSurface,
  },
  childGroupSub: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 11,
    color: C.onSurfaceVariant,
    marginTop: 2,
  },
  singleChildHint: {
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 12,
    backgroundColor: C.surfaceContainerLow,
    borderRadius: 16,
  },
  singleChildHintText: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 12,
    color: C.onSurfaceVariant,
    lineHeight: 18,
  },
  bottomSpacer: {
    height: 120,
  },

  loadMoreWrap: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  loadMoreBtn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 9999,
    backgroundColor: C.surfaceContainerLowest,
    shadowColor: '#363228',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 2,
  },
  loadMoreText: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 13,
    color: C.primary,
  },

  dropdownOverlay: {
    flex: 1,
    backgroundColor: 'rgba(54, 50, 40, 0.15)',
  },
  dropdownMenuFloating: {
    position: 'absolute',
    backgroundColor: C.surface,
    borderRadius: 24,
    padding: 16,
    shadowColor: '#363228',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
    width: 240,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
  },
  dropdownItemActive: {
    backgroundColor: C.primaryContainer,
  },
  dropdownItemText: {
    fontFamily: 'PlusJakartaSans-SemiBold',
    fontSize: 13,
    color: C.onSurface,
  },
  dropdownItemTextActive: {
    color: C.primary,
  },
});
