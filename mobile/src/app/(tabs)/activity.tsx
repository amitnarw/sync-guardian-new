import React, { useRef } from 'react';
import { StyleSheet, View, Text, RefreshControl, TouchableOpacity, ScrollView, TextInput, Modal, Pressable, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, RadialGradient, Stop, Rect } from 'react-native-svg';
import { ThemedView } from '@/components/themed-view';
import { EdgeFadeScrollView } from '@/components/ui/edge-fade';
import { usePairData } from '@/hooks/use-pair-data';
import { AppIcon } from '@/components/app-icon';
import { useRegisterHeaderRefresh } from '@/contexts/HeaderRefreshContext';
import { ActivitySkeleton } from '@/components/skeletons/activity-skeleton';
import { DateRangePicker } from '@/components/ui/date-range-picker';

// ============================================================
// EXACT STITCH COLORS (from HTML Tailwind config)
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
  primaryDeep: '#2f4a37',
} as const;

export default function ActivityScreen() {
  const { notifications, isLoading, isRefreshing, error, refresh } = usePairData();
  useRegisterHeaderRefresh(refresh);
  const [firstIconY, setFirstIconY] = React.useState<number | null>(null);
  const [lastIconY, setLastIconY] = React.useState<number | null>(null);

  const [searchQuery, setSearchQuery] = React.useState('');
  const [selectedPackage, setSelectedPackage] = React.useState<string | null>(null);
  const [dateRange, setDateRange] = React.useState<'all' | 'custom'>('all');
  const [showAppSelector, setShowAppSelector] = React.useState(false);
  const [showDateSelector, setShowDateSelector] = React.useState(false);

  // Floating Dropdown positioning refs & coordinates
  const appButtonRef = useRef<View>(null);
  const dateButtonRef = useRef<View>(null);
  const [appDropdownTop, setAppDropdownTop] = React.useState(0);
  const [appDropdownRight, setAppDropdownRight] = React.useState(0);
  // Custom Calendar Range Picker states
  const [customStartDate, setCustomStartDate] = React.useState<Date | null>(null);
  const [customEndDate, setCustomEndDate] = React.useState<Date | null>(null);
  const [customStartTime, setCustomStartTime] = React.useState('00:00');
  const [customEndTime, setCustomEndTime] = React.useState('23:59');

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

  const uniqueApps = React.useMemo(() => {
    const appsMap = new Map<string, { name: string; icon: string | null }>();
    for (const n of notifications) {
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
  }, [notifications]);

  const filteredNotifications = React.useMemo(() => {
    return notifications.filter((n) => {
      const matchesApp = !selectedPackage || n.source_package === selectedPackage;
      const matchesSearch =
        !searchQuery ||
        (n.notification_title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (n.notification_body || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (n.source_app_name || '').toLowerCase().includes(searchQuery.toLowerCase());

      let matchesDate = true;
      if (dateRange === 'custom') {
        const postedDate = new Date(n.notification_posted_at);

        let startBound = null;
        if (customStartDate) {
          startBound = new Date(customStartDate);
          const [sh, sm] = customStartTime.split(':').map(Number);
          startBound.setHours(isNaN(sh) ? 0 : sh, isNaN(sm) ? 0 : sm, 0, 0);
        }

        let endBound = null;
        if (customEndDate) {
          endBound = new Date(customEndDate);
          const [eh, em] = customEndTime.split(':').map(Number);
          endBound.setHours(isNaN(eh) ? 23 : eh, isNaN(em) ? 59 : em, 59, 999);
        } else if (customStartDate) {
          endBound = new Date(customStartDate);
          const [eh, em] = customEndTime.split(':').map(Number);
          endBound.setHours(isNaN(eh) ? 23 : eh, isNaN(em) ? 59 : em, 59, 999);
        }

        if (startBound && postedDate < startBound) {
          matchesDate = false;
        }
        if (endBound && postedDate > endBound) {
          matchesDate = false;
        }
      }

      return matchesApp && matchesSearch && matchesDate;
    });
  }, [notifications, selectedPackage, searchQuery, dateRange, customStartDate, customEndDate, customStartTime, customEndTime]);

  return (
    <ThemedView style={s.container}>
      <EdgeFadeScrollView
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={refresh} colors={[C.primary]} tintColor={C.primary} />
        }
      >
        {/* ========== PREMIUM HERO ========== */}
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
            <Text style={s.heroDescription}>
              Every notification mirrored from the connected device, in one timeline.
            </Text>
          </View>
        </View>

        <View style={s.encryptBadge}>
          <Ionicons name="shield-checkmark" size={14} color={C.primary} />
          <Text style={s.encryptBadgeText}>All notification contents are securely encrypted at rest</Text>
        </View>

        {/* ========== TIMELINE FEED ========== */}
        <Text style={s.sectionTitle}>Recent Activity</Text>

        {/* ========== SEARCH & FILTER SECTION ========== */}
        {!isLoading && notifications.length > 0 && (
          <View style={{ zIndex: 100, position: 'relative' }}>
            <View style={s.filterBarContainer}>
              {/* Search Bar */}
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

              {/* App Filter Button */}
              <TouchableOpacity
                ref={appButtonRef}
                style={[s.filterTriggerBtn, selectedPackage && s.filterTriggerBtnActive]}
                onPress={openAppDropdown}
                activeOpacity={0.7}
              >
                <Ionicons name="apps-outline" size={20} color={selectedPackage ? C.white : C.primary} />
              </TouchableOpacity>

              {/* Date Filter Button */}
              <TouchableOpacity
                ref={dateButtonRef}
                style={[s.filterTriggerBtn, dateRange !== 'all' && s.filterTriggerBtnActive]}
                onPress={openDateDropdown}
                activeOpacity={0.7}
              >
                <Ionicons name="calendar-outline" size={20} color={dateRange !== 'all' ? C.white : C.primary} />
              </TouchableOpacity>
            </View>

            {/* App Selector Dropdown Modal */}
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

            {/* Date & Time Selector Modal */}
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
        ) : error && notifications.length === 0 ? (
          <View style={{ padding: 32, alignItems: 'center' }}>
            <Text style={{ fontFamily: 'PlusJakartaSans-Medium', fontSize: 14, color: C.error }}>{error}</Text>
          </View>
        ) : notifications.length === 0 ? (
          <View style={{ padding: 32, alignItems: 'center' }}>
            <Ionicons name="notifications-off-outline" size={40} color={C.outline} />
            <Text style={{ fontFamily: 'PlusJakartaSans-Medium', fontSize: 14, color: C.outline, marginTop: 12 }}>No notifications yet</Text>
          </View>
        ) : filteredNotifications.length === 0 ? (
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
          <View style={s.timelineContainer}>
            <View style={[
              s.timelineLine,
              firstIconY !== null && lastIconY !== null ? {
                top: firstIconY,
                bottom: undefined,
                height: lastIconY - firstIconY,
              } : {
                top: 26,
                bottom: 26,
              }
            ]} />

            {filteredNotifications.map((n, idx) => {
              const isToday = new Date(n.notification_posted_at).toDateString() === new Date().toDateString();
              const isYesterday = new Date(n.notification_posted_at).toDateString() === new Date(Date.now() - 86400000).toDateString();
              const showDateMarker = idx === 0 || (
                new Date(n.notification_posted_at).toDateString() !== new Date(filteredNotifications[idx - 1].notification_posted_at).toDateString()
              );
              const timeStr = new Date(n.notification_posted_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

              return (
                <React.Fragment key={n.id}>
                  {showDateMarker && (
                    <View style={[s.dateMarkerRow, idx > 0 ? { marginTop: 10 } : undefined]}>
                      <View style={[s.dateMarkerPill, !isToday ? s.dateMarkerPillYesterday : undefined]}>
                        <Text style={[s.dateMarkerText, !isToday ? { color: C.onSurfaceVariant } : undefined]}>
                          {isToday ? 'Today' : isYesterday ? 'Yesterday' : new Date(n.notification_posted_at).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
                        </Text>
                      </View>
                    </View>
                  )}
                  <View
                    style={s.activityRow}
                    onLayout={
                      idx === 0
                        ? (e) => setFirstIconY(e.nativeEvent.layout.y + 26)
                        : idx === notifications.length - 1
                          ? (e) => setLastIconY(e.nativeEvent.layout.y + 26)
                          : undefined
                    }
                  >
                    <View style={s.iconNodeWrap}>
                      <AppIcon iconBase64={n.app_icon_base64} size={44} fallbackSize={18} />
                    </View>
                    <View style={s.activityCard}>
                      <View style={s.cardHeader}>
                        <Text style={[s.cardSubLabel, { color: C.primary }]} numberOfLines={1} ellipsizeMode="tail">{n.source_app_name || 'Notification'}</Text>
                        <View style={s.timeBadgePill}>
                          <Text style={s.timeBadgeText}>{timeStr}</Text>
                        </View>
                      </View>
                      <Text style={s.cardTitle}>{n.notification_title || '(no title)'}</Text>
                      {n.notification_body ? (
                        <Text style={s.cardDesc} numberOfLines={3}>{n.notification_body}</Text>
                      ) : null}
                    </View>
                  </View>
                </React.Fragment>
              );
            })}
          </View>
        )}

        {/* Bottom padding spacing */}
        <View style={s.bottomSpacer} />
      </EdgeFadeScrollView>
    </ThemedView>
  );
}

// ============================================================
// STYLES - mapped precisely from Stitch Tailwinds
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
    borderWidth: 1,
    borderColor: 'rgba(68, 103, 77, 0.12)',
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
  profileWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: C.surfaceContainerLowest,
    backgroundColor: C.surfaceContainerHighest,
    overflow: 'hidden',
    shadowColor: '#363228',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 32,
  },
  profileAvatar: {
    width: '100%',
    height: '100%',
  },
  /* ---------- Premium Hero ---------- */
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

  /* ---------- Timeline Feed ---------- */
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
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.5)',
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

  /* Activity Row */
  activityRow: {
    flexDirection: 'row',
    marginBottom: 25,
    position: 'relative',
  },
  activityRowYesterday: {
    opacity: 0.7,
    marginBottom: 24,
  },
  iconNodeWrap: {
    position: 'absolute',
    left: -44,
    top: 4,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: C.surfaceContainerLowest,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
    shadowColor: '#363228',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 32,
  },
  iconNodeInner: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },

  /* Activity Card */
  activityCard: {
    flex: 1,
    marginLeft: 10,
    backgroundColor: C.surfaceContainerLowest,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 28,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    padding: 20,
    shadowColor: '#363228',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.04,
    shadowRadius: 40,
    elevation: 2,
  },
  activityCardOutlined: {
    backgroundColor: C.surfaceContainerLow,
    borderWidth: 1,
    borderColor: 'rgba(245, 237, 224, 0.5)',
    shadowColor: '#363228',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.02,
    shadowRadius: 24,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardSubLabel: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 12,
    lineHeight: 16,
    textTransform: 'uppercase',
    letterSpacing: 1,
    flexShrink: 1,
    marginRight: 8,
  },
  timeBadgePill: {
    backgroundColor: C.surfaceContainerLow,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 9999,
    flexShrink: 0,
  },
  timeBadgeText: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 12,
    lineHeight: 16,
    color: C.onSurfaceVariant,
  },
  cardTitle: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 20,
    lineHeight: 26,
    color: C.onSurface,
    marginBottom: 8,
  },
  cardDesc: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 15,
    lineHeight: 22,
    color: C.onSurfaceVariant,
  },
  cardActions: {
    marginTop: 16,
    flexDirection: 'row',
  },
  actionBtn: {
    backgroundColor: C.surfaceContainerLow,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 9999,
  },
  actionBtnText: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 13,
    lineHeight: 18,
    color: C.onSurface,
  },

  /* Remote Illustration */
  illustrationWrapper: {
    marginTop: 16,
    borderRadius: 16,
    overflow: 'hidden',
    height: 120,
    backgroundColor: C.surfaceContainerLow,
  },
  illustrationImage: {
    width: '100%',
    height: '100%',
    opacity: 0.85,
  },

  /* Minimal activity card */
  activityCardMinimal: {
    flex: 1,
    paddingVertical: 8,
    paddingLeft: 8,
  },
  cardHeaderMinimal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  cardTitleMinimal: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 16,
    lineHeight: 22,
    color: C.onSurface,
  },
  timeTextMinimal: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 12,
    color: C.onSurfaceVariant,
  },
  cardDescMinimal: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 14,
    lineHeight: 20,
    color: C.onSurfaceVariant,
  },

  /* Bottom Spacer */
  bottomSpacer: {
    height: 120,
  },

  /* ---------- Dropdowns & Modals ---------- */
  dropdownOverlay: {
    flex: 1,
    backgroundColor: 'rgba(54, 50, 40, 0.15)',
  },
  dropdownMenuFloating: {
    position: 'absolute',
    backgroundColor: C.surface,
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(68, 103, 77, 0.12)',
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