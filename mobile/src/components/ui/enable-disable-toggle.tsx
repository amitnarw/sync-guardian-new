import React, { useState, useEffect, useRef } from 'react'
import { View, Pressable, Text, StyleSheet, Animated, Easing } from 'react-native'

const CREAM = '#F2EEE3'
const GREEN = '#3F6B50'
const INACTIVE_TEXT = '#57534E'

const CONTAINER_W = 150
const CONTAINER_H = 45
const PAD = 2
const SEG_W = (CONTAINER_W - PAD * 2) / 2
const SEG_H = CONTAINER_H - PAD * 2

export type EnableDisableValue = 'enabled' | 'disabled'

type EnableDisableToggleProps = {
  value?: EnableDisableValue
  onChange?: (value: EnableDisableValue) => void
}

export const EnableDisableToggle = ({ value = 'enabled', onChange }: EnableDisableToggleProps) => {
  const [internal, setInternal] = useState<EnableDisableValue>(value ?? 'enabled')
  const translateX = useRef(new Animated.Value(value === 'disabled' ? SEG_W : 0)).current

  useEffect(() => {
    if (value !== undefined) setInternal(value)
  }, [value])

  useEffect(() => {
    Animated.timing(translateX, {
      toValue: internal === 'disabled' ? SEG_W : 0,
      duration: 180,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start()
  }, [internal, translateX])

  const handlePress = (next: EnableDisableValue) => {
    setInternal(next)
    onChange?.(next)
  }

  return (
    <View
      style={[
        styles.container,
        { width: CONTAINER_W, height: CONTAINER_H, padding: PAD, borderRadius: CONTAINER_H / 2 },
      ]}
    >
      <Animated.View
        style={[styles.pill, { width: SEG_W, height: SEG_H, borderRadius: SEG_H / 2, transform: [{ translateX }] }]}
      />
      <Pressable style={[styles.segment, { width: SEG_W }]} onPress={() => handlePress('enabled')}>
        <Text style={[styles.segmentText, internal === 'enabled' ? styles.activeText : styles.inactiveText]}>
          Enable All
        </Text>
      </Pressable>
      <Pressable style={[styles.segment, { width: SEG_W }]} onPress={() => handlePress('disabled')}>
        <Text style={[styles.segmentText, internal === 'disabled' ? styles.activeText : styles.inactiveText]}>
          Disable All
        </Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    flexDirection: 'row',
    backgroundColor: CREAM,
  },
  pill: {
    position: 'absolute',
    left: PAD,
    top: PAD,
    backgroundColor: GREEN,
    zIndex: 0,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  segmentText: {
    fontSize: 11,
    includeFontPadding: false,
    textAlign: 'center',
  },
  activeText: {
    color: '#ffffff',
    fontWeight: '600',
  },
  inactiveText: {
    color: INACTIVE_TEXT,
    fontWeight: '400',
  },
})
