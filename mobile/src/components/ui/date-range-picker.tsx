import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Modal,
  Pressable,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  TouchableWithoutFeedback,
  BackHandler,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

// Sync Guardian Colors
const C = {
  primary: '#44674d',
  primaryContainer: '#c5eccc',
  surface: '#ffffff',
  surfaceContainerLow: '#fcf6ec',
  surfaceContainer: '#eae1d2',
  outline: '#8c8576',
  onSurface: '#24211a',
  onSurfaceVariant: '#645e53',
  error: '#a83836',
  white: '#ffffff',
} as const;

export interface DateRangePickerProps {
  visible: boolean;
  onClose: () => void;
  startDate: Date | null;
  endDate: Date | null;
  startTime: string;
  endTime: string;
  onApply: (start: Date | null, end: Date | null, startTime: string, endTime: string) => void;
  onReset: () => void;
}

export function DateRangePicker({
  visible,
  onClose,
  startDate,
  endDate,
  startTime,
  endTime,
  onApply,
  onReset,
}: DateRangePickerProps) {
  const [tempStartDate, setTempStartDate] = useState<Date | null>(startDate);
  const [tempEndDate, setTempEndDate] = useState<Date | null>(endDate);
  const [tempStartTime, setTempStartTime] = useState<string>(startTime);
  const [tempEndTime, setTempEndTime] = useState<string>(endTime);
  const [calendarMonth, setCalendarMonth] = useState<Date>(new Date());

  // Animation shared values & state
  const [shouldRenderModal, setShouldRenderModal] = useState(visible);
  const cardOpacity = useSharedValue(0);
  const backdropOpacity = useSharedValue(0);
  const translateY = useSharedValue(20);

  // Sync state and run transitions on visible change
  useEffect(() => {
    if (visible) {
      setTempStartDate(startDate);
      setTempEndDate(endDate);
      setTempStartTime(startTime);
      setTempEndTime(endTime);
      setCalendarMonth(startDate || new Date());

      setShouldRenderModal(true);
      cardOpacity.value = withTiming(1, { duration: 250, easing: Easing.out(Easing.ease) });
      translateY.value = withTiming(0, { duration: 250, easing: Easing.out(Easing.ease) });
      backdropOpacity.value = withTiming(1, { duration: 200 });
    } else {
      cardOpacity.value = withTiming(0, { duration: 200, easing: Easing.in(Easing.ease) });
      translateY.value = withTiming(20, { duration: 200, easing: Easing.in(Easing.ease) });
      backdropOpacity.value = withTiming(0, { duration: 200 }, (finished) => {
        if (finished) {
          runOnJS(setShouldRenderModal)(false);
        }
      });
    }
  }, [visible]);

  // Handle hardware back button
  useEffect(() => {
    if (!shouldRenderModal) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => subscription.remove();
  }, [shouldRenderModal, onClose]);

  const calendarGrid = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayIndex = new Date(year, month, 1).getDay();

    const cells: (Date | null)[] = [];
    for (let i = 0; i < firstDayIndex; i++) {
      cells.push(null);
    }
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push(new Date(year, month, d));
    }

    // Pad the end to complete the final week row of 7 days
    const totalCells = cells.length;
    const remainder = totalCells % 7;
    if (remainder > 0) {
      const padCount = 7 - remainder;
      for (let i = 0; i < padCount; i++) {
        cells.push(null);
      }
    }

    return cells;
  }, [calendarMonth]);

  const handleDayPress = (day: Date) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (!tempStartDate || (tempStartDate && tempEndDate)) {
      setTempStartDate(day);
      setTempEndDate(null);
    } else {
      if (day >= tempStartDate) {
        setTempEndDate(day);
      } else {
        setTempStartDate(day);
        setTempEndDate(null);
      }
    }
  };

  const prevMonth = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1));
  };

  const handleApply = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onApply(tempStartDate, tempEndDate, tempStartTime, tempEndTime);
  };

  const handleReset = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    onReset();
  };

  // Reanimated style bindings
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const cardStyle = useAnimatedStyle(() => ({
    opacity: cardOpacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  if (!shouldRenderModal) return null;

  return (
    <Modal
      visible={shouldRenderModal}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <View style={s.modalOverlay}>
        {/* Animated backdrop with tap-to-dismiss */}
        <TouchableWithoutFeedback onPress={onClose}>
          <Animated.View style={[s.modalOverlayBackground, backdropStyle]} />
        </TouchableWithoutFeedback>

        {/* Animated Modal Card */}
        <Animated.View style={[s.modalContent, cardStyle]} renderToHardwareTextureAndroid>

          {/* Top Inputs: Start & End */}
          <View style={s.calHeaderInputs}>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={s.calInputLabel}>Start</Text>
              <View style={s.calInputCard}>
                <Ionicons name="calendar-outline" size={14} color={C.onSurfaceVariant} />
                <Text style={s.calInputText} numberOfLines={1}>
                  {tempStartDate ? tempStartDate.toLocaleDateString([], { month: '2-digit', day: '2-digit', year: 'numeric' }) : 'Select Date'}
                </Text>
              </View>
              <View style={s.calInputCard}>
                <Ionicons name="time-outline" size={14} color={C.onSurfaceVariant} />
                <TextInput
                  style={s.calTimeInput}
                  value={tempStartTime}
                  onChangeText={setTempStartTime}
                  placeholder="00:00"
                  placeholderTextColor={C.outline}
                  keyboardType="numbers-and-punctuation"
                />
              </View>
            </View>

            <View style={{ flex: 1, gap: 4 }}>
              <Text style={s.calInputLabel}>Due (End)</Text>
              <View style={s.calInputCard}>
                <Ionicons name="calendar-outline" size={14} color={C.onSurfaceVariant} />
                <Text style={s.calInputText} numberOfLines={1}>
                  {tempEndDate ? tempEndDate.toLocaleDateString([], { month: '2-digit', day: '2-digit', year: 'numeric' }) : 'Select Date'}
                </Text>
              </View>
              <View style={s.calInputCard}>
                <Ionicons name="time-outline" size={14} color={C.onSurfaceVariant} />
                <TextInput
                  style={s.calTimeInput}
                  value={tempEndTime}
                  onChangeText={setTempEndTime}
                  placeholder="23:59"
                  placeholderTextColor={C.outline}
                  keyboardType="numbers-and-punctuation"
                />
              </View>
            </View>
          </View>

          {/* Month Selector navigation */}
          <View style={s.calMonthNav}>
            <TouchableOpacity onPress={prevMonth} style={s.calNavBtn}>
              <Ionicons name="chevron-back" size={16} color={C.onSurface} />
            </TouchableOpacity>
            <Text style={s.calMonthTitle}>
              {calendarMonth.toLocaleDateString([], { month: 'long', year: 'numeric' })}
            </Text>
            <TouchableOpacity onPress={nextMonth} style={s.calNavBtn}>
              <Ionicons name="chevron-forward" size={16} color={C.onSurface} />
            </TouchableOpacity>
          </View>

          {/* Weekday Header */}
          <View style={s.calWeekHeader}>
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, idx) => (
              <Text key={idx} style={s.calWeekText}>{day}</Text>
            ))}
          </View>

          {/* Days Grid */}
          <View style={s.calGrid}>
            {calendarGrid.map((day, idx) => {
              if (!day) return <View key={idx} style={s.calEmptyCell} />;

              const isStart = tempStartDate && day.toDateString() === tempStartDate.toDateString();
              const isEnd = tempEndDate && day.toDateString() === tempEndDate.toDateString();
              const isSelected = isStart || isEnd;
              const inRange = tempStartDate && tempEndDate && day > tempStartDate && day < tempEndDate;

              return (
                <TouchableOpacity
                  key={idx}
                  style={[
                    s.calCell,
                    inRange && s.calCellInRange,
                    isStart && tempEndDate && s.calCellStartRange,
                    isEnd && tempEndDate && s.calCellEndRange,
                    isSelected && !tempEndDate && s.calCellSingleSelected,
                  ]}
                  onPress={() => handleDayPress(day)}
                  activeOpacity={0.8}
                >
                  <Text style={[
                    s.calCellText,
                    isSelected && s.calCellTextSelectedSolid,
                    inRange && s.calCellTextSelectedRange,
                  ]}>
                    {day.getDate()}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Bottom Actions */}
          <View style={s.calActions}>
            <TouchableOpacity
              onPress={handleReset}
              style={s.calResetBtn}
            >
              <Text style={s.calResetText}>Reset All</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleApply}
              style={s.calApplyBtn}
            >
              <Text style={s.calApplyText}>Apply</Text>
            </TouchableOpacity>
          </View>

        </Animated.View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalOverlayBackground: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(27, 29, 14, 0.4)', // matches AppModal backdrop color exactly
  },
  modalContent: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: C.surface,
    borderRadius: 32,
    padding: 32,
    shadowColor: '#1b1d0e',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 8,
  },
  calHeaderInputs: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  calInputLabel: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 11,
    color: C.onSurfaceVariant,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  calInputCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: C.surfaceContainerLow,
    borderRadius: 10,
    paddingHorizontal: 8,
    height: 36,
    borderWidth: 1,
    borderColor: 'rgba(68, 103, 77, 0.08)',
  },
  calInputText: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 12,
    color: C.onSurface,
    flex: 1,
  },
  calTimeInput: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 12,
    color: C.onSurface,
    flex: 1,
    padding: 0,
  },
  calMonthNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 8,
  },
  calNavBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: C.surfaceContainer,
    justifyContent: 'center',
    alignItems: 'center',
  },
  calMonthTitle: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 14,
    color: C.onSurface,
  },
  calWeekHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  calWeekText: {
    width: 42,
    textAlign: 'center',
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 11,
    color: C.outline,
  },
  calGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 4,
  },
  calEmptyCell: {
    width: 42,
    height: 42,
  },
  calCell: {
    width: 42,
    height: 42,
    justifyContent: 'center',
    alignItems: 'center',
  },
  calCellSelected: {
    backgroundColor: C.primary,
    borderRadius: 21,
  },
  calCellInRange: {
    backgroundColor: C.primaryContainer,
    borderRadius: 0,
  },
  calCellStartRange: {
    backgroundColor: C.primary,
    borderTopLeftRadius: 21,
    borderBottomLeftRadius: 21,
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
  },
  calCellEndRange: {
    backgroundColor: C.primary,
    borderTopRightRadius: 21,
    borderBottomRightRadius: 21,
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
  },
  calCellSingleSelected: {
    backgroundColor: C.primary,
    borderRadius: 21,
  },
  calCellText: {
    fontFamily: 'PlusJakartaSans-SemiBold',
    fontSize: 13,
    color: C.onSurface,
  },
  calCellTextSelectedSolid: {
    color: C.white,
    fontFamily: 'PlusJakartaSans-Bold',
  },
  calCellTextSelectedRange: {
    color: C.primary,
    fontFamily: 'PlusJakartaSans-Bold',
  },
  calActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderColor: 'rgba(68, 103, 77, 0.08)',
  },
  calResetBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  calResetText: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 15,
    color: C.outline,
  },
  calApplyBtn: {
    backgroundColor: C.primary,
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 12,
  },
  calApplyText: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 15,
    color: C.white,
  },
});
