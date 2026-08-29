import React, { useMemo } from 'react';
import { StyleSheet, View, Text } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop, Circle } from 'react-native-svg';
import { AuthColors, AuthFonts } from '@/constants/auth-theme';
import type { DayPoint } from '@/lib/notification-analytics';
import { InsightCard } from './insight-card';

interface InsightsDailyChartProps {
  data: DayPoint[];
  windowLabel: string;
  highlightLast?: boolean;
}

const CHART_WIDTH = 340;
const CHART_HEIGHT = 160;

function formatShortDate(d: Date): string {
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function bezierPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x},${points[0].y}`;
  let d = `M ${points[0].x},${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    const cpX1 = p0.x + (p1.x - p0.x) * 0.4;
    const cpY1 = p0.y;
    const cpX2 = p1.x - (p1.x - p0.x) * 0.4;
    const cpY2 = p1.y;
    d += ` C ${cpX1},${cpY1} ${cpX2},${cpY2} ${p1.x},${p1.y}`;
  }
  return d;
}

export function InsightsDailyChart({ data, windowLabel, highlightLast = true }: InsightsDailyChartProps) {
  const { path, fill, maxVal, lastPoint } = useMemo(() => {
    if (data.length === 0) {
      return { path: '', fill: '', points: [], maxVal: 0, lastPoint: null };
    }
    const padding = { top: 16, bottom: 24, left: 8, right: 8 };
    const innerW = CHART_WIDTH - padding.left - padding.right;
    const innerH = CHART_HEIGHT - padding.top - padding.bottom;
    const max = Math.max(...data.map((d) => d.count), 1);
    const stepX = data.length > 1 ? innerW / (data.length - 1) : 0;
    const pts = data.map((d, i) => ({
      x: padding.left + i * stepX,
      y: padding.top + innerH - (d.count / max) * innerH,
      count: d.count,
      date: d.date,
    }));
    const strokePath = bezierPath(pts);
    const fillPath = `${strokePath} L ${pts[pts.length - 1].x},${padding.top + innerH} L ${pts[0].x},${padding.top + innerH} Z`;
    return { path: strokePath, fill: fillPath, maxVal: max, lastPoint: pts[pts.length - 1] };
  }, [data]);

  const firstLabel = data[0] ? formatShortDate(data[0].date) : '';
  const lastLabel = data[data.length - 1] ? formatShortDate(data[data.length - 1].date) : '';
  const totalInPeriod = data.reduce((s, d) => s + d.count, 0);
  const avgPerDay = data.length > 0 ? Math.round(totalInPeriod / data.length) : 0;

  return (
    <InsightCard
      title="Daily trend"
      subtitle={`${totalInPeriod} pings · ${avgPerDay} avg/day · ${windowLabel}`}
      icon="analytics-outline"
    >
      <View style={s.chartWrap}>
        <Svg width="100%" height={CHART_HEIGHT} viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} preserveAspectRatio="none">
          <Defs>
            <LinearGradient id="dailyFill" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor={AuthColors.primary} stopOpacity={0.28} />
              <Stop offset="100%" stopColor={AuthColors.primary} stopOpacity={0} />
            </LinearGradient>
          </Defs>
          {fill ? <Path d={fill} fill="url(#dailyFill)" /> : null}
          {path ? <Path d={path} fill="none" stroke={AuthColors.primary} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" /> : null}
          {highlightLast && lastPoint && lastPoint.count > 0 ? (
            <Circle cx={lastPoint.x} cy={lastPoint.y} r={5} fill={AuthColors.primary} stroke={AuthColors.surfaceContainerLowest} strokeWidth={2} />
          ) : null}
        </Svg>
        <View style={s.axisLabels}>
          <Text style={s.axisLabelText}>{firstLabel}</Text>
          <Text style={s.axisLabelText}>{lastLabel}</Text>
        </View>
      </View>
      {maxVal > 0 ? (
        <View style={s.scaleRow}>
          <Text style={s.scaleText}>0</Text>
          <Text style={s.scaleText}>{Math.round(maxVal / 2)}</Text>
          <Text style={s.scaleText}>{maxVal}</Text>
        </View>
      ) : null}
    </InsightCard>
  );
}

const s = StyleSheet.create({
  chartWrap: {
    marginTop: 8,
  },
  axisLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  axisLabelText: {
    ...AuthFonts.labelSmall,
    color: AuthColors.onSurfaceVariant,
  },
  scaleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
    paddingHorizontal: 8,
  },
  scaleText: {
    ...AuthFonts.labelSmall,
    color: AuthColors.onSurfaceVariant,
    opacity: 0.6,
  },
});
