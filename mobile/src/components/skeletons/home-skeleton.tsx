import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Skeleton } from '@/components/ui/skeleton';

const C = {
  surfaceContainerLowest: '#ffffff',
  surfaceContainer: '#f5ede0',
  surfaceContainerLow: '#faf3e7',
  surfaceContainerHigh: '#efe7da',
} as const;

export function HomeSkeleton() {
  return (
    <View style={s.container}>
      {/* 1. Hero Card Skeleton */}
      <View style={s.heroCard}>
        <View style={s.heroTextBlock}>
          <Skeleton width={100} height={12} borderRadius={6} />
          <Skeleton width={180} height={26} borderRadius={8} />
          <Skeleton width="85%" height={14} borderRadius={7} />
          <Skeleton width="65%" height={14} borderRadius={7} />
          <View style={s.heroButtons}>
            <Skeleton width={110} height={40} borderRadius={9999} />
            <Skeleton width={110} height={40} borderRadius={9999} />
          </View>
        </View>
        <View style={s.heroVisual}>
          <Skeleton width={88} height={88} borderRadius={44} />
        </View>
      </View>

      {/* 2. Monitoring Health Bento Grid Skeleton */}
      <View style={s.healthSection}>
        <View style={s.healthBentoRow}>
          {/* Left: status card */}
          <View style={s.healthStatusCard}>
            <Skeleton width={18} height={18} borderRadius={9} />
            <Skeleton width={80} height={18} borderRadius={6} />
            <Skeleton width={96} height={22} borderRadius={9999} />
            <Skeleton width={110} height={12} borderRadius={6} />
          </View>
          {/* Right: notifications count card */}
          <View style={s.healthStatCard}>
            <Skeleton width={32} height={32} borderRadius={16} />
            <Skeleton width={60} height={36} borderRadius={8} />
            <Skeleton width={80} height={12} borderRadius={6} />
          </View>
        </View>

        {/* Sync status pills */}
        <View style={s.healthPills}>
          <View style={s.healthPillRow}>
            <Skeleton width={28} height={28} borderRadius={14} />
            <View style={{ flex: 1, gap: 4 }}>
              <Skeleton width={90} height={11} borderRadius={5} />
              <Skeleton width={130} height={13} borderRadius={6} />
            </View>
            <Skeleton width={8} height={8} borderRadius={4} />
          </View>
          <View style={s.healthPillRow}>
            <Skeleton width={28} height={28} borderRadius={14} />
            <View style={{ flex: 1, gap: 4 }}>
              <Skeleton width={90} height={11} borderRadius={5} />
              <Skeleton width={150} height={13} borderRadius={6} />
            </View>
          </View>
        </View>
      </View>

      {/* 3. Most Active Apps Skeleton */}
      <View style={s.appsSection}>
        <View style={s.appsHeader}>
          <Skeleton width={130} height={18} borderRadius={6} />
          <Skeleton width={50} height={14} borderRadius={6} />
        </View>
        <View style={s.appsList}>
          {[1, 2, 3].map((i) => (
            <View key={i} style={s.appItem}>
              <Skeleton width={44} height={44} borderRadius={16} />
              <View style={{ flex: 1, gap: 6 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Skeleton width={100} height={14} borderRadius={7} />
                  <Skeleton width={70} height={12} borderRadius={6} />
                </View>
                <Skeleton width="60%" height={11} borderRadius={5} />
              </View>
            </View>
          ))}
        </View>
      </View>

      {/* 4. App Variety Card Skeleton */}
      <View style={s.varietyCard}>
        <Skeleton width={90} height={20} borderRadius={9999} />
        <Skeleton width={120} height={28} borderRadius={8} />
        <Skeleton width="80%" height={14} borderRadius={7} />
        <Skeleton width={120} height={36} borderRadius={9999} style={{ marginTop: 8 }} />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    gap: 16,
    paddingVertical: 8,
  },
  heroCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: C.surfaceContainerLowest,
    borderRadius: 32,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(47, 74, 55, 0.08)',
  },
  heroTextBlock: {
    flex: 1,
    gap: 10,
  },
  heroButtons: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  heroVisual: {
    marginLeft: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  healthSection: {
    gap: 10,
  },
  healthBentoRow: {
    flexDirection: 'row',
    gap: 10,
  },
  healthStatusCard: {
    flex: 1,
    backgroundColor: C.surfaceContainerLowest,
    borderRadius: 24,
    padding: 18,
    gap: 10,
    borderWidth: 1,
    borderColor: 'rgba(47, 74, 55, 0.08)',
  },
  healthStatCard: {
    width: 130,
    backgroundColor: C.surfaceContainerLowest,
    borderRadius: 24,
    padding: 18,
    gap: 10,
    borderWidth: 1,
    borderColor: 'rgba(47, 74, 55, 0.08)',
  },
  healthPills: {
    backgroundColor: C.surfaceContainerLowest,
    borderRadius: 20,
    padding: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(47, 74, 55, 0.08)',
  },
  healthPillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 4,
  },
  appsSection: {
    backgroundColor: C.surfaceContainerLowest,
    borderRadius: 24,
    padding: 18,
    gap: 14,
    borderWidth: 1,
    borderColor: 'rgba(47, 74, 55, 0.08)',
  },
  appsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  appsList: {
    gap: 12,
  },
  appItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  varietyCard: {
    backgroundColor: C.surfaceContainerLowest,
    borderRadius: 28,
    padding: 22,
    gap: 10,
    borderWidth: 1,
    borderColor: 'rgba(47, 74, 55, 0.08)',
  },
});
