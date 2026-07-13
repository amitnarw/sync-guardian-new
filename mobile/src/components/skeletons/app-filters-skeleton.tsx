import React from 'react';
import { View } from 'react-native';

import { Skeleton } from '@/components/ui/skeleton';

export function AppFiltersSkeleton() {
  return (
    <View style={{ flex: 1, gap: 16, paddingHorizontal: 24, paddingTop: 16 }}>
      {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
        <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 16, height: 60 }}>
          <Skeleton width={40} height={40} borderRadius={12} />
          <View style={{ flex: 1, gap: 6 }}>
            <Skeleton width={140} height={16} borderRadius={8} />
            <Skeleton width={200} height={12} borderRadius={6} />
          </View>
          <Skeleton width={32} height={20} borderRadius={10} />
        </View>
      ))}
    </View>
  );
}
