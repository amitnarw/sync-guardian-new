import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Dimensions,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { AuthColors as C, AuthRadius as R } from '@/constants/auth-theme';
import {
  createAutopaySubscription,
  formatPaise,
  listPlans,
  type Plan,
} from '@/services/subscription-api';
import { startSubscriptionTransaction } from '@/services/phonepe-pg';
import { useAuthStore } from '@/hooks/use-auth-store';
import { useSubscriptionStore } from '@/hooks/use-subscription-store';
import { logger } from '@/services/logger';
import {
  useCheckoutSheet,
  useCheckoutSheetIsOpen,
  useCheckoutPlanId,
  useCheckoutSheetStore,
} from '@/components/paywall/checkout-sheet-controller';

const SCREEN_HEIGHT = Dimensions.get('window').height;
const SNAP_Y = SCREEN_HEIGHT * 0.12;
const SHEET_HEIGHT = SCREEN_HEIGHT - SNAP_Y;
const DISMISS_THRESHOLD = SCREEN_HEIGHT * 0.28;

const TIER_ICON: Record<'tier_a' | 'tier_b', keyof typeof Ionicons.glyphMap> = {
  tier_a: 'sparkles',
  tier_b: 'rocket',
};

function formatPaiseSplit(paise: number): { rupees: string; decimal: string } {
  const formatted = (paise / 100).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const [whole, dec] = formatted.split('.');
  return { rupees: whole ?? '0', decimal: dec ?? '00' };
}

