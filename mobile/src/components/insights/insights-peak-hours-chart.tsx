import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, PanResponder, LayoutChangeEvent, Animated } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop, Line } from 'react-native-svg';
import { AuthColors } from '@/constants/auth-theme';
import type { PeakBucket } from '@/lib/notification-analytics';

interface InsightsPeakHoursProps {
  buckets: PeakBucket[];
  mostActiveBucket: PeakBucket | null;
}

const CHART_HEIGHT = 125;
const LABEL_WIDTH = 50;
const TOOLTIP_WIDTH = 52;
const PILL_WIDTH = 48;

function getMonotoneCurvePath(points: { x: number; y: number }[], width: number): string {
  const n = points.length;
  if (n === 0) return '';
  if (n === 1) return `M 0,${points[0].y.toFixed(1)} L ${width},${points[0].y.toFixed(1)}`;

  if (n === 2) {
    const p0 = points[0];
    const p1 = points[1];
    const dx = (p1.x - p0.x) * 0.45;
    return `M ${p0.x.toFixed(1)},${p0.y.toFixed(1)} C ${(p0.x + dx).toFixed(1)},${p0.y.toFixed(1)} ${(p1.x - dx).toFixed(1)},${p1.y.toFixed(1)} ${p1.x.toFixed(1)},${p1.y.toFixed(1)}`;
  }

  const d: number[] = [];
  const dx: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    const deltaX = points[i + 1].x - points[i].x;
    const deltaY = points[i + 1].y - points[i].y;
    dx.push(deltaX);
    d.push(deltaX === 0 ? 0 : deltaY / deltaX);
  }

  const m: number[] = new Array(n).fill(0);
  m[0] = d[0];
  m[n - 1] = d[n - 2];

  for (let i = 1; i < n - 1; i++) {
    if (d[i - 1] * d[i] <= 0) {
      m[i] = 0;
    } else {
      m[i] = (2 * d[i - 1] * d[i]) / (d[i - 1] + d[i]);
    }
  }

  let path = `M ${points[0].x.toFixed(1)},${points[0].y.toFixed(1)}`;
  for (let i = 0; i < n - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    const segmentDx = dx[i];

    const cp1x = p0.x + segmentDx / 3;
    const cp1y = p0.y + (m[i] * segmentDx) / 3;
    const cp2x = p1.x - segmentDx / 3;
    const cp2y = p1.y - (m[i + 1] * segmentDx) / 3;

    path += ` C ${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p1.x.toFixed(1)},${p1.y.toFixed(1)}`;
  }

  return path;
}

