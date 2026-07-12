import React, { useEffect, useCallback } from 'react'
import {
  StyleSheet,
  View,
  Text,
  TouchableWithoutFeedback,
  Pressable,
  BackHandler,
  ActivityIndicator,
} from 'react-native'
import Animated, { useAnimatedStyle, useSharedValue, withTiming, runOnJS, Easing } from 'react-native-reanimated'
import { MaterialIcons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'

export type AppModalIcon = 'error' | 'warning' | 'info' | 'success'

export type ButtonVariant = 'default' | 'destructive'

export interface AppModalProps {
  visible: boolean
  title: string
  message: string
  icon?: AppModalIcon
  primaryButton?: string
  onPrimaryPress?: () => void
  secondaryButton?: string
  onSecondaryPress?: () => void
  dismissable?: boolean
  onDismiss?: () => void
  steps?: string[]
  primaryVariant?: ButtonVariant
  primaryLoading?: boolean
  autoDismissMs?: number
}

const ICON_CONFIG: Record<AppModalIcon, { name: keyof typeof MaterialIcons.glyphMap; bg: string; color: string }> = {
  error: { name: 'error-outline', bg: '#ffdad3', color: '#9f402d' },
  warning: { name: 'warning-amber', bg: '#fff3cd', color: '#856404' },
  info: { name: 'info-outline', bg: '#d4edda', color: '#486730' },
  success: { name: 'check-circle-outline', bg: '#d4edda', color: '#2d6a4f' },
}

const PRIMARY_VARIANTS = {
  default: { bg: '#486730', text: '#ffffff' },
  destructive: { bg: '#9f402d', text: '#ffffff' },
}

export const AppModal = ({
  visible,
  title,
  message,
  icon,
  primaryButton = 'Okay',
  onPrimaryPress,
  secondaryButton,
  onSecondaryPress,
  dismissable = true,
  onDismiss,
  steps,
  primaryVariant = 'default',
  autoDismissMs,
  primaryLoading = false,
}: AppModalProps) => {
  const cardOpacity = useSharedValue(0)
  const backdropOpacity = useSharedValue(0)
  const translateY = useSharedValue(20)

  useEffect(() => {
    if (visible) {
      cardOpacity.value = withTiming(1, { duration: 250, easing: Easing.out(Easing.ease) })
      translateY.value = withTiming(0, { duration: 250, easing: Easing.out(Easing.ease) })
      backdropOpacity.value = withTiming(1, { duration: 200 })

      if (icon) {
        const hapticMap = {
          error: Haptics.NotificationFeedbackType.Error,
          warning: Haptics.NotificationFeedbackType.Warning,
          info: Haptics.NotificationFeedbackType.Success,
          success: Haptics.NotificationFeedbackType.Success,
        }
        Haptics.notificationAsync(hapticMap[icon])
      }
    }
  }, [visible])

  const animateOutAndCall = useCallback((callback?: () => void) => {
    cardOpacity.value = withTiming(0, { duration: 200 })
    translateY.value = withTiming(20, { duration: 200 })
    backdropOpacity.value = withTiming(0, { duration: 200 }, (finished) => {
      if (finished && callback) {
        runOnJS(callback)()
      }
    })
  }, [])

  useEffect(() => {
    if (visible && autoDismissMs && !secondaryButton) {
      const timer = setTimeout(() => {
        animateOutAndCall(onDismiss)
      }, autoDismissMs)
      return () => clearTimeout(timer)
    }
  }, [visible, autoDismissMs, secondaryButton, onDismiss, animateOutAndCall])

  const cardStyle = useAnimatedStyle(() => ({
    opacity: cardOpacity.value,
    transform: [{ translateY: translateY.value }],
  }))

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }))

  const handlePrimary = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    animateOutAndCall(() => onPrimaryPress?.())
  }

  const handleSecondary = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    animateOutAndCall(() => onSecondaryPress?.())
  }

  const handleBackdrop = useCallback(() => {
    if (dismissable) {
      animateOutAndCall(() => onDismiss?.())
    }
  }, [dismissable, onDismiss, animateOutAndCall])

  useEffect(() => {
    if (!visible) return
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      handleBackdrop()
      return true
    })
    return () => subscription.remove()
  }, [visible, handleBackdrop])

  const iconCfg = icon ? ICON_CONFIG[icon] : undefined
  const primColors = PRIMARY_VARIANTS[primaryVariant]

  return (
    <View style={styles.overlay} pointerEvents={visible ? 'auto' : 'none'}>
      <TouchableWithoutFeedback onPress={handleBackdrop}>
        <Animated.View style={[styles.backdrop, backdropStyle]} />
      </TouchableWithoutFeedback>
      <Animated.View style={[styles.card, cardStyle]} renderToHardwareTextureAndroid>
        {iconCfg && (
          <View style={[styles.iconContainer, { backgroundColor: iconCfg.bg }]}>
            <MaterialIcons name={iconCfg.name} size={32} color={iconCfg.color} />
          </View>
        )}
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.message}>{message}</Text>
        {steps && steps.length > 0 && (
          <View style={styles.stepsContainer}>
            {steps.map((step, idx) => (
              <Text key={idx} style={styles.stepText}>
                {idx + 1}. {step}
              </Text>
            ))}
          </View>
        )}
        <View style={[styles.actions, !secondaryButton && styles.actionsSingle]}>
          {secondaryButton && (
            <Pressable style={styles.secondaryButton} onPress={handleSecondary}>
              <Text style={styles.secondaryText}>{secondaryButton}</Text>
            </Pressable>
          )}
          <Pressable
            style={[
              styles.primaryButton,
              { backgroundColor: primColors.bg },
              !secondaryButton && styles.primaryButtonFull,
            ]}
            onPress={handlePrimary}
            disabled={primaryLoading}
          >
            {primaryLoading ? (
              <ActivityIndicator size="small" color={primColors.text} />
            ) : (
              <Text style={[styles.primaryText, { color: primColors.text }]}>{primaryButton}</Text>
            )}
          </Pressable>
        </View>
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(27, 29, 14, 0.4)',
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#fff8f0',
    borderRadius: 32,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#1b1d0e',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 4,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontFamily: 'PlusJakartaSans-ExtraBold',
    fontSize: 24,
    color: '#1b1d0e',
    marginBottom: 12,
    textAlign: 'center',
  },
  message: {
    fontFamily: 'Manrope-Medium',
    fontSize: 16,
    color: '#43483d',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 16,
  },
  stepsContainer: {
    alignItems: 'flex-start',
    marginBottom: 32,
    width: '100%',
  },
  stepText: {
    fontFamily: 'Manrope-Regular',
    fontSize: 14,
    color: '#43483d',
    marginBottom: 4,
  },
  actions: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
  },
  actionsSingle: {
    justifyContent: 'center',
  },
  primaryButton: {
    flexGrow: 1,
    flexBasis: 0,
    height: 52,
    borderRadius: 9999,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryButtonFull: {
    flex: 0,
    width: '100%',
  },
  primaryText: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 16,
    textAlign: 'center',
  },
  secondaryButton: {
    flexGrow: 1,
    flexBasis: 0,
    height: 52,
    backgroundColor: '#efefd7',
    borderRadius: 9999,
    justifyContent: 'center',
    alignItems: 'center',
  },
  secondaryText: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 16,
    color: '#43483d',
    textAlign: 'center',
  },
})