function CheckoutSheetBody() {
  const insets = useSafeAreaInsets();
  const isOpen = useCheckoutSheetIsOpen();
  const planId = useCheckoutPlanId();
  const markClosed = useCheckoutSheetStore((s) => s.markClosed);
  const { dismiss } = useCheckoutSheet();

  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorBoxShown, setErrorBoxShown] = useState(false);

  const userId = useAuthStore((s) => s.userId);
  const refreshSubscription = useSubscriptionStore((s) => s.refresh);

  const translateY = useSharedValue(SCREEN_HEIGHT);
  const backdropOpacity = useSharedValue(0);
  const sheetStartY = useSharedValue(0);
  const closeCompletedRef = useRef(false);
  const wasOpenRef = useRef(false);
  const [mounted, setMounted] = useState(false);

  function unmount() {
    markClosed();
    setSubmitting(false);
    setError(null);
    setErrorBoxShown(false);
    wasOpenRef.current = false;
    closeCompletedRef.current = false;
    setMounted(false);
  }

  // Mount/unmount cycle based on store `isOpen`.
  useEffect(() => {
    const becameOpen = isOpen && !wasOpenRef.current;
    const becameClosed = !isOpen && wasOpenRef.current;

    if (becameOpen) {
      wasOpenRef.current = true;
      closeCompletedRef.current = false;
      setMounted(true);
    } else if (becameClosed && !closeCompletedRef.current) {
      closeCompletedRef.current = true;
      translateY.value = withSpring(
        SCREEN_HEIGHT,
        { damping: 30, stiffness: 300, mass: 0.9 },
        (finished) => {
          if (finished) {
            runOnJS(unmount)();
          }
        },
      );
      backdropOpacity.value = withTiming(0, { duration: 200 });
    }
    // unmount is intentionally omitted: it depends on store setters and is stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, translateY, backdropOpacity]);

  // After mount, animate the sheet up.
  useEffect(() => {
    if (!mounted) return;
    if (isOpen) {
      translateY.value = withSpring(SNAP_Y, { damping: 30, stiffness: 300, mass: 0.9 });
      backdropOpacity.value = withTiming(1, { duration: 240 });
    }
  }, [mounted, isOpen, translateY, backdropOpacity]);

  // Android hardware back button dismisses.
  useEffect(() => {
    if (!mounted) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      handleClose();
      return true;
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, submitting]);

  useEffect(() => {
    if (!isOpen || !planId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    listPlans()
      .then((p) => {
        if (cancelled) return;
        setPlans(p);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load plan');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, planId]);

  const selectedPlan =
    plans.find((p) => p.id === planId) ??
    plans.find((p) => p.frequency === 'yearly' && p.tier === 'tier_a') ??
    plans.find((p) => p.frequency === 'yearly') ??
    plans[0] ??
    null;

  const handleClose = () => {
    if (submitting) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    dismiss();
  };

  const handleComplete = async () => {
    if (!selectedPlan || submitting) return;
    if (Platform.OS !== 'android') return;
    setSubmitting(true);
    setError(null);
    setErrorBoxShown(false);
    try {
      const flowId = `sg${(userId ?? 'user').replace(/[^a-zA-Z0-9]/g, '').slice(0, 24)}`;
      const order = await createAutopaySubscription(selectedPlan.id);
      const result = await startSubscriptionTransaction(order.orderId, order.token, flowId);
      if (result.status === 'SUCCESS') {
        for (let i = 0; i < 6; i++) {
          await refreshSubscription();
          if (useSubscriptionStore.getState().hasAccess) break;
          await new Promise((r) => setTimeout(r, 1000));
        }
        dismiss();
        router.replace('/(tabs)/home');
      } else {
        setError(
          result.error ?? 'The subscription could not be completed. Please try again.',
        );
        setErrorBoxShown(true);
        refreshSubscription().catch(() => undefined);
      }
    } catch (e) {
      const name = e instanceof Error ? e.name : 'Error';
      const message = e instanceof Error ? e.message : 'unknown error';
      logger.warn('paywall', 'checkout failed', {
        name,
        message,
        stack: e instanceof Error ? e.stack : undefined,
      });
      const clipped = message.length > 180 ? `${message.slice(0, 180)}…` : message;
      setError(`We couldn't start your subscription. (${clipped})`);
      setErrorBoxShown(true);
      refreshSubscription().catch(() => undefined);
    } finally {
      setSubmitting(false);
    }
  };

  const panGesture = Gesture.Pan()
    .enabled(mounted && isOpen)
    .onStart(() => {
      sheetStartY.value = translateY.value;
    })
    .onUpdate((e) => {
      const next = sheetStartY.value + e.translationY;
      translateY.value = next > SNAP_Y ? next : SNAP_Y;
    })
    .onEnd(() => {
      if (translateY.value > DISMISS_THRESHOLD) {
        runOnJS(handleClose)();
      } else {
        translateY.value = withSpring(SNAP_Y, { damping: 30, stiffness: 300, mass: 0.9 });
      }
    });

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  if (!mounted) return null;

  const renderSheet = () => {
    if (!planId) {
      return (
        <View style={bs.loadingWrap} pointerEvents="box-none">
          <ActivityIndicator color={C.primary} size="large" />
        </View>
      );
    }
    if (loading && !selectedPlan) {
      return (
        <View style={bs.loadingWrap} pointerEvents="box-none">
          <ActivityIndicator color={C.primary} size="large" />
        </View>
      );
    }
    if (!selectedPlan) {
      return (
        <View style={bs.loadingWrap} pointerEvents="box-none">
          <Pressable onPress={handleClose} style={bs.retryPress}>
            <Text style={bs.retryText}>No plan found · Tap to close</Text>
          </Pressable>
        </View>
      );
    }

    const tierIcon = TIER_ICON[selectedPlan.tier];
    const priceParts = formatPaiseSplit(selectedPlan.amount_paise);
    const periodLabel = selectedPlan.frequency === 'monthly' ? 'Monthly' : 'Annual';
    const bottomPadding = insets.bottom + 16;

    return (
      <>
        <GestureDetector gesture={panGesture}>
          <View style={bs.dragHandleWrap}>
            <View style={bs.dragHandle} />
          </View>
        </GestureDetector>
        <ScrollView
          style={bs.sheetScroll}
          contentContainerStyle={bs.sheetContent}
          showsVerticalScrollIndicator={false}
          scrollEnabled={isOpen}
        >
          <View style={bs.headerRow}>
            <Pressable
              onPress={handleClose}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Close checkout"
              style={bs.closeButton}
              disabled={submitting}
            >
              <Ionicons name="close" size={26} color={C.onSurface} />
            </Pressable>
            <Text style={bs.headerTitle}>Checkout</Text>
            <View style={bs.headerBalancer} />
          </View>

          <View style={bs.productHero}>
            <View style={bs.productFrame}>
              <LinearGradient
                colors={[C.primaryContainer, C.surfaceContainer]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={bs.heroBlob}
              />
              <View style={bs.heroTile}>
                <Ionicons name={tierIcon} size={56} color={C.primary} />
              </View>
            </View>

            <Text style={bs.heroTitle}>{selectedPlan.name}</Text>
            <Text style={bs.heroSubtitle}>{selectedPlan.description}</Text>

            <View style={bs.heroPriceRow}>
              <Text style={bs.heroPriceSymbol}>₹</Text>
              <Text style={bs.heroPrice}>{priceParts.rupees}</Text>
              <Text style={bs.heroPriceDecimal}>.{priceParts.decimal}</Text>
            </View>
          </View>

          <View style={bs.payBlock}>
            <Text style={bs.payEyebrow}>Pay With</Text>
            <View style={bs.paymentRadio}>
              <View style={bs.paymentRadioIcon}>
                <Ionicons name="wallet" size={22} color="#5F259F" />
              </View>
              <View style={bs.paymentRadioText}>
                <Text style={bs.paymentRadioTitle}>PhonePe UPI</Text>
                <Text style={bs.paymentRadioCaption}>
                  Tap to authorise via the PhonePe app
                </Text>
              </View>
              <View style={bs.paymentRadioCheck}>
                <Ionicons name="checkmark" size={14} color={C.onPrimary} />
              </View>
            </View>
          </View>

          <View style={bs.summaryRows}>
            <View style={bs.summaryRow}>
              <Text style={bs.summaryLabel}>Subtotal · {periodLabel}</Text>
              <Text style={bs.summaryValue}>
                {formatPaise(selectedPlan.amount_paise)}
              </Text>
            </View>
            <View style={bs.summaryRow}>
              <Text style={bs.summaryLabel}>Shipping</Text>
              <Text style={bs.summaryValue}>Free</Text>
            </View>
          </View>

          {error && errorBoxShown ? (
            <View style={bs.errorBox}>
              <Ionicons name="alert-circle-outline" size={16} color={C.error} />
              <Text style={bs.errorText}>{error}</Text>
            </View>
          ) : null}
        </ScrollView>

        <View style={[bs.bottomAction, { paddingBottom: bottomPadding }]}>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
                () => undefined,
              );
              handleComplete();
            }}
            disabled={submitting || Platform.OS !== 'android'}
            style={({ pressed }) => [
              bs.verifyCta,
              pressed && { transform: [{ scale: 0.985 }] },
              (submitting || Platform.OS !== 'android') && { opacity: 0.6 },
            ]}
          >
            {submitting ? (
              <ActivityIndicator color={C.onPrimary} size="small" />
            ) : (
              <>
                <Ionicons
                  name="finger-print"
                  size={22}
                  color={C.onPrimary}
                  style={{ marginRight: 8 }}
                />
                <Text style={bs.verifyCtaText}>
                  {Platform.OS === 'android' ? 'Verify & Pay' : 'Coming soon on iOS'}
                </Text>
              </>
            )}
          </Pressable>

          <View style={bs.reassurance}>
            <Ionicons name="lock-closed" size={12} color={C.onSurfaceVariant} />
            <Text style={bs.reassuranceText}>Secured by Nurturing Atelier</Text>
          </View>

          {Platform.OS !== 'android' ? (
            <View style={bs.iosNotice}>
              <Ionicons
                name="phone-portrait-outline"
                size={16}
                color={C.onSurfaceVariant}
              />
              <Text style={bs.iosNoticeText}>
                UPI AutoPay is currently Android-only. Subscribe from an Android device.
              </Text>
            </View>
          ) : null}
        </View>
      </>
    );
  };

  return (
    <View pointerEvents="box-none" style={bs.root}>
      <Animated.View
        style={[bs.backdrop, backdropStyle]}
        pointerEvents={isOpen ? 'auto' : 'none'}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
      </Animated.View>
      <Animated.View style={[bs.sheet, sheetStyle]}>
        {renderSheet()}
      </Animated.View>
    </View>
  );
}

const bs = StyleSheet.create({
  root: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryPress: {
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: R.full,
    backgroundColor: C.surfaceContainerLow,
  },
  retryText: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 14,
    color: C.onSurface,
  },
  sheet: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: SHEET_HEIGHT,
    backgroundColor: '#fff8f0',
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    overflow: 'hidden',
    shadowColor: '#363228',
    shadowOffset: { width: 0, height: -12 },
    shadowOpacity: 0.25,
    shadowRadius: 48,
    elevation: 16,
  },
  dragHandleWrap: {
    paddingTop: 12,
    paddingBottom: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dragHandle: {
    width: 48,
    height: 6,
    borderRadius: 3,
    backgroundColor: C.outlineVariant,
    opacity: 0.5,
  },
  sheetScroll: {
    flex: 1,
  },
  sheetContent: {
    paddingHorizontal: 24,
    paddingTop: 4,
    paddingBottom: 24,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -8,
  },
  headerTitle: {
    fontFamily: 'PlusJakartaSans-SemiBold',
    fontSize: 18,
    color: C.onSurface,
    letterSpacing: -0.2,
  },
  headerBalancer: {
    width: 40,
    height: 40,
    marginRight: -8,
  },
  productHero: {
    alignItems: 'center',
    marginBottom: 32,
  },
  productFrame: {
    width: 128,
    height: 128,
    marginBottom: 24,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroBlob: {
    position: 'absolute',
    top: -8,
    left: -8,
    right: -8,
    bottom: -8,
    borderRadius: 32,
    transform: [{ rotate: '3deg' }, { scale: 1.05 }],
    borderTopLeftRadius: 48,
    borderTopRightRadius: 32,
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 32,
  },
  heroTile: {
    width: 128,
    height: 128,
    borderRadius: 24,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#363228',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  heroTitle: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 24,
    lineHeight: 30,
    color: C.onSurface,
    letterSpacing: -0.4,
    marginBottom: 4,
    textAlign: 'center',
  },
  heroSubtitle: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 14,
    lineHeight: 20,
    color: C.onSurfaceVariant,
    marginBottom: 16,
    textAlign: 'center',
  },
  heroPriceRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  heroPriceSymbol: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 22,
    lineHeight: 26,
    color: C.primary,
    marginRight: 4,
    marginTop: 8,
  },
  heroPrice: {
    fontFamily: 'PlusJakartaSans-ExtraBold',
    fontSize: 48,
    lineHeight: 52,
    color: C.primary,
    letterSpacing: -1.5,
    fontVariant: ['tabular-nums'],
  },
  heroPriceDecimal: {
    fontFamily: 'PlusJakartaSans-ExtraBold',
    fontSize: 22,
    lineHeight: 26,
    color: C.primary,
    marginTop: 8,
    fontVariant: ['tabular-nums'],
  },
  payBlock: {
    marginBottom: 24,
  },
  payEyebrow: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 11,
    color: C.onSurfaceVariant,
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginBottom: 12,
    paddingHorizontal: 4,
    opacity: 0.8,
  },
  paymentRadio: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.surfaceContainerLowest,
    borderRadius: 24,
    padding: 16,
    borderWidth: 2,
    borderColor: 'rgba(72,103,48,0.20)',
    shadowColor: '#363228',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 20,
    elevation: 2,
  },
  paymentRadioIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(95,37,159,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  paymentRadioText: {
    flex: 1,
  },
  paymentRadioTitle: {
    fontFamily: 'PlusJakartaSans-SemiBold',
    fontSize: 16,
    color: C.onSurface,
    marginBottom: 2,
  },
  paymentRadioCaption: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    color: C.onSurfaceVariant,
  },
  paymentRadioCheck: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: C.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryRows: {
    paddingHorizontal: 8,
    marginBottom: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  summaryLabel: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 14,
    color: C.onSurfaceVariant,
  },
  summaryValue: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 14,
    color: C.onSurface,
    fontVariant: ['tabular-nums'],
  },
  errorBox: {
    marginTop: 12,
    marginHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: C.errorContainer,
    borderRadius: R.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  errorText: {
    flex: 1,
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 13,
    color: C.onErrorContainer,
  },
  bottomAction: {
    paddingHorizontal: 24,
    paddingTop: 12,
    backgroundColor: '#fff8f0',
    borderTopWidth: 1,
    borderTopColor: C.surfaceContainer,
  },
  verifyCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 56,
    borderRadius: R.full,
    backgroundColor: C.primary,
    shadowColor: C.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
    elevation: 6,
  },
  verifyCtaText: {
    fontFamily: 'PlusJakartaSans-SemiBold',
    fontSize: 18,
    color: C.onPrimary,
    letterSpacing: 0.2,
  },
  reassurance: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: 14,
    opacity: 0.7,
  },
  reassuranceText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 10,
    color: C.onSurfaceVariant,
    marginLeft: 4,
  },
  iosNotice: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: C.surfaceContainer,
    borderRadius: R.md,
    padding: 14,
  },
  iosNoticeText: {
    flex: 1,
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 13,
    color: C.onSurfaceVariant,
    lineHeight: 18,
  },
});

export function CheckoutSheetMount() {
  return <CheckoutSheetBody />;
}
