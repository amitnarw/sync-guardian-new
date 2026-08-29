import React, { useMemo } from 'react';
import { StyleSheet, View, Text } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { AuthColors, AuthFonts } from '@/constants/auth-theme';
import type { PeakBucket } from '@/lib/notification-analytics';
import { InsightCard } from './insight-card';

interface InsightsPeakHoursProps {
  buckets: PeakBucket[];
  mostActiveBucket: PeakBucket | null;
}

const CHART_WIDTH = 340;
const CHART_HEIGHT = 150;

export function InsightsPeakHours({ buckets, mostActiveBucket }: InsightsPeakHoursProps) {
  const { areaPath, linePath, maxVal } = useMemo(() => {
    const max = Math.max(...buckets.map((b) => b.count), 1);
    const padding = { top: 16, bottom: 28, left: 8, right: 8 };
    const innerW = CHART_WIDTH - padding.left - padding.right;
    const innerH = CHART_HEIGHT - padding.top - padding.bottom;
    const stepX = buckets.length > 1 ? innerW / (buckets.length - 1) : 0;
    const pts = buckets.map((b, i) => ({
      x: padding.left + i * stepX,
      y: padding.top + innerH - (b.count / max) * innerH,
      count: b.count,
    }));
    let path = `M ${pts[0].x},${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i];
      const p1 = pts[i + 1];
      const cx1 = p0.x + (p1.x - p0.x) * 0.5;
      const cx2 = p1.x - (p1.x - p0.x) * 0.5;
      path += ` C ${cx1},${p0.y} ${cx2},${p1.y} ${p1.x},${p1.y}`;
    }
    const fillPath = `${path} L ${pts[pts.length - 1].x},${padding.top + innerH} L ${pts[0].x},${padding.top + innerH} Z`;
    return { areaPath: fillPath, linePath: path, maxVal: max };
  }, [buckets]);

  const totalPings = buckets.reduce((s, b) => s + b.count, 0);

  return (
    <InsightCard
      title="Peak hours"
      subtitle={mostActiveBucket ? `Most activity ${mostActiveBucket.label.toLowerCase()} · ${totalPings} total` : `${totalPings} total`}
      icon="time-outline"
    >
      <View style={s.chartWrap}>
        <Svg width="100%" height={CHART_HEIGHT} viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} preserveAspectRatio="none">
          <Defs>
            <LinearGradient id="peakFill" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor={AuthColors.primary} stopOpacity={0.35} />
              <Stop offset="100%" stopColor={AuthColors.primary} stopOpacity={0} />
            </LinearGradient>
            <LinearGradient id="peakStroke" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0%" stopColor={AuthColors.primary} stopOpacity={0.6} />
              <Stop offset="100%" stopColor={AuthColors.primary} stopOpacity={1} />
            </LinearGradient>
          </Defs>
          {[1, 2, 3].map((i) => (
            <Rect
              key={i}
              x={0}
              y={(i * CHART_HEIGHT) / 4}
              width={CHART_WIDTH}
              height={1}
              fill={AuthColors.outlineVariant}
              opacity={0.25}
            />
          ))}
          {areaPath ? <Path d={areaPath} fill="url(#peakFill)" /> : null}
          {linePath ? <Path d={linePath} fill="none" stroke="url(#peakStroke)" strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" /> : null}
        </Svg>
        <View style={s.xLabels}>
          {buckets.map((b, i) => (
            <Text key={i} style={s.xLabelText} numberOfLines={1}>
              {b.label}
            </Text>
          ))}
        </View>
      </View>
      {maxVal > 0 ? (
        <View style={s.scaleRow}>
          <Text style={s.scaleText}>Low</Text>
          <Text style={s.scaleText}>Med</Text>
          <Text style={s.scaleText}>{maxVal} max</Text>
        </View>
      ) : null}
    </InsightCard>
  );
}

const s = StyleSheet.create({
  chartWrap: { marginTop: 8 },
  xLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
    paddingHorizontal: 4,
  },
  xLabelText: {
    ...AuthFonts.labelSmall,
    color: AuthColors.onSurfaceVariant,
    maxWidth: 56,
    textAlign: 'center',
  },
  scaleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
    paddingHorizontal: 4,
  },
  scaleText: {
    ...AuthFonts.labelSmall,
    color: AuthColors.onSurfaceVariant,
    opacity: 0.6,
  },
});
