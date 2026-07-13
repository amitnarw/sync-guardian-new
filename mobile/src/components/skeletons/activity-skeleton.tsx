import React from 'react';
import { View } from 'react-native';

import { Skeleton } from '@/components/ui/skeleton';

const C = {
  surfaceContainerLowest: '#ffffff',
  surfaceContainer: '#f5ede0',
} as const;

export function ActivitySkeleton() {
  return (
    <View style={{ gap: 24, paddingVertical: 16 }}>
      {[1, 2, 3, 4].map((i) => (
        <View key={i} style={{ flexDirection: 'row', gap: 16, alignItems: 'flex-start' }}>
          <Skeleton width={44} height={44} borderRadius={22} />
          <View
            style={{
              flex: 1,
              backgroundColor: C.surfaceContainerLowest,
              borderRadius: 28,
              padding: 20,
              gap: 10,
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Skeleton width={80} height={12} borderRadius={6} />
              <Skeleton width={40} height={16} borderRadius={9999} />
            </View>
            <Skeleton width="70%" height={20} borderRadius={10} style={{ marginVertical: 4 }} />
            <Skeleton width="100%" height={14} borderRadius={7} />
            <Skeleton width="85%" height={14} borderRadius={7} />
          </View>
        </View>
      ))}
    </View>
  );
}
