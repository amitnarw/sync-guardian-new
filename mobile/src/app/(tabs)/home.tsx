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
import { SymbolView } from 'expo-symbols';

const hearthShapeBlock = "M153.6 0 C 210.16 0 256 57.3 256 128 C 256 212.8 175.7 256 76.8 256 C 34.39 256 0 175.73 0 102.4 C 0 34.39 68.76 0 153.6 0 Z";

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

          {/* Daily Rhythm Hero Redesign */}
          <View style={styles.newHeroSection}>
            <View style={styles.heroTextContent}>
              <ThemedText style={styles.newFlowLabel}>MORNING FLOW</ThemedText>
              <ThemedText style={styles.newHeroTitle}>
                Gentle rhythm for{'\n'}
                <ThemedText style={styles.newHeroTitlePrimary}>Leo's Wednesday</ThemedText>
              </ThemedText>
              <ThemedText style={styles.newHeroDescription}>
                Currently in "Creative Exploration" block. The digital sanctuary is maintaining a soft focus environment.
              </ThemedText>

              <View style={styles.newButtonRow}>
                <TouchableOpacity style={[styles.newPrimaryButton, styles.shadowPrimary]}>
                  <ThemedText style={styles.newPrimaryButtonText}>Adjust Rhythm</ThemedText>
                </TouchableOpacity>
                <TouchableOpacity style={styles.newSecondaryButton}>
                  <ThemedText style={styles.newSecondaryButtonText}>View Schedule</ThemedText>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.visualContainer}>
              {/* Hearth Shape Visual */}
              <View style={styles.hearthVisualStack}>
                <LinearGradient
                  colors={[AuthColors.primary, AuthColors.primaryContainer]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.hearthGradient}
                >
                  <Svg width={200} height={200} viewBox="0 0 256 256" style={styles.hearthSvg}>
                    <Path d={hearthShapeBlock} fill="rgba(255,255,255,0.2)" />
                  </Svg>
                  <View style={styles.hearthIconOverlay}>
                    <View style={styles.hearthIconInner}>
                      <SymbolView 
                        name="shield_with_heart" 
                        size={64} 
                        type="monochrome"
                        tintColor="#ffffff" 
                      />
                    </View>
                  </View>
                </LinearGradient>
                
                {/* Decorative Blur Background Element */}
                <View style={styles.decorativeBlob} />

                {/* Floating Overlay Card */}
                <View style={styles.floatingTimerCard}>
                  <View style={styles.timerHeader}>
                    <SymbolView name="timer" size={20} tintColor={AuthColors.secondary} />
                    <ThemedText style={styles.timerText}>1h 12m Remaining</ThemedText>
                  </View>
                  <View style={styles.timerProgressBar}>
                    <View style={styles.timerProgressFill} />
                  </View>
                </View>
              </View>
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
  newHeroSection: {
    marginBottom: AuthSpacing.xxl,
  },
  heroTextContent: {
    marginBottom: AuthSpacing.xl,
    gap: AuthSpacing.md,
  },
  newFlowLabel: {
    ...AuthFonts.labelMedium,
    color: AuthColors.secondary,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  newHeroTitle: {
    ...AuthFonts.displaySmall,
    color: AuthColors.onSurface,
    lineHeight: 40,
    fontWeight: '800',
  },
  newHeroTitlePrimary: {
    color: AuthColors.primary,
    fontStyle: 'italic',
  },
  newHeroDescription: {
    ...AuthFonts.bodyLarge,
    color: AuthColors.onSurfaceVariant,
    lineHeight: 24,
    maxWidth: 320,
  },
  newButtonRow: {
    flexDirection: 'row',
    gap: AuthSpacing.md,
    marginTop: AuthSpacing.sm,
  },
  newPrimaryButton: {
    backgroundColor: AuthColors.primary,
    paddingHorizontal: AuthSpacing.xl,
    paddingVertical: AuthSpacing.md,
    borderRadius: AuthRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  newPrimaryButtonText: {
    ...AuthFonts.labelLarge,
    color: AuthColors.onPrimary,
    fontWeight: '700',
  },
  newSecondaryButton: {
    backgroundColor: AuthColors.surfaceContainerHigh,
    paddingHorizontal: AuthSpacing.xl,
    paddingVertical: AuthSpacing.md,
    borderRadius: AuthRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  newSecondaryButtonText: {
    ...AuthFonts.labelLarge,
    color: AuthColors.onSurface,
    fontWeight: '700',
  },
  shadowPrimary: {
    shadowColor: AuthColors.primary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 5,
  },
  visualContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: AuthSpacing.lg,
  },
  hearthVisualStack: {
    width: 300,
    height: 300,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hearthGradient: {
    width: 260,
    height: 260,
    borderRadius: AuthRadius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    ...AuthShadows.float,
  },
  hearthSvg: {
    position: 'absolute',
    opacity: 0.2,
  },
  hearthIconOverlay: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  hearthIconInner: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  decorativeBlob: {
    position: 'absolute',
    top: -20,
    left: -20,
    width: 80,
    height: 80,
    backgroundColor: 'rgba(159, 64, 45, 0.1)',
    borderRadius: 40,
    zIndex: -1,
  },
  floatingTimerCard: {
    position: 'absolute',
    bottom: 20,
    left: -20,
    backgroundColor: AuthColors.surfaceContainerLowest,
    padding: AuthSpacing.md,
    borderRadius: AuthRadius.md,
    minWidth: 180,
    ...AuthShadows.ambient,
    borderWidth: 1,
    borderColor: 'rgba(67, 72, 61, 0.1)',
  },
  timerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: AuthSpacing.sm,
    marginBottom: AuthSpacing.sm,
  },
  timerText: {
    ...AuthFonts.labelLarge,
    color: AuthColors.onSurface,
    fontWeight: '800',
  },
  timerProgressBar: {
    height: 6,
    width: '100%',
    backgroundColor: AuthColors.surfaceContainerHigh,
    borderRadius: 3,
    overflow: 'hidden',
  },
  timerProgressFill: {
    height: '100%',
    backgroundColor: AuthColors.secondary,
    width: '66%',
    borderRadius: 3,
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