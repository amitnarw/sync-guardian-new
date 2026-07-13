import React from 'react';
import { View } from 'react-native';

import { Skeleton } from '@/components/ui/skeleton';

export function HomeSkeleton() {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, padding: 12 }}>
      <Skeleton width={52} height={52} borderRadius={26} />
      <View style={{ flex: 1, gap: 8 }}>
        <Skeleton width={140} height={16} borderRadius={8} />
        <Skeleton width={200} height={12} borderRadius={6} />
      </View>
      <View style={{ alignItems: 'flex-end', gap: 6 }}>
        <Skeleton width={12} height={12} borderRadius={6} style={{ alignSelf: 'center' }} />
        <Skeleton width={40} height={12} borderRadius={6} />
      </View>
    </View>
  );
}
