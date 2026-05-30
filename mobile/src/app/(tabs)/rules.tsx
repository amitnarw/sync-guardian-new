import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions, LayoutChangeEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Svg, { Circle, Path } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedProps,
  withSpring,
  withTiming,
  runOnJS,
  useDerivedValue,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

const { width: SCREEN_W } = Dimensions.get('window');
const PADDING = 24;
const CARD_PADDING = 32;
const DIAL_SIZE = Math.min(256, SCREEN_W - PADDING * 2 - CARD_PADDING * 2 - 16);
const STROKE_WIDTH = 14;
const RADIUS = (DIAL_SIZE - STROKE_WIDTH) / 2;
const CENTER = DIAL_SIZE / 2;
const HANDLE_RADIUS = 14;
const HIT_RADIUS = 28;
const MIN_GAP = 5;
const MIN_OFFSET = 15;

const SNAP_CONFIG = { stiffness: 180, damping: 18, mass: 0.5 };
const DRAG_CONFIG = { stiffness: 500, damping: 22, mass: 0.3 };

const C = {
  primary: '#44674d',
  primaryContainer: '#c5eccc',
  onPrimary: '#e8ffea',
  secondary: '#a0412d',
  secondaryContainer: '#ffdad3',
  onSecondary: '#fff7f6',
  tertiary: '#44674e',
  tertiaryContainer: '#d3fbda',
  surface: '#fff8f0',
  surfaceBright: '#fff8f0',
  surfaceContainer: '#f5ede0',
  surfaceContainerLow: '#faf3e7',
  surfaceContainerHigh: '#efe7da',
  surfaceContainerHighest: '#eae1d2',
  surfaceContainerLowest: '#ffffff',
  surfaceVariant: '#eae1d2',
  onSurface: '#363228',
  onSurfaceVariant: '#645e53',
  outline: '#807a6d',
  outlineVariant: '#b9b1a3',
  error: '#a83836',
  white: '#ffffff',
} as const;

const FOCUS_MODES = [
  { key: 'school', label: 'School Focus', desc: 'Until 3:00 PM', icon: 'school' as const, active: true },
  { key: 'dinner', label: 'Family Dinner', desc: 'Blocks all apps for 1h', icon: 'restaurant' as const, active: false },
  { key: 'reading', label: 'Reading Time', desc: 'Only educational apps', icon: 'menu-book' as const, active: false },
];

const BOUNDARIES = [
  { key: 'entertainment', label: 'Entertainment', desc: '1h 30m daily limit', icon: 'sports-esports' as const, iconBg: C.secondaryContainer, iconColor: C.secondary, defaultOn: true },
  { key: 'social', label: 'Social Interactions', desc: 'Requires approval after 8PM', icon: 'forum' as const, iconBg: 'rgba(197,236,204,0.5)', iconColor: C.primary, defaultOn: true },
];

