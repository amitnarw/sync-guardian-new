import React from 'react';
import { StyleSheet, ScrollView, View, TouchableOpacity, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Path } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { AuthColors, AuthFonts, AuthSpacing, AuthRadius, AuthGradients, AuthShadows } from '@/constants/auth-theme';
import { Button } from '@/components/ui/button';

export default function HomeScreen() {
  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Dashboard Header */}
          <View style={styles.header}>
            <View style={styles.profileArea}>
              <Image 
                source={require('@/assets/images/mother_avatar.png')} 
                style={styles.avatar} 
              />
              <ThemedText style={styles.profileName}>Nurturing Mother</ThemedText>
            </View>
            <TouchableOpacity style={styles.notificationButton}>
              <Ionicons name="notifications-outline" size={24} color={AuthColors.onSurface} />
              <View style={styles.notificationBadge} />
            </TouchableOpacity>
          </View>

          {/* Daily Rhythm Hero */}
          <View style={styles.heroSection}>
            <ThemedText style={styles.flowLabel}>MORNING FLOW</ThemedText>
            <ThemedText style={styles.heroTitle}>
              Gentle rhythm for{'\n'}
              <ThemedText style={styles.heroTitlePrimary}>Leo's Wednesday</ThemedText>
            </ThemedText>
            <ThemedText style={styles.heroDescription}>
              Currently in 'Creative Exploration' block. The digital sanctuary is maintaining a calm focus environment.
            </ThemedText>

            <View style={styles.buttonRow}>
              <Button 
                title="Adjust Rhythm"
                onPress={() => {}}
                style={styles.homeBtn}
              />
              <Button 
                title="View Schedule"
                onPress={() => {}}
                variant="secondary"
                style={styles.homeBtn}
              />
            </View>
          </View>

          {/* Sync Orb Section */}
          <View style={styles.orbContainer}>
            <View style={styles.orbStack}>
              {/* Outer Glows/Circles */}
              <View style={[styles.orbCircle, styles.orbOuter, { backgroundColor: AuthColors.surfaceContainer }]} />
              <View style={[styles.orbCircle, styles.orbMiddle, { backgroundColor: AuthColors.primaryFixed }]} />
              <View style={[styles.orbCircle, styles.orbInner, { backgroundColor: AuthColors.primaryFixedDim }]}>
                <Ionicons name="shield-checkmark" size={48} color={AuthColors.primary} />
              </View>
            </View>
            <View style={styles.timeLabelContainer}>
              <ThemedText style={styles.timeLabel}>1h 12m Remaining</ThemedText>
            </View>
          </View>

          {/* Leo is Online Card */}
          <ThemedView style={styles.childCard}>
            <View style={styles.childHeader}>
              <View style={styles.childProfileContainer}>
                <Image 
                  source={require('@/assets/images/leo_avatar.png')} 
                  style={styles.childAvatar} 
                />
                <View style={styles.onlineBadge} />
              </View>
              <View style={styles.childInfo}>
                <ThemedText style={styles.childName}>Leo is Online</ThemedText>
                <ThemedText style={styles.childActivity}>Currently using <ThemedText style={styles.appStrong}>Khan Academy</ThemedText></ThemedText>
              </View>
            </View>
            
            <View style={styles.childStats}>
              <View style={styles.statBadge}>
                <Ionicons name="battery-charging" size={16} color={AuthColors.primary} />
                <ThemedText style={styles.statText}>92%</ThemedText>
              </View>
              <View style={styles.statBadge}>
                <Ionicons name="home-outline" size={16} color={AuthColors.primary} />
                <ThemedText style={styles.statText}>Home</ThemedText>
              </View>
            </View>

            <View style={styles.syncPercentage}>
              <ThemedText style={styles.percentageText}>92%</ThemedText>
              <ThemedText style={styles.percentageLabel}>Harmony Level</ThemedText>
            </View>
          </ThemedView>

          {/* Routine Card */}
          <TouchableOpacity>
            <View style={styles.routineCard}>
              <View style={styles.routineIconContainer}>
                <Ionicons name="moon" size={24} color={AuthColors.onPrimary} />
              </View>
              <ThemedText style={styles.routineTitle}>Bedtime Routine starts in 2h</ThemedText>
              <Ionicons name="chevron-forward" size={20} color={AuthColors.onPrimary} style={{ opacity: 0.6 }} />
            </View>
          </TouchableOpacity>

          {/* Most Active Apps */}
          <View style={styles.appsSection}>
            <View style={styles.sectionHeader}>
              <ThemedText style={styles.sectionTitle}>Most active apps</ThemedText>
              <TouchableOpacity>
                <ThemedText style={styles.viewAllText}>View all</ThemedText>
              </TouchableOpacity>
            </View>

            <View style={styles.appList}>
              {[
                { name: 'Khan Academy', duration: '45m', color: '#486730', icon: 'school-outline' },
                { name: 'YouTube Kids', duration: '20m', color: '#E2725B', icon: 'logo-youtube' },
                { name: 'Duolingo', duration: '15m', color: '#87A96B', icon: 'language-outline' },
              ].map((app, index) => (
                <View key={index} style={styles.appItem}>
                  <View style={[styles.appIconContainer, { backgroundColor: AuthColors.surfaceContainerLow }]}>
                    <Ionicons name={app.icon as any} size={20} color={AuthColors.primary} />
                  </View>
                  <View style={styles.appDetails}>
                    <View style={styles.appHeader}>
                      <ThemedText style={styles.appName}>{app.name}</ThemedText>
                      <ThemedText style={styles.appDuration}>{app.duration}</ThemedText>
                    </View>
                    <View style={styles.progressBarContainer}>
                      <View style={[styles.progressBarFill, { width: app.duration === '45m' ? '70%' : app.duration === '20m' ? '40%' : '25%', backgroundColor: app.color }]} />
                    </View>
                  </View>
                </View>
              ))}
            </View>
          </View>

          {/* Daily Insights Card */}
          <ThemedView style={styles.insightsCard}>
            <View style={styles.insightsHeader}>
              <ThemedText style={styles.dailyInsightsLabel}>DAILY INSIGHTS</ThemedText>
              <MaterialCommunityIcons name="chart-bell-curve" size={24} color={AuthColors.tertiary} />
            </View>
            <ThemedText style={styles.insightsTitle}>Healthy Balance{'\n'}Achieved Today.</ThemedText>
            <ThemedText style={styles.insightsDescription}>
              Educational content outpaced entertainment by 2.1 hours. Great job guiding Leo's journey!
            </ThemedText>
            <Button 
               title="Explore Detailed Insights"
               onPress={() => {}}
               variant="secondary"
            />
          </ThemedView>

          <View style={{ height: 100 }} />
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AuthColors.surface,
  },
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: AuthSpacing.lg,
    paddingTop: AuthSpacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: AuthSpacing.xl,
  },
  profileArea: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: AuthSpacing.sm,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: AuthColors.surfaceContainer,
  },
  profileName: {
    ...AuthFonts.titleSmall,
    color: AuthColors.onSurface,
  },
  notificationButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: AuthColors.surfaceContainerLowest,
    justifyContent: 'center',
    alignItems: 'center',
    ...AuthShadows.ambient,
  },
  notificationBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: AuthColors.secondary,
    borderWidth: 2,
    borderColor: AuthColors.surfaceContainerLowest,
  },
  heroSection: {
    marginBottom: AuthSpacing.xl,
  },
  flowLabel: {
    ...AuthFonts.labelMedium,
    color: AuthColors.secondary,
    letterSpacing: 1.5,
    marginBottom: AuthSpacing.xs,
  },
  heroTitle: {
    ...AuthFonts.displaySmall,
    color: AuthColors.onSurface,
    lineHeight: 40,
    marginBottom: AuthSpacing.sm,
  },
  heroTitlePrimary: {
    color: AuthColors.primary,
    fontStyle: 'italic',
  },
  heroDescription: {
    ...AuthFonts.bodyMedium,
    color: AuthColors.onSurfaceVariant,
    lineHeight: 20,
    marginBottom: AuthSpacing.lg,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: AuthSpacing.md,
  },
  homeBtn: {
    flex: 1,
    height: 56,
  },
  orbContainer: {
    alignItems: 'center',
    marginBottom: AuthSpacing.xxl,
  },
  orbStack: {
    width: 240,
    height: 240,
    justifyContent: 'center',
    alignItems: 'center',
  },
  orbCircle: {
    position: 'absolute',
    borderRadius: 120,
  },
  orbOuter: {
    width: 280,
    height: 280,
    opacity: 0.3,
  },
  orbMiddle: {
    width: 220,
    height: 220,
    opacity: 0.5,
  },
  orbInner: {
    width: 160,
    height: 160,
    justifyContent: 'center',
    alignItems: 'center',
    ...AuthShadows.float,
  },
  timeLabelContainer: {
    backgroundColor: AuthColors.surfaceContainerLowest,
    paddingHorizontal: AuthSpacing.md,
    paddingVertical: AuthSpacing.xs,
    borderRadius: AuthRadius.full,
    marginTop: -20,
    ...AuthShadows.ambient,
  },
  timeLabel: {
    ...AuthFonts.labelMedium,
    color: AuthColors.error,
    fontWeight: '700',
  },
  childCard: {
    backgroundColor: AuthColors.surfaceContainerLowest,
    borderRadius: AuthRadius.xl,
    padding: AuthSpacing.lg,
    marginBottom: AuthSpacing.md,
    ...AuthShadows.ambient,
  },
  childHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: AuthSpacing.lg,
  },
  childProfileContainer: {
    position: 'relative',
  },
  childAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: AuthColors.surfaceContainer,
  },
  onlineBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#4CAF50',
    borderWidth: 2,
    borderColor: AuthColors.surfaceContainerLowest,
  },
  childInfo: {
    marginLeft: AuthSpacing.md,
    flex: 1,
  },
  childName: {
    ...AuthFonts.titleLarge,
    color: AuthColors.onSurface,
    fontWeight: '700',
  },
  childActivity: {
    ...AuthFonts.bodySmall,
    color: AuthColors.onSurfaceVariant,
  },
  appStrong: {
    fontWeight: '700',
    color: AuthColors.primary,
  },
  childStats: {
    flexDirection: 'row',
    gap: AuthSpacing.sm,
    marginBottom: AuthSpacing.xl,
  },
  statBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: AuthColors.surfaceContainerLow,
    paddingHorizontal: AuthSpacing.sm,
    paddingVertical: 4,
    borderRadius: AuthRadius.full,
  },
  statText: {
    ...AuthFonts.labelSmall,
    color: AuthColors.primary,
  },
  syncPercentage: {
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: AuthColors.outlineVariant,
    paddingTop: AuthSpacing.md,
  },
  percentageText: {
    ...AuthFonts.displayMedium,
    color: AuthColors.primary,
    lineHeight: 48,
  },
  percentageLabel: {
    ...AuthFonts.labelSmall,
    color: AuthColors.onSurfaceVariant,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  routineCard: {
    backgroundColor: AuthColors.primary,
    borderRadius: AuthRadius.lg,
    padding: AuthSpacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: AuthSpacing.md,
    marginBottom: AuthSpacing.xxl,
  },
  routineIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  routineTitle: {
    ...AuthFonts.titleMedium,
    color: AuthColors.onPrimary,
    flex: 1,
  },
  appsSection: {
    marginBottom: AuthSpacing.xxl,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: AuthSpacing.md,
  },
  sectionTitle: {
    ...AuthFonts.titleMedium,
    color: AuthColors.onSurface,
    fontWeight: '700',
  },
  viewAllText: {
    ...AuthFonts.labelMedium,
    color: AuthColors.primary,
  },
  appList: {
    gap: AuthSpacing.md,
  },
  appItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: AuthSpacing.md,
  },
  appIconContainer: {
    width: 48,
    height: 48,
    borderRadius: AuthRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  appDetails: {
    flex: 1,
  },
  appHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  appName: {
    ...AuthFonts.labelLarge,
    color: AuthColors.onSurface,
  },
  appDuration: {
    ...AuthFonts.labelMedium,
    color: AuthColors.onSurfaceVariant,
  },
  progressBarContainer: {
    height: 6,
    backgroundColor: AuthColors.surfaceContainer,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  insightsCard: {
    backgroundColor: AuthColors.surfaceContainerHigh,
    borderRadius: AuthRadius.xl,
    padding: AuthSpacing.lg,
    ...AuthShadows.ambient,
  },
  insightsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: AuthSpacing.sm,
  },
  dailyInsightsLabel: {
    ...AuthFonts.labelSmall,
    color: AuthColors.tertiary,
    letterSpacing: 1.5,
  },
  insightsTitle: {
    ...AuthFonts.headlineSmall,
    color: AuthColors.onSurface,
    marginBottom: AuthSpacing.sm,
  },
  insightsDescription: {
    ...AuthFonts.bodyMedium,
    color: AuthColors.onSurfaceVariant,
    lineHeight: 20,
    marginBottom: AuthSpacing.lg,
  },
  exploreButton: {
    backgroundColor: AuthColors.surfaceContainerLowest,
    paddingVertical: AuthSpacing.md,
    borderRadius: AuthRadius.full,
    alignItems: 'center',
  },
  exploreButtonText: {
    ...AuthFonts.labelLarge,
    color: AuthColors.onSurface,
  },
});