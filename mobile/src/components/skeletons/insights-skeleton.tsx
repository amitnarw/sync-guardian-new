import React from 'react';
import { View } from 'react-native';
import { Skeleton } from '@/components/ui/skeleton';
import { AuthColors, AuthRadius } from '@/constants/auth-theme';

function CardShell({ children, height }: { children: React.ReactNode; height?: number }) {
  return (
    <View
      style={{
        backgroundColor: AuthColors.surfaceContainerLowest,
        borderRadius: AuthRadius.xl,
        padding: 20,
        gap: 12,
        height,
      }}
    >
      {children}
    </View>
  );
}

export function InsightsSkeleton() {
  return (
    <View style={{ gap: 14, paddingTop: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ gap: 8, flex: 1 }}>
          <Skeleton width={120} height={32} borderRadius={8} />
          <Skeleton width={260} height={14} borderRadius={6} />
        </View>
        <Skeleton width={40} height={40} borderRadius={20} />
      </View>

      <View
        style={{
          flexDirection: 'row',
          gap: 8,
          padding: 4,
          backgroundColor: AuthColors.surfaceContainerLow,
          borderRadius: 9999,
        }}
      >
        {['Today', 'Week', 'Month', 'Year'].map((_, i) => (
          <Skeleton key={i} width={'24%'} height={32} borderRadius={9999} />
        ))}
      </View>

      <CardShell height={180}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Skeleton width={20} height={20} borderRadius={9999} />
          <Skeleton width={120} height={12} borderRadius={6} />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 12, marginTop: 12 }}>
          {[1, 2, 3].map((i) => (
            <View key={i} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
              <Skeleton width={'60%'} height={32} borderRadius={6} />
              <Skeleton width={'80%'} height={10} borderRadius={5} />
            </View>
          ))}
        </View>
      </CardShell>

      <CardShell height={64}>
        <Skeleton width={'90%'} height={14} borderRadius={6} />
        <Skeleton width={'70%'} height={14} borderRadius={6} />
      </CardShell>

      <CardShell height={200}>
        <Skeleton width={120} height={16} borderRadius={6} />
        <Skeleton width={'100%'} height={140} borderRadius={12} />
      </CardShell>

      <CardShell height={160}>
        <Skeleton width={110} height={16} borderRadius={6} />
        <Skeleton width={'100%'} height={120} borderRadius={12} />
      </CardShell>

      <View style={{ flexDirection: 'row', gap: 12 }}>
        <CardShell height={180}>
          <Skeleton width={'70%'} height={14} borderRadius={6} />
          <Skeleton width={'50%'} height={32} borderRadius={6} />
          <Skeleton width={'60%'} height={10} borderRadius={5} />
          <Skeleton width={'40%'} height={20} borderRadius={9999} />
        </CardShell>
        <CardShell height={180}>
          <Skeleton width={'70%'} height={14} borderRadius={6} />
          <Skeleton width={'50%'} height={32} borderRadius={6} />
          <Skeleton width={'60%'} height={10} borderRadius={5} />
          <Skeleton width={'40%'} height={20} borderRadius={9999} />
        </CardShell>
      </View>

      <CardShell>
        <Skeleton width={120} height={16} borderRadius={6} />
        {[1, 2, 3].map((i) => (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Skeleton width={36} height={36} borderRadius={9999} />
            <View style={{ flex: 1, gap: 6 }}>
              <Skeleton width={'80%'} height={14} borderRadius={6} />
              <Skeleton width={'100%'} height={8} borderRadius={4} />
            </View>
          </View>
        ))}
      </CardShell>

      <CardShell height={120}>
        <Skeleton width={120} height={16} borderRadius={6} />
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 80 }}>
          {[1, 2, 3, 4, 5, 6, 7].map((i) => (
            <Skeleton key={i} width={'10%'} height={`${20 + i * 10}%`} borderRadius={6} />
          ))}
        </View>
      </CardShell>
    </View>
  );
}