// ─── Worklet-safe geometry helpers ───────────────────────────────

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  'worklet';
  const angleRad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(angleRad), y: cy + r * Math.sin(angleRad) };
}

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  'worklet';
  const start = polarToCartesian(cx, cy, r, startAngle);
  const end = polarToCartesian(cx, cy, r, endAngle);
  let diff = endAngle - startAngle;
  if (diff < 0) diff += 360;
  const largeArc = diff > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`;
}

function touchToAngle(x: number, y: number) {
  'worklet';
  const dx = x - CENTER;
  const dy = y - CENTER;
  return ((Math.atan2(dy, dx) * 180) / Math.PI + 90 + 360) % 360;
}

function snap15(deg: number) {
  'worklet';
  return Math.round(deg / 3.75) * 3.75;
}

function angleToTime(angle: number) {
  'worklet';
  const totalMinutes = (angle / 360) * 24 * 60;
  const absHour = (Math.floor(totalMinutes / 60) + 18) % 24;
  const mins = Math.floor(totalMinutes % 60);
  const hour12 = absHour % 12 || 12;
  const ampm = absHour >= 12 ? 'PM' : 'AM';
  return `${hour12}:${mins.toString().padStart(2, '0')} ${ampm}`;
}

// ─── ToggleSwitch (unchanged) ────────────────────────────────────

function ToggleSwitch({ value, onToggle }: { value: boolean; onToggle: () => void }) {
  const thumbX = useSharedValue(value ? 28 : 4);
  React.useEffect(() => {
    thumbX.value = withSpring(value ? 28 : 4, { stiffness: 350, damping: 25 });
  }, [value]);
  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: withSpring(value ? 28 : 4, { stiffness: 350, damping: 25 }) }],
  }));
  return (
    <TouchableOpacity activeOpacity={0.8} onPress={onToggle}>
      <Animated.View style={[s.toggleTrack, { backgroundColor: value ? C.primary : C.surfaceContainerHighest }]}>
        <Animated.View style={[s.toggleThumb, thumbStyle]} />
      </Animated.View>
    </TouchableOpacity>
  );
}

// ─── Premium Dial Sub-Component ──────────────────────────────────

const AnimatedPath = Animated.createAnimatedComponent(Path);

function DigitalSunsetDial({
  onTimeChange,
}: {
  onTimeChange?: (windDown: string, wakeUp: string) => void;
}) {
  const startAngle = useSharedValue(37.5);
  const endAngle = useSharedValue(210);
  const activeHandle = useSharedValue<'start' | 'end' | null>(null);
  const hapticFired = useSharedValue(false);
  const dialLayout = useSharedValue({ x: 0, y: 0, w: DIAL_SIZE, h: DIAL_SIZE });

  const [windDownText, setWindDownText] = useState(angleToTime(37.5));
  const [wakeUpText, setWakeUpText] = useState(angleToTime(210));

  const syncText = useCallback((sa: number, ea: number) => {
    const wd = angleToTime(sa);
    const wu = angleToTime(ea);
    setWindDownText(wd);
    setWakeUpText(wu);
    onTimeChange?.(wd, wu);
  }, [onTimeChange]);

  const checkHaptic = (angle: number) => {
    'worklet';
    const rawMin = angle / 3.75;
    const distTo15 = Math.abs(rawMin - Math.round(rawMin));
    if (distTo15 < 0.12 && !hapticFired.value) {
      hapticFired.value = true;
      runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Light);
    } else if (distTo15 > 0.5) {
      hapticFired.value = false;
    }
  };

  // ── SVG Animated Arc ──
  const arcProps = useAnimatedProps(() => {
    'worklet';
    const d = describeArc(CENTER, CENTER, RADIUS, startAngle.value, endAngle.value);
    return { d };
  });

  // ── Handle Animated Styles ──
  const startHandleStyle = useAnimatedStyle(() => {
    'worklet';
    const pt = polarToCartesian(CENTER, CENTER, RADIUS, startAngle.value);
    const x = pt.x - CENTER;
    const y = pt.y - CENTER;
    const s = activeHandle.value === 'start' ? withSpring(1.35, { stiffness: 300, damping: 15 }) : withSpring(1, { stiffness: 200, damping: 18 });
    return {
      position: 'absolute' as const,
      left: CENTER - HANDLE_RADIUS,
      top: CENTER - HANDLE_RADIUS,
      transform: [{ translateX: x }, { translateY: y }, { scale: s }],
      zIndex: activeHandle.value === 'start' ? 99 : 10,
    };
  });

  const endHandleStyle = useAnimatedStyle(() => {
    'worklet';
    const pt = polarToCartesian(CENTER, CENTER, RADIUS, endAngle.value);
    const x = pt.x - CENTER;
    const y = pt.y - CENTER;
    const s = activeHandle.value === 'end' ? withSpring(1.35, { stiffness: 300, damping: 15 }) : withSpring(1, { stiffness: 200, damping: 18 });
    return {
      position: 'absolute' as const,
      left: CENTER - HANDLE_RADIUS,
      top: CENTER - HANDLE_RADIUS,
      transform: [{ translateX: x }, { translateY: y }, { scale: s }],
      zIndex: activeHandle.value === 'end' ? 99 : 10,
    };
  });

  // ── Center time derived value (for display sync) ──
  const centerTimeStr = useDerivedValue(() => {
    'worklet';
    return angleToTime(startAngle.value);
  });
  const wakeUpTimeStr = useDerivedValue(() => {
    'worklet';
    return angleToTime(endAngle.value);
  });

  // ── Pan Gesture: Handle dragging ──
  const panGesture = Gesture.Pan()
    .manualActivation(true)
    .onTouchesDown((event, stateManager) => {
      'worklet';
      const touch = event.allTouches[0];
      if (!touch) { stateManager.fail(); return; }

      const x = touch.x - CENTER;
      const y = touch.y - CENTER;
      const dist = Math.sqrt(x * x + y * y);

      if (dist < RADIUS - STROKE_WIDTH - 8 || dist > RADIUS + STROKE_WIDTH + 8) {
        stateManager.fail();
        return;
      }

      const a = touchToAngle(touch.x, touch.y);
      const sPt = polarToCartesian(CENTER, CENTER, RADIUS, startAngle.value);
      const ePt = polarToCartesian(CENTER, CENTER, RADIUS, endAngle.value);
      const dS = Math.sqrt((touch.x - sPt.x) ** 2 + (touch.y - sPt.y) ** 2);
      const dE = Math.sqrt((touch.x - ePt.x) ** 2 + (touch.y - ePt.y) ** 2);

      if (dS <= HIT_RADIUS || dE <= HIT_RADIUS) {
        activeHandle.value = dS <= dE ? 'start' : 'end';
        if (activeHandle.value === 'start') {
          startAngle.value = withTiming(a, { duration: 40 });
        } else {
          endAngle.value = withTiming(a, { duration: 40 });
        }
        runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Light);
        stateManager.activate();
      } else {
        stateManager.fail();
      }
    })
    .onUpdate((event) => {
      'worklet';
      if (activeHandle.value === null) return;

      let a = touchToAngle(event.x, event.y);
      const isStart = activeHandle.value === 'start';

      if (isStart) {
        a = Math.min(a, endAngle.value - MIN_GAP);
        startAngle.value = a;
      } else {
        a = Math.max(a, startAngle.value + MIN_GAP);
        endAngle.value = a;
      }

      checkHaptic(a);
      runOnJS(syncText)(startAngle.value, endAngle.value);
    })
    .onEnd(() => {
      'worklet';
      activeHandle.value = null;
      startAngle.value = withSpring(snap15(startAngle.value), SNAP_CONFIG);
      endAngle.value = withSpring(snap15(endAngle.value), SNAP_CONFIG);
      runOnJS(Haptics.notificationAsync)(Haptics.NotificationFeedbackType.Success);
      runOnJS(syncText)(snap15(startAngle.value), snap15(endAngle.value));
    })
    .onFinalize(() => {
      'worklet';
      activeHandle.value = null;
    });

  // ── Tap Gesture: Tap-to-set nearest handle ──
  const tapGesture = Gesture.Tap()
    .onEnd((event) => {
      'worklet';
      const a = touchToAngle(event.x, event.y);
      const dStart = Math.abs(a - startAngle.value);
      const dEnd = Math.abs(a - endAngle.value);
      const minD = Math.min(
        Math.min(dStart, 360 - dStart),
        Math.min(dEnd, 360 - dEnd),
      );

      if (minD > 90) return;

      const nearStart = dStart <= dEnd;
      if (nearStart) {
        const clamped = Math.min(a, endAngle.value - MIN_GAP);
        startAngle.value = withSpring(clamped, { stiffness: 250, damping: 20, mass: 0.6 });
        runOnJS(syncText)(clamped, endAngle.value);
      } else {
        const clamped = Math.max(a, startAngle.value + MIN_GAP);
        endAngle.value = withSpring(clamped, { stiffness: 250, damping: 20, mass: 0.6 });
        runOnJS(syncText)(startAngle.value, clamped);
      }
      runOnJS(Haptics.selectionAsync)();
    });

  const dialGesture = Gesture.Exclusive(panGesture, tapGesture);

  const onDialLayout = (e: LayoutChangeEvent) => {
    const { x, y, width, height } = e.nativeEvent.layout;
    dialLayout.value = { x, y, w: width, h: height };
  };

  return (
    <GestureDetector gesture={dialGesture}>
      <View style={s.dialRingContainer} onLayout={onDialLayout}>
        <Svg width={DIAL_SIZE} height={DIAL_SIZE} viewBox={`0 0 ${DIAL_SIZE} ${DIAL_SIZE}`}>
          <Circle
            cx={CENTER}
            cy={CENTER}
            r={RADIUS}
            fill="transparent"
            stroke={C.surfaceContainerHighest}
            strokeWidth={STROKE_WIDTH}
            opacity={0.5}
          />
          <AnimatedPath
            animatedProps={arcProps}
            fill="none"
            stroke={C.secondary}
            strokeWidth={STROKE_WIDTH}
            strokeLinecap="round"
            opacity={0.85}
          />
        </Svg>

        <Animated.View style={[s.dialHandle, { backgroundColor: C.primary }, startHandleStyle]} />
        <Animated.View style={[s.dialHandle, { backgroundColor: C.secondary }, endHandleStyle]} />

        <View style={s.dialCenter} pointerEvents="none">
          <MaterialIcons name="bedtime" size={28} color={C.secondary} />
          <Text style={s.dialCenterTime}>{windDownText}</Text>
          <Text style={s.dialCenterLabel}>Wind Down</Text>
        </View>
      </View>
    </GestureDetector>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────

export default function RulesScreen() {
  const [boundaries, setBoundaries] = useState(
    BOUNDARIES.map((b) => ({ ...b, on: b.defaultOn })),
  );

  const toggleBoundary = useCallback((key: string) => {
    setBoundaries((prev) =>
      prev.map((b) => (b.key === key ? { ...b, on: !b.on } : b)),
    );
  }, []);

  return (
    <View style={s.container}>
      <SafeAreaView style={s.safeArea} edges={['top']}>
        <ScrollView
          contentContainerStyle={s.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* ========== MOBILE HEADER ========== */}
          <View style={s.header}>
            <View style={s.headerTextBlock}>
              <Text style={s.headerSubtitle}>Visual Scheduling</Text>
              <Text style={s.headerTitle}>Rules & Boundaries</Text>
            </View>
            <TouchableOpacity style={s.headerButton} activeOpacity={0.8}>
              <MaterialIcons name="tune" size={24} color={C.primary} />
            </TouchableOpacity>
          </View>

          {/* ========== DIGITAL SUNSET DIAL ========== */}
          <View style={s.dialSection}>
            <LinearGradient
              colors={[C.primaryContainer, C.surfaceContainerLow]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={s.dialCard}
            >
              <View style={s.dialDecoBlob} />
              <View style={s.dialHeader}>
                <MaterialCommunityIcons
                  name="weather-sunset"
                  size={32}
                  color={C.primary}
                />
                <Text style={s.dialTitle}>Digital Sunset</Text>
                <Text style={s.dialDesc}>
                  Softly wind down devices to prepare for restful sleep.
                </Text>
              </View>

              <DigitalSunsetDial />

              <View style={s.dialInfoRow}>
                <View style={s.dialInfoCard}>
                  <Text style={s.dialInfoLabel}>Wake Up</Text>
                  <Text style={[s.dialInfoValue, { color: C.primary }]}>7:00 AM</Text>
                </View>
                <View style={s.dialInfoCard}>
                  <Text style={s.dialInfoLabel}>Bedtime</Text>
                  <Text style={[s.dialInfoValue, { color: C.secondary }]}>8:30 PM</Text>
                </View>
              </View>
            </LinearGradient>
          </View>

          {/* ========== QUICK FOCUS MODES ========== */}
          <View style={s.focusSection}>
            <Text style={s.sectionTitle}>Quick Focus Modes</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              snapToInterval={296}
              decelerationRate="fast"
              contentContainerStyle={s.focusScrollContent}
            >
              {FOCUS_MODES.map((mode) => (
                <View
                  key={mode.key}
                  style={[
                    s.focusPill,
                    mode.active ? s.focusPillActive : s.focusPillInactive,
                  ]}
                >
                  {mode.active && <View style={s.focusPillGlow} />}
                  <View style={s.focusPillTop}>
                    <View
                      style={[
                        s.focusIconCircle,
                        mode.active
                          ? s.focusIconCircleActive
                          : s.focusIconCircleInactive,
                      ]}
                    >
                      <MaterialIcons
                        name={mode.icon}
                        size={20}
                        color={mode.active ? C.onPrimary : C.secondary}
                      />
                    </View>
                    {mode.active && (
                      <View style={s.focusBadge}>
                        <Text style={s.focusBadgeText}>Active</Text>
                      </View>
                    )}
                  </View>
                  <View style={s.focusPillBottom}>
                    <Text
                      style={[
                        s.focusPillTitle,
                        mode.active && { color: C.onPrimary },
                      ]}
                    >
                      {mode.label}
                    </Text>
                    <Text
                      style={[
                        s.focusPillDesc,
                        mode.active && { color: 'rgba(255,255,255,0.7)' },
                      ]}
                    >
                      {mode.desc}
                    </Text>
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>

          {/* ========== SOFT BOUNDARIES ========== */}
          <View style={s.boundariesSection}>
            <Text style={s.sectionTitle}>Soft Boundaries</Text>
            <View style={s.boundariesStack}>
              {boundaries.map((b, i) => (
                <View
                  key={b.key}
                  style={[
                    s.boundaryCard,
                    i === 0 ? s.boundaryCardTop : s.boundaryCardBottom,
                  ]}
                >
                  <View style={s.boundaryLeft}>
                    <View style={[s.boundaryIconBox, { backgroundColor: b.iconBg }]}>
                      <MaterialIcons name={b.icon} size={24} color={b.iconColor} />
                    </View>
                    <View>
                      <Text style={s.boundaryLabel}>{b.label}</Text>
                      <Text style={s.boundaryDesc}>{b.desc}</Text>
                    </View>
                  </View>
                  <ToggleSwitch value={b.on} onToggle={() => toggleBoundary(b.key)} />
                </View>
              ))}
            </View>
          </View>

          <View style={s.bottomSpacer} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────

const FOCUS_PILL_W = 280;

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.surface },
  safeArea: { flex: 1 },
  scrollContent: { paddingHorizontal: PADDING, paddingTop: 8, paddingBottom: 8 },

  /* ---------- Mobile Header ---------- */
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingTop: 24,
    paddingBottom: 8,
  },
  headerTextBlock: { flex: 1 },
  headerSubtitle: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 2.5,
    color: C.onSurfaceVariant,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  headerTitle: {
    fontFamily: 'PlusJakartaSans-ExtraBold',
    fontSize: 30,
    lineHeight: 36,
    color: C.onSurface,
    letterSpacing: -0.5,
  },
  headerButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: C.surfaceContainer,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#363228',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.04,
    shadowRadius: 16,
    elevation: 2,
    marginTop: 4,
  },

  /* ---------- Digital Sunset Dial ---------- */
  dialSection: { marginTop: 12, marginBottom: 40 },
  dialCard: {
    borderRadius: 48,
    padding: 32,
    shadowColor: '#363228',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.06,
    shadowRadius: 64,
    elevation: 3,
    position: 'relative',
    overflow: 'hidden',
    alignItems: 'center',
  },
  dialDecoBlob: {
    position: 'absolute',
    right: -48,
    top: -48,
    width: 256,
    height: 256,
    borderTopLeftRadius: 170,
    borderTopRightRadius: 85,
    borderBottomLeftRadius: 110,
    borderBottomRightRadius: 200,
    backgroundColor: 'rgba(68,103,77,0.08)',
    transform: [{ rotate: '45deg' }],
  },
  dialHeader: { alignItems: 'center', marginBottom: 24, gap: 8 },
  dialTitle: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 24,
    lineHeight: 30,
    color: C.onSurface,
  },
  dialDesc: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 14,
    lineHeight: 20,
    color: C.onSurfaceVariant,
    textAlign: 'center',
    maxWidth: 280,
  },
  dialRingContainer: {
    width: DIAL_SIZE,
    height: DIAL_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 16,
    position: 'relative',
  },
  dialHandle: {
    width: HANDLE_RADIUS * 2,
    height: HANDLE_RADIUS * 2,
    borderRadius: HANDLE_RADIUS,
    borderWidth: 3,
    borderColor: C.surfaceContainerLowest,
    shadowColor: '#363228',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  dialCenter: {
    position: 'absolute',
    width: DIAL_SIZE * 0.72,
    height: DIAL_SIZE * 0.72,
    borderRadius: (DIAL_SIZE * 0.72) / 2,
    backgroundColor: C.surfaceContainerLowest,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
    shadowColor: '#363228',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  dialCenterTime: {
    fontFamily: 'PlusJakartaSans-ExtraBold',
    fontSize: Math.min(DIAL_SIZE / 7.5, 30),
    lineHeight: Math.min(DIAL_SIZE / 6, 36),
    color: C.onSurface,
    letterSpacing: -0.3,
  },
  dialCenterLabel: {
    fontFamily: 'PlusJakartaSans-SemiBold',
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1.5,
    color: C.onSurfaceVariant,
    textTransform: 'uppercase',
  },
  dialInfoRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 8,
    justifyContent: 'center',
  },
  dialInfoCard: {
    backgroundColor: C.surfaceContainerLowest,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    alignItems: 'center',
    minWidth: 100,
    shadowColor: '#363228',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  dialInfoLabel: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 11,
    lineHeight: 14,
    color: C.onSurfaceVariant,
    marginBottom: 4,
  },
  dialInfoValue: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 16,
    lineHeight: 20,
  },

  /* ---------- Quick Focus Modes ---------- */
  focusSection: { marginBottom: 40 },
  sectionTitle: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 20,
    lineHeight: 26,
    color: C.onSurface,
    marginBottom: 16,
    paddingLeft: 8,
  },
  focusScrollContent: { paddingLeft: 8, gap: 16 },
  focusPill: {
    width: FOCUS_PILL_W,
    height: 160,
    borderRadius: 32,
    padding: 24,
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  focusPillActive: {
    backgroundColor: C.primary,
    shadowColor: C.primary,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 32,
    elevation: 4,
  },
  focusPillInactive: {
    backgroundColor: C.surfaceContainerLow,
    shadowColor: '#363228',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
    borderWidth: 1,
    borderColor: C.surfaceContainer,
  },
  focusPillGlow: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 128,
    height: 128,
    borderRadius: 64,
    backgroundColor: 'rgba(255,255,255,0.10)',
    transform: [{ translateX: 48 }, { translateY: -48 }],
  },
  focusPillTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', zIndex: 1 },
  focusIconCircle: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  focusIconCircleActive: { backgroundColor: 'rgba(255,255,255,0.20)' },
  focusIconCircleInactive: { backgroundColor: C.surfaceContainerHighest },
  focusBadge: {
    backgroundColor: 'rgba(255,255,255,0.20)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 9999,
  },
  focusBadgeText: { fontFamily: 'PlusJakartaSans-SemiBold', fontSize: 11, lineHeight: 14, color: C.onPrimary },
  focusPillBottom: { zIndex: 1 },
  focusPillTitle: { fontFamily: 'PlusJakartaSans-Bold', fontSize: 18, lineHeight: 24, color: C.onSurface },
  focusPillDesc: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 13,
    lineHeight: 18,
    color: C.onSurfaceVariant,
    marginTop: 4,
  },

  /* ---------- Soft Boundaries ---------- */
  boundariesSection: { marginBottom: 40 },
  boundariesStack: { position: 'relative' },
  boundaryCard: {
    borderRadius: 40,
    padding: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  boundaryCardTop: {
    backgroundColor: C.surfaceContainerLowest,
    marginLeft: 16,
    marginBottom: -48,
    shadowColor: '#363228',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.04,
    shadowRadius: 32,
    elevation: 3,
    zIndex: 2,
    borderWidth: 1,
    borderColor: 'rgba(234,225,210,0.5)',
  },
  boundaryCardBottom: {
    backgroundColor: C.surfaceContainerLow,
    marginRight: 16,
    paddingTop: 72,
    zIndex: 1,
    borderWidth: 1,
    borderColor: 'rgba(234,225,210,0.3)',
  },
  boundaryLeft: { flexDirection: 'row', alignItems: 'center', gap: 16, flex: 1 },
  boundaryIconBox: { width: 56, height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  boundaryLabel: { fontFamily: 'PlusJakartaSans-Bold', fontSize: 18, lineHeight: 24, color: C.onSurface },
  boundaryDesc: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 13,
    lineHeight: 18,
    color: C.onSurfaceVariant,
    marginTop: 2,
  },

  /* ---------- Toggle Switch ---------- */
  toggleTrack: {
    width: 56,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    paddingHorizontal: 4,
    shadowColor: '#363228',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  toggleThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: C.surfaceContainerLowest,
    shadowColor: '#363228',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 3,
  },

  /* ---------- Bottom Spacer ---------- */
  bottomSpacer: { height: 130 },
});
