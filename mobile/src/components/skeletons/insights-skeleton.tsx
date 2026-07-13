import React from 'react';
import { View } from 'react-native';

import { Skeleton } from '@/components/ui/skeleton';

const C = {
  primary: '#44674d',
  surface: '#fff8f0',
  surfaceContainerLowest: '#ffffff',
  surfaceContainer: '#f5ede0',
  surfaceContainerLow: '#faf3e7',
  surfaceVariant: '#eae1d2',
  onSurface: '#363228',
  onSurfaceVariant: '#645e53',
} as const;

export function InsightsSkeleton() {
  return (
    <View style={{ gap: 16, paddingTop: 16 }}>
      {/* Hero Section */}
      <View style={{ marginBottom: 8, gap: 10 }}>
        <Skeleton width={160} height={30} borderRadius={8} />
        <Skeleton width={280} height={16} borderRadius={6} />
      </View>

      {/* Window Selector Pills */}
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
        {['Today', 'Week', 'Month', 'Year'].map((_, i) => (
          <Skeleton key={i} width={70} height={32} borderRadius={9999} />
        ))}
      </View>

      {/* Pulse Narrative Card */}
      <View style={{ backgroundColor: C.surfaceContainerLowest, borderRadius: 32, padding: 24, gap: 10 }}>
        <Skeleton width={100} height={12} borderRadius={6} />
        <Skeleton width="90%" height={16} borderRadius={8} />
        <Skeleton width="60%" height={16} borderRadius={8} />
      </View>

      {/* Total Usage Card */}
      <View style={{ backgroundColor: C.surfaceContainerLowest, borderRadius: 32, padding: 24, gap: 16 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <View style={{ gap: 6 }}>
            <Skeleton width={120} height={20} borderRadius={10} />
            <Skeleton width={160} height={12} borderRadius={6} />
          </View>
          <View style={{ alignItems: 'flex-end', gap: 6 }}>
            <Skeleton width={80} height={24} borderRadius={12} />
            <Skeleton width={120} height={12} borderRadius={6} />
          </View>
        </View>
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            height: 120,
            alignItems: 'flex-end',
            paddingTop: 16,
          }}
        >
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} width={42} height={`${20 + i * 15}%`} borderRadius={9999} />
          ))}
        </View>
      </View>

      {/* Peak Hours Card */}
      <View style={{ backgroundColor: C.surfaceContainerLowest, borderRadius: 32, padding: 24, gap: 16 }}>
        <Skeleton width={120} height={20} borderRadius={10} />
        <View style={{ height: 120, justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Skeleton width={30} height={10} borderRadius={5} />
            <Skeleton width={30} height={10} borderRadius={5} />
            <Skeleton width={30} height={10} borderRadius={5} />
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} width={48} height={`${30 + i * 10}%`} borderRadius={6} />
            ))}
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} width={32} height={10} borderRadius={5} />
            ))}
          </View>
        </View>
      </View>

      {/* App Insights Card */}
      <View style={{ backgroundColor: C.surfaceContainerLowest, borderRadius: 32, padding: 24, gap: 16 }}>
        <Skeleton width={130} height={20} borderRadius={10} />
        {[1, 2, 3, 4].map((i) => (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Skeleton width={40} height={40} borderRadius={12} />
            <Skeleton width={100} height={14} borderRadius={7} style={{ flexShrink: 1 }} />
            <View style={{ flex: 1, height: 16, borderRadius: 9999, backgroundColor: C.surfaceContainer }}>
              <Skeleton width={`${70 - i * 10}%`} height={16} borderRadius={9999} />
            </View>
            <Skeleton width={28} height={12} borderRadius={6} />
          </View>
        ))}
      </View>

      {/* Latest Notification Card */}
      <View
        style={{
          backgroundColor: C.surfaceContainerLow,
          borderRadius: 24,
          padding: 20,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <Skeleton width={40} height={40} borderRadius={20} />
        <View style={{ flex: 1, gap: 6 }}>
          <Skeleton width={90} height={12} borderRadius={6} />
          <Skeleton width="80%" height={15} borderRadius={7} />
        </View>
        <Skeleton width={50} height={12} borderRadius={6} />
      </View>

      {/* Encrypt Badge */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          paddingVertical: 8,
        }}
      >
        <Skeleton width={14} height={14} borderRadius={7} />
        <Skeleton width={240} height={11} borderRadius={5} />
      </View>
    </View>
  );
}
