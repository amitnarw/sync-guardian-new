import React, { useState } from 'react';
import { StyleSheet, ScrollView, View, TouchableOpacity, Text, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/hooks/use-auth-store';

const { width: SCREEN_W } = Dimensions.get('window');

// ============================================================
// EXACT STITCH COLORS (from design theme & HTML config)
// ============================================================
const C = {
  primary: '#44674d',                  // Moss Green
  primaryContainer: '#c5eccc',
  onPrimary: '#e8ffea',
  secondary: '#a0412d',                // Terracotta / Alert Orange-Red
  secondaryContainer: '#ffdad3',
  onSecondary: '#fff7f6',
  onSecondaryContainer: '#8e3421',
  tertiary: '#44674e',
  tertiaryContainer: '#d3fbda',
  surface: '#fff8f0',                  // Warm premium baseline cream
  surfaceContainerLow: '#faf3e7',      // Primary list item container
  surfaceContainerHigh: '#efe7da',     // Inactive filter button bg
  surfaceContainerHighest: '#eae1d2',  // Accent container bg
  surfaceContainerLowest: '#ffffff',   // Action card base
  onSurface: '#363228',                // Earthy dark gray text
  onSurfaceVariant: '#645e53',          // Soft helper/metadata text
  outline: '#807a6d',
  outlineVariant: '#b9b1a3',
  error: '#a83836',
  white: '#ffffff',
} as const;

type FilterType = 'All Activity' | 'Safety Alerts' | 'Screen Time' | 'New Apps' | 'Insights';

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  time: string;
  type: 'restriction' | 'permission' | 'screentime' | 'insight' | 'battery' | 'audit';
  category: 'safety' | 'screentime' | 'apps' | 'insights' | 'audit';
  isPriority: boolean;
  isYesterday?: boolean;
}

