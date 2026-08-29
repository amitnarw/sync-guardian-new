import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Skeleton } from '@/components/ui/skeleton';

const C = {
  surfaceContainerLowest: '#ffffff',
  surfaceContainer: '#f5ede0',
  surfaceContainerLow: '#faf3e7',
  surfaceContainerHigh: '#efe7da',
} as const;

export function ActivitySkeleton() {
  return (
    <View style={s.container}>
      {/* 1. Date marker skeleton */}
      <View style={s.dateMarker}>
        <View style={s.hairline} />
        <Skeleton width={80} height={22} borderRadius={9999} />
        <View style={s.hairline} />
      </View>

      {/* 2. Timeline items skeleton with social icons + modern chat bubble cards */}
      <View style={s.timelineList}>
        {/* Continuous vertical timeline guide line */}
        <View style={s.timelineLine} />

        {[
          { iconSize: 44, width: '85%', lines: 2, isBubble: true },
          { iconSize: 44, width: '75%', lines: 1, isBubble: true },
          { iconSize: 44, width: '92%', lines: 3, isBubble: false },
          { iconSize: 44, width: '80%', lines: 2, isBubble: true },
        ].map((item, i) => (
          <View key={i} style={s.timelineRow}>
            {/* Social App Icon node circle */}
            <View style={s.iconNode}>
              <Skeleton width={44} height={44} borderRadius={22} />
            </View>

            {/* Notification Card / Bubble */}
            <View style={[s.cardWrap, { width: item.width as any }]}>
              <View style={s.cardBubble}>
                <View style={s.cardHeader}>
                  <Skeleton width={90} height={13} borderRadius={6} />
                  <Skeleton width={44} height={11} borderRadius={5} />
                </View>
                <Skeleton width="100%" height={13} borderRadius={6} />
                {item.lines > 1 && <Skeleton width="75%" height={13} borderRadius={6} />}
                {item.lines > 2 && <Skeleton width="50%" height={13} borderRadius={6} />}
              </View>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    paddingVertical: 12,
  },
  dateMarker: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 16,
    gap: 12,
  },
  hairline: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(47, 74, 55, 0.10)',
  },
  timelineList: {
    position: 'relative',
    marginLeft: 8,
    paddingLeft: 24,
    gap: 20,
  },
  timelineLine: {
    position: 'absolute',
    left: 2,
    top: 22,
    bottom: 22,
    width: 2,
    backgroundColor: C.surfaceContainerHigh,
    borderRadius: 1,
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    position: 'relative',
  },
  iconNode: {
    position: 'absolute',
    left: -44,
    top: 0,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: C.surfaceContainerLowest,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#363228',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 2,
  },
  cardWrap: {
    marginLeft: 6,
  },
  cardBubble: {
    backgroundColor: C.surfaceContainerLowest,
    borderRadius: 18,
    borderTopLeftRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8,
    shadowColor: '#363228',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1.5,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
});