export function InsightsPeakHours({ buckets, mostActiveBucket }: InsightsPeakHoursProps) {
  const totalPings = useMemo(() => buckets.reduce((s, b) => s + b.count, 0), [buckets]);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [containerWidth, setContainerWidth] = useState<number>(340);

  // Animated values for buttery smooth indicator line, tooltip, and sliding bottom pill
  const animX = useRef(new Animated.Value(170)).current;
  const animY = useRef(new Animated.Value(60)).current;
  const animPillX = useRef(new Animated.Value(170 - PILL_WIDTH / 2)).current;

  const { linePath, fillPath, pts, activePointIndex, activePoint } = useMemo(() => {
    if (!buckets || buckets.length === 0) {
      return { linePath: '', fillPath: '', pts: [], activePointIndex: 0, activePoint: null };
    }

    const padding = { top: 26, bottom: 6, left: 26, right: 26 };
    const innerW = containerWidth - padding.left - padding.right;
    const innerH = CHART_HEIGHT - padding.top - padding.bottom;

    const maxCount = Math.max(...buckets.map((b) => b.count), 0);
    const chartMax = maxCount > 0 ? maxCount * 1.35 : 10;

    const shortLabels = ['12 AM', '4 AM', '8 AM', '12 PM', '4 PM', '8 PM'];

    const points = buckets.map((b, i) => {
      const x = padding.left + (buckets.length > 1 ? (i / (buckets.length - 1)) * innerW : innerW / 2);
      const y = padding.top + innerH - (chartMax > 0 ? (b.count / chartMax) * innerH : 0);
      return {
        x: Number(x.toFixed(1)),
        y: Number(y.toFixed(1)),
        count: b.count,
        label: shortLabels[i] || b.label,
        fullLabel: b.label,
      };
    });

    const edgePoints = [
      { x: 0, y: points[0].y },
      ...points,
      { x: containerWidth, y: points[points.length - 1].y },
    ];

    const strokeD = getMonotoneCurvePath(edgePoints, containerWidth);
    const fillD =
      points.length > 0
        ? `${strokeD} L ${containerWidth},${CHART_HEIGHT} L 0,${CHART_HEIGHT} Z`
        : '';

    let peakIdx = 0;
    let maxVal = -1;
    points.forEach((p, idx) => {
      if (p.count > maxVal) {
        maxVal = p.count;
        peakIdx = idx;
      }
    });

    const activeIdx = selectedIdx !== null ? selectedIdx : (maxVal > 0 ? peakIdx : 3);
    const activePt = points[activeIdx] || points[0];

    return {
      linePath: strokeD,
      fillPath: fillD,
      pts: points,
      activePointIndex: activeIdx,
      activePoint: activePt,
    };
  }, [buckets, containerWidth, selectedIdx]);

  // Animate indicator line, tooltip, and bottom sliding pill together with spring physics
  useEffect(() => {
    if (activePoint) {
      Animated.parallel([
        Animated.spring(animX, {
          toValue: activePoint.x,
          tension: 160,
          friction: 13,
          useNativeDriver: false,
        }),
        Animated.spring(animY, {
          toValue: activePoint.y,
          tension: 160,
          friction: 13,
          useNativeDriver: false,
        }),
        Animated.spring(animPillX, {
          toValue: activePoint.x - PILL_WIDTH / 2,
          tension: 160,
          friction: 13,
          useNativeDriver: false,
        }),
      ]).start();
    }
  }, [activePoint, animX, animY, animPillX]);

  // Touch & Drag scrubbing PanResponder using exact nearest-point distance
  const updateScrubberFromTouch = useCallback((locationX: number) => {
    if (!pts || pts.length === 0) return;
    let closestIdx = 0;
    let minDistance = Infinity;
    pts.forEach((p, idx) => {
      const dist = Math.abs(p.x - locationX);
      if (dist < minDistance) {
        minDistance = dist;
        closestIdx = idx;
      }
    });
    setSelectedIdx(closestIdx);
  }, [pts]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (evt) => {
          updateScrubberFromTouch(evt.nativeEvent.locationX);
        },
        onPanResponderMove: (evt) => {
          updateScrubberFromTouch(evt.nativeEvent.locationX);
        },
        onPanResponderRelease: () => {},
      }),
    [updateScrubberFromTouch],
  );

  const onLayoutCard = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0 && Math.abs(w - containerWidth) > 1) {
      setContainerWidth(w);
    }
  };

  return (
    <View style={s.card} onLayout={onLayoutCard}>
      {/* Top Header Row */}
      <View style={s.headerRow}>
        <View style={s.headerLeft}>
          <Text style={s.title}>Peak hours</Text>
          <Text style={s.subtitle} numberOfLines={2}>
            {mostActiveBucket && mostActiveBucket.count > 0
              ? `Most activity recorded around ${mostActiveBucket.label.toLowerCase()}`
              : 'Hourly notification volume and peak disruption windows'}
          </Text>
        </View>

        <View style={s.headerRight}>
          <Text style={s.heroValue}>{totalPings.toLocaleString()}</Text>
          <Text style={s.heroLabel}>Total Pings</Text>
        </View>
      </View>

      {/* Edge-to-Edge Chart Container with Gesture Handler */}
      <View style={s.chartContainer} {...panResponder.panHandlers}>
        <Svg
          width={containerWidth}
          height={CHART_HEIGHT + 12}
          viewBox={`0 0 ${containerWidth} ${CHART_HEIGHT + 12}`}
        >
          <Defs>
            {/* Primary botanical gradient stroke */}
            <LinearGradient id="peakPrimaryStrokeGrad" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0%" stopColor="#2f4a37" />
              <Stop offset="50%" stopColor="#3d5e46" />
              <Stop offset="100%" stopColor="#4f7d5c" />
            </LinearGradient>

            {/* Ambient primary underglow */}
            <LinearGradient id="peakPrimaryGlowGrad" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor="#2f4a37" stopOpacity={0.22} />
              <Stop offset="50%" stopColor="#4f7d5c" stopOpacity={0.07} />
              <Stop offset="100%" stopColor="#2f4a37" stopOpacity={0.0} />
            </LinearGradient>
          </Defs>

          {/* Diffuse glow fill */}
          {fillPath ? <Path d={fillPath} fill="url(#peakPrimaryGlowGrad)" /> : null}

          {/* Smooth edge-to-edge curve stroke */}
          {linePath ? (
            <Path
              d={linePath}
              fill="none"
              stroke="url(#peakPrimaryStrokeGrad)"
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : null}

          {/* Vertical light-primary dotted line connecting curve point directly into the X-axis pill */}
          {activePoint && (
            <Line
              x1={activePoint.x}
              y1={activePoint.y}
              x2={activePoint.x}
              y2={CHART_HEIGHT + 12}
              stroke="rgba(47, 74, 55, 0.45)"
              strokeWidth={1.8}
              strokeDasharray="3 3"
            />
          )}
        </Svg>

        {/* Floating Primary-Colored Pill Tooltip ,  centered exactly on the animated line */}
        {activePoint && (
          <Animated.View
            pointerEvents="none"
            style={[
              s.floatingTooltip,
              {
                left: animX,
                top: animY.interpolate({
                  inputRange: [0, CHART_HEIGHT],
                  outputRange: [-34, CHART_HEIGHT - 34],
                }),
                transform: [{ translateX: -TOOLTIP_WIDTH / 2 }],
              },
            ]}
          >
            <Text style={s.tooltipText}>{activePoint.count}</Text>
          </Animated.View>
        )}
      </View>

      {/* Bottom Axis Labels with Smooth Sliding Pill Indicator */}
      <View style={s.axisRowContainer}>
        {/* The single sliding white pill that glides under the active label */}
        <Animated.View
          style={[
            s.slidingPill,
            {
              left: animPillX,
            },
          ]}
        />

        {/* The time slot buttons rendered on top */}
        {pts.map((p, idx) => {
          const isActive = idx === activePointIndex;
          return (
            <TouchableOpacity
              key={`peak-axis-${idx}`}
              style={[
                s.axisItemButton,
                {
                  left: p.x - LABEL_WIDTH / 2,
                },
              ]}
              onPress={() => setSelectedIdx(idx)}
              activeOpacity={0.7}
            >
              <Text style={[s.axisText, isActive && s.axisTextActive]}>{p.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 28,
    paddingTop: 24,
    paddingBottom: 18,
    overflow: 'hidden',
  },
  headerRow: {
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  headerLeft: {
    flex: 1,
    paddingRight: 16,
  },
  title: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 20,
    lineHeight: 26,
    color: '#111827',
  },
  subtitle: {
    fontFamily: 'Manrope-Regular',
    fontSize: 13,
    lineHeight: 18,
    color: '#6b7280',
    marginTop: 4,
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  heroValue: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 38,
    lineHeight: 42,
    color: AuthColors.primary,
    letterSpacing: -0.5,
  },
  heroLabel: {
    fontFamily: 'Manrope-Medium',
    fontSize: 12.5,
    color: '#9ca3af',
    marginTop: 2,
  },
  chartContainer: {
    width: '100%',
    height: CHART_HEIGHT + 12,
    position: 'relative',
    justifyContent: 'flex-start',
  },
  floatingTooltip: {
    position: 'absolute',
    width: TOOLTIP_WIDTH,
    backgroundColor: AuthColors.primary,
    borderRadius: 9999,
    paddingVertical: 5,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: AuthColors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
    zIndex: 2,
  },
  tooltipText: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 13.5,
    color: '#ffffff',
  },
  axisRowContainer: {
    width: '100%',
    height: 36,
    marginTop: -2,
    position: 'relative',
  },
  slidingPill: {
    position: 'absolute',
    width: PILL_WIDTH,
    height: 30,
    top: 2,
    borderRadius: 8,
    backgroundColor: '#e8efe9',
    zIndex: 0,
  },
  axisItemButton: {
    position: 'absolute',
    width: LABEL_WIDTH,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  axisText: {
    fontFamily: 'Manrope-Medium',
    fontSize: 12.5,
    color: '#9ca3af',
  },
  axisTextActive: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 13,
    color: AuthColors.primary,
  },
});