export default function NotificationsScreen() {
  const [selectedFilter, setSelectedFilter] = useState<FilterType>('All Activity');

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const { pairId } = useAuthStore();

  const mapDbNotification = (dbRow: any): NotificationItem => {
    return {
      id: dbRow.id,
      title: dbRow.notification_title,
      message: `${dbRow.source_app_name}: ${dbRow.notification_body}`,
      time: new Date(dbRow.notification_posted_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      type: 'insight',
      category: 'insights',
      isPriority: false,
    };
  };

  React.useEffect(() => {
    if (!pairId) return;

    const fetchHistory = async () => {
      const { data, error } = await supabase
        .from('mirrored_notifications')
        .select('*')
        .eq('pair_id', pairId)
        .order('notification_posted_at', { ascending: false });
        
      if (data) {
        setNotifications(data.map(mapDbNotification));
      }
    };

    fetchHistory();

    const channel = supabase
      .channel('realtime_notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'mirrored_notifications',
          filter: `pair_id=eq.${pairId}`,
        },
        (payload) => {
          setNotifications((prev) => [mapDbNotification(payload.new), ...prev]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [pairId]);

  const filters: FilterType[] = ['All Activity', 'Safety Alerts', 'Screen Time', 'New Apps', 'Insights'];

  // Filter items according to category
  const filteredNotifications = notifications.filter((item) => {
    if (selectedFilter === 'All Activity') return true;
    if (selectedFilter === 'Safety Alerts') return item.category === 'safety' || item.type === 'restriction';
    if (selectedFilter === 'Screen Time') return item.category === 'screentime';
    if (selectedFilter === 'New Apps') return item.category === 'apps';
    if (selectedFilter === 'Insights') return item.category === 'insights';
    return true;
  });

  const priorityAlerts = filteredNotifications.filter((item) => item.isPriority && !item.isYesterday);
  const todayActivities = filteredNotifications.filter((item) => !item.isPriority && !item.isYesterday);
  const yesterdayActivities = filteredNotifications.filter((item) => item.isYesterday);

  return (
    <View style={s.container}>
      <SafeAreaView style={s.safeArea} edges={['top']}>
        {/* Floating Glass Header */}
        <View style={s.header}>
          <TouchableOpacity 
            style={s.headerButton} 
            onPress={() => router.back()}
            activeOpacity={0.8}
          >
            <Ionicons name="chevron-back" size={24} color={C.onSurface} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Nurturing Atelier</Text>
          <View style={s.headerRight}>
            <Ionicons name="notifications" size={22} color={C.primary} />
          </View>
        </View>

        <ScrollView 
          contentContainerStyle={s.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* ========== SCREEN HEADER & FILTERS ========== */}
          <View style={s.headerBlock}>
            <Text style={s.pageTitle}>Daily Pulse</Text>
            
            {/* Horizontal Filter Bar */}
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false} 
              contentContainerStyle={s.filterContainer}
            >
              {filters.map((filter) => {
                const isActive = selectedFilter === filter;
                return (
                  <TouchableOpacity
                    key={filter}
                    style={[s.filterButton, isActive && s.filterButtonActive]}
                    onPress={() => setSelectedFilter(filter)}
                    activeOpacity={0.8}
                  >
                    <Text style={[s.filterText, isActive && s.filterTextActive]}>
                      {filter}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* ========== SECTIONS FEED ========== */}
          <View style={s.feedSpace}>
            
            {/* 1. Group: Priority Alerts */}
            {priorityAlerts.length > 0 && (
              <View style={s.section}>
                <View style={s.sectionHeader}>
                  <Text style={s.sectionTitlePriority}>Priority Alerts</Text>
                  <View style={s.badgePriority}>
                    <Text style={s.badgePriorityText}>{priorityAlerts.length} NEW</Text>
                  </View>
                </View>
                
                <View style={s.cardList}>
                  {priorityAlerts.map((item) => {
                    const isRestriction = item.type === 'restriction';
                    return (
                      <View 
                        key={item.id} 
                        style={[
                          s.priorityCardOuter,
                          isRestriction ? s.priorityCardOuterRestriction : s.priorityCardOuterPermission
                        ]}
                      >
                        {isRestriction && <View style={s.priorityCardAccentBar} />}
                        
                        <View style={s.priorityCardInner}>
                          <View style={[
                            s.priorityIconBlock,
                            isRestriction ? s.priorityIconBlockSolid : s.priorityIconBlockOutline
                          ]}>
                            <MaterialCommunityIcons 
                              name={isRestriction ? 'gavel' : 'apps'} 
                              size={22} 
                              color={isRestriction ? C.onSecondary : C.secondary} 
                            />
                          </View>
                          
                          <View style={s.cardBody}>
                            <View style={s.cardMetaRow}>
                              <Text style={[
                                s.priorityCardTitle,
                                isRestriction ? s.priorityCardTitleRestriction : s.priorityCardTitlePermission
                              ]}>{item.title}</Text>
                              <Text style={[
                                s.priorityCardTime,
                                isRestriction ? s.priorityCardTimeRestriction : s.priorityCardTimePermission
                              ]}>{item.time}</Text>
                            </View>
                            
                            {isRestriction ? (
                              <Text style={[s.priorityCardMessage, s.priorityCardMessageRestriction]}>
                                Leo's device flagged a search for{' '}
                                <Text style={s.boldUnderline}>"bypass firewall"</Text> on Safari.
                              </Text>
                            ) : (
                              <Text style={[s.priorityCardMessage, s.priorityCardMessagePermission]}>
                                Maya wants to install{' '}
                                <Text style={s.boldText}>"Studio Ghibli Art"</Text>. Category: Creativity & Design.
                              </Text>
                            )}
                            
                            {/* Buttons row */}
                            <View style={s.cardButtonsRow}>
                              {isRestriction ? (
                                <>
                                  <TouchableOpacity style={s.actionButtonSecondary} activeOpacity={0.8}>
                                    <Text style={s.actionButtonTextSecondary}>Review Block</Text>
                                  </TouchableOpacity>
                                  <TouchableOpacity style={s.actionButtonGhost} activeOpacity={0.8}>
                                    <Text style={s.actionButtonTextGhost}>Dismiss</Text>
                                  </TouchableOpacity>
                                </>
                              ) : (
                                <>
                                  <TouchableOpacity style={s.actionButtonPrimary} activeOpacity={0.8}>
                                    <Text style={s.actionButtonTextPrimary}>Approve</Text>
                                  </TouchableOpacity>
                                  <TouchableOpacity style={s.actionButtonGray} activeOpacity={0.8}>
                                    <Text style={s.actionButtonTextGray}>Details</Text>
                                  </TouchableOpacity>
                                </>
                              )}
                            </View>
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>
            )}

            {/* 2. Group: Today's Activity */}
            {todayActivities.length > 0 && (
              <View style={s.section}>
                <View style={s.sectionHeader}>
                  <Text style={s.sectionTitleActivity}>Today's Activity</Text>
                  <Text style={s.sectionSubtitleActivity}>{todayActivities.length} items</Text>
                </View>

                <View style={s.cardList}>
                  {todayActivities.map((item) => {
                    let iconName: any = 'information-circle-outline';
                    let iconColor: string = C.primary;
                    let iconBg: string = 'rgba(68, 103, 77, 0.1)';

                    if (item.type === 'screentime') {
                      iconName = 'timer-outline';
                      iconColor = C.primary;
                      iconBg = 'rgba(68, 103, 77, 0.1)';
                    } else if (item.type === 'insight') {
                      iconName = 'bulb-outline';
                      iconColor = C.tertiary;
                      iconBg = C.tertiaryContainer;
                    } else if (item.type === 'battery') {
                      iconName = 'battery-dead-outline';
                      iconColor = C.onSurfaceVariant;
                      iconBg = C.surfaceContainerHighest;
                    }

                    return (
                      <View key={item.id} style={s.activityItem}>
                        <View style={[s.activityIconBox, { backgroundColor: iconBg }]}>
                          <Ionicons name={iconName} size={20} color={iconColor} />
                        </View>
                        <View style={s.activityText}>
                          {item.type === 'screentime' ? (
                            <Text style={s.activityTitle}>
                              Screen time limit reached for{' '}
                              <Text style={s.activityTitleBold}>Roblox</Text>
                            </Text>
                          ) : (
                            <Text style={s.activityTitle}>{item.title}</Text>
                          )}
                          <Text style={s.activitySubtitle}>{item.message}</Text>
                        </View>
                        {item.type === 'screentime' ? (
                          <TouchableOpacity style={s.moreButton} activeOpacity={0.7}>
                            <Ionicons name="ellipsis-vertical" size={18} color="rgba(54,50,40,0.3)" />
                          </TouchableOpacity>
                        ) : item.type === 'insight' ? (
                          <Ionicons name="chevron-forward" size={14} color="rgba(68, 103, 77, 0.4)" style={s.chevronRight} />
                        ) : null}
                      </View>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Yesterday Separator */}
            {yesterdayActivities.length > 0 && (
              <View style={s.yesterdaySection}>
                <View style={s.separatorRow}>
                  <View style={s.separatorLine} />
                  <Text style={s.separatorText}>Yesterday</Text>
                  <View style={s.separatorLine} />
                </View>

                <View style={[s.cardList, s.yesterdayList]}>
                  {yesterdayActivities.map((item) => (
                    <View key={item.id} style={s.activityItem}>
                      <View style={[s.activityIconBox, { backgroundColor: C.surfaceContainerHighest }]}>
                        <Ionicons name="checkmark-circle-outline" size={20} color={C.onSurfaceVariant} />
                      </View>
                      <View style={s.activityText}>
                        <Text style={s.activityTitle}>{item.title}</Text>
                        <Text style={s.activitySubtitle}>{item.message}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Bottom space to avoid navbar overlapping */}
            <View style={s.bottomSpacer} />
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.surface,
  },
  safeArea: {
    flex: 1,
  },
  
  /* ---------- Header ---------- */
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: 'rgba(255,248,240,0.85)',
    shadowColor: '#363228',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: C.surfaceContainerLowest,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#363228',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  headerTitle: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 18,
    color: C.onSurface,
    letterSpacing: -0.2,
  },
  headerRight: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },

  /* ---------- Content Scroll ---------- */
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  headerBlock: {
    marginBottom: 24,
  },
  pageTitle: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 28,
    lineHeight: 36,
    color: C.onSurface,
    marginBottom: 20,
  },

  /* ---------- Filter Bar ---------- */
  filterContainer: {
    gap: 12,
    paddingBottom: 4,
  },
  filterButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: C.surfaceContainerHigh,
    borderRadius: 9999,
  },
  filterButtonActive: {
    backgroundColor: C.primary,
    shadowColor: C.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 3,
  },
  filterText: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 14,
    color: C.onSurface,
  },
  filterTextActive: {
    fontFamily: 'PlusJakartaSans-SemiBold',
    color: C.onPrimary,
  },

  /* ---------- Feed space ---------- */
  feedSpace: {
    gap: 32,
  },
  section: {
    gap: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  sectionTitlePriority: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 12,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: C.secondary,
  },
  badgePriority: {
    backgroundColor: C.secondaryContainer,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 9999,
  },
  badgePriorityText: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 10,
    color: C.secondary,
  },
  sectionTitleActivity: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 12,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: 'rgba(54,50,40,0.4)',
  },
  sectionSubtitleActivity: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 10,
    color: 'rgba(54,50,40,0.4)',
  },
  cardList: {
    gap: 16,
  },

  /* ---------- Cards Priority ---------- */
  priorityCardOuter: {
    borderRadius: 24,
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#363228',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  priorityCardOuterRestriction: {
    backgroundColor: '#ffece4', // Solid secondary-container/40 blend over cream base
  },
  priorityCardOuterPermission: {
    backgroundColor: '#fff2ea', // Solid secondary-container/20 blend over cream base
    borderLeftWidth: 4,
    borderLeftColor: 'rgba(160, 65, 45, 0.3)',
  },
  priorityCardAccentBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 6,
    backgroundColor: C.secondary,
  },
  priorityCardInner: {
    padding: 20,
    paddingLeft: 26,
    flexDirection: 'row',
    gap: 16,
    alignItems: 'flex-start',
  },
  priorityIconBlock: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  priorityIconBlockSolid: {
    backgroundColor: C.secondary,
    shadowColor: C.secondary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 4,
  },
  priorityIconBlockOutline: {
    backgroundColor: C.surfaceContainerLowest,
    borderWidth: 2,
    borderColor: 'rgba(160, 65, 45, 0.1)',
  },
  cardBody: {
    flex: 1,
  },
  cardMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  priorityCardTitle: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 14,
  },
  priorityCardTitleRestriction: {
    color: C.onSecondaryContainer,
  },
  priorityCardTitlePermission: {
    color: C.onSurface,
  },
  priorityCardTime: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 10,
  },
  priorityCardTimeRestriction: {
    color: 'rgba(142, 52, 33, 0.6)',
  },
  priorityCardTimePermission: {
    color: 'rgba(54, 50, 40, 0.5)',
  },
  priorityCardMessage: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 13,
    lineHeight: 18,
  },
  priorityCardMessageRestriction: {
    color: 'rgba(142, 52, 33, 0.8)',
  },
  priorityCardMessagePermission: {
    color: C.onSurfaceVariant,
  },
  boldUnderline: {
    fontFamily: 'PlusJakartaSans-Bold',
    textDecorationLine: 'underline',
    color: C.onSecondaryContainer, // Hex '#8e3421' matches warning text exactly!
  },
  boldText: {
    fontFamily: 'PlusJakartaSans-Bold',
    color: C.onSurface,
  },

  /* Buttons Row inside card */
  cardButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  actionButtonSecondary: {
    backgroundColor: C.secondary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 9999,
  },
  actionButtonTextSecondary: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 12,
    color: C.white,
  },
  actionButtonGhost: {
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 9999,
  },
  actionButtonTextGhost: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 12,
    color: C.secondary,
  },
  actionButtonPrimary: {
    backgroundColor: C.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 9999,
  },
  actionButtonTextPrimary: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 12,
    color: C.onPrimary,
  },
  actionButtonGray: {
    backgroundColor: C.surfaceContainerHigh,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 9999,
  },
  actionButtonTextGray: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 12,
    color: C.onSurface,
  },

  /* ---------- Activities Feed ---------- */
  activityItem: {
    backgroundColor: C.surfaceContainerLow,
    padding: 20,
    borderRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  activityIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  activityText: {
    flex: 1,
    gap: 2,
  },
  activityTitle: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 13,
    color: C.onSurface,
    lineHeight: 18,
  },
  activityTitleBold: {
    fontFamily: 'PlusJakartaSans-Bold',
    color: C.primary,
  },
  activitySubtitle: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 11,
    color: 'rgba(54,50,40,0.5)',
  },
  moreButton: {
    padding: 6,
  },
  chevronRight: {
    marginRight: 4,
  },

  /* ---------- Yesterday Section ---------- */
  yesterdaySection: {
    gap: 16,
  },
  separatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 16,
  },
  separatorLine: {
    flex: 1,
    height: 1,
    backgroundColor: C.surfaceContainerHigh,
  },
  separatorText: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 10,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: 'rgba(54,50,40,0.2)',
  },
  yesterdayList: {
    opacity: 0.6,
  },

  /* ---------- Bottom Spacer ---------- */
  bottomSpacer: {
    height: 60,
  },
});
