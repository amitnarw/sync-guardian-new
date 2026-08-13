import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AuthColors as C, AuthFonts } from '@/constants/auth-theme';

interface PriceProps {
  amountPaise: number;
  period: 'month' | 'year';
  tone?: 'onSurface' | 'onPrimary';
  size?: 'lg' | 'md';
}

export function Price({ amountPaise, period, tone = 'onSurface', size = 'lg' }: PriceProps) {
  const labelColor = tone === 'onPrimary' ? C.onPrimary : C.onSurface;
  const mutedColor = tone === 'onPrimary' ? C.onPrimary : C.onSurfaceVariant;

  const symbolSize = size === 'lg' ? 22 : 18;
  const numberSize = size === 'lg' ? 40 : 32;
  const periodSize = size === 'lg' ? 14 : 12;
  const symbolOffset = size === 'lg' ? 8 : 6;

  return (
    <View style={s.row}>
      <Text
        style={[
          s.symbol,
          {
            fontSize: symbolSize,
            lineHeight: symbolSize + 4,
            color: mutedColor,
            marginTop: symbolOffset,
          },
        ]}
      >
        ₹
      </Text>
      <Text
        selectable
        style={[
          s.number,
          {
            fontSize: numberSize,
            lineHeight: numberSize + 4,
            color: labelColor,
          },
        ]}
      >
        {Math.floor(amountPaise / 100)}
      </Text>
      <Text
        style={[
          s.period,
          {
            fontSize: periodSize,
            lineHeight: periodSize + 4,
            color: mutedColor,
            marginTop: size === 'lg' ? 14 : 10,
          },
        ]}
      >
        /{period}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
  },
  symbol: {
    ...AuthFonts.titleSmall,
    fontWeight: '400',
  },
  number: {
    fontFamily: 'PlusJakartaSans-ExtraBold',
    fontWeight: '800',
    letterSpacing: -1,
    fontVariant: ['tabular-nums'],
  },
  period: {
    ...AuthFonts.labelMedium,
    fontWeight: '500',
    marginLeft: 4,
  },
});