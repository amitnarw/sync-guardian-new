import React, { useEffect, useMemo, useState } from 'react';
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
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, {
  FadeInDown,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { AuthColors as C, AuthRadius as R } from '@/constants/auth-theme';
import { listPlans, type Plan } from '@/services/subscription-api';
import { logger } from '@/services/logger';
import { useAuthStore } from '@/hooks/use-auth-store';
import { useCheckoutSheet } from '@/components/paywall/checkout-sheet-controller';
import { ScreenHeader } from '@/components/ui/screen-header';

type Frequency = 'monthly' | 'yearly';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const CARD_WIDTH = Math.min(SCREEN_WIDTH * 0.78, 380);
const CARD_GAP = 24;
const CARD_INSET = (SCREEN_WIDTH - CARD_WIDTH) / 2;

const TIER_FEATURES: Record<'tier_a' | 'tier_b', string[]> = {
  tier_a: [
    'Real-time notification mirror',
    'One paired child device',
    '30-day activity history',
    'UPI AutoPay, cancel anytime',
  ],
  tier_b: [
    'Up to 4 paired child devices',
    'Priority push delivery',
    '90-day activity history',
    'Per-app granular controls',
    'Early access to insights',
  ],
};

function computeYearlySavingsPct(monthlyPaise: number, yearlyPaise: number): number {
  const annualized = monthlyPaise * 12;
  if (annualized <= 0) return 0;
  return Math.round(((annualized - yearlyPaise) / annualized) * 100);
}

interface FrequencyToggleProps {
  value: Frequency;
  onChange: (next: Frequency) => void;
  savingsPct: number;
  layoutKey: number;
}

function FrequencyToggle({ value, onChange, savingsPct, layoutKey }: FrequencyToggleProps) {
  const offset = useSharedValue(value === 'yearly' ? 1 : 0);
  useEffect(() => {
    offset.value = withTiming(value === 'yearly' ? 1 : 0, { duration: 280 });
  }, [value, offset]);

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: offset.value * 140 + 4 }] as any,
  }));

  return (
    <View key={layoutKey} style={s.toggleWrap}>
      <Animated.View style={[s.toggleIndicator, indicatorStyle]} pointerEvents="none" />
      {(['monthly', 'yearly'] as Frequency[]).map((freq) => {
        const active = value === freq;
        return (
          <Pressable
            key={freq}
            onPress={() => {
              if (active) return;
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
              onChange(freq);
            }}
            style={s.toggleOption}
          >
            <Text style={[s.toggleLabel, active && s.toggleLabelActive]}>
              {freq === 'monthly' ? 'Monthly' : 'Annual'}
            </Text>
            {freq === 'yearly' && savingsPct > 0 && (
              <View style={s.savingsPill}>
                <Text style={s.savingsPillText}>{savingsPct}% off</Text>
              </View>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

interface SculpturalCardProps {
  plan: Plan;
  index: number;
  onContinue: () => void;
}

function SculpturalCard({ plan, index, onContinue }: SculpturalCardProps) {
  const features = TIER_FEATURES[plan.tier] ?? [];
  const period = plan.frequency === 'monthly' ? 'mo' : 'yr';
  const isRecommended = plan.tier === 'tier_b'; // Tier B / Pro is recommended

  if (isRecommended) {
    return (
      <Animated.View
        entering={FadeInDown.duration(550).delay(160 + index * 90)}
        style={[s.cardShadowRec, { width: CARD_WIDTH, marginRight: CARD_GAP }]}
      >
        <View style={[s.card, s.cardRecommended]}>
          {/* Exact Membership & Billing gradients */}
          <LinearGradient
            colors={['#2f4a37', '#1b3223']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
          <LinearGradient
            colors={['rgba(197, 236, 204, 0.25)', 'transparent']}
            start={{ x: 1, y: 0 }}
            end={{ x: 0.3, y: 0.8 }}
            style={StyleSheet.absoluteFillObject}
          />

          <View style={s.cardBody}>
            <View style={s.cardTopContent}>
              {/* Top Row: RECOMMENDED badge on left, App Logo (spa) on right */}
              <View style={s.topRow}>
                <View style={s.recommendedBadge}>
                  <Text style={s.recommendedBadgeText}>RECOMMENDED</Text>
                </View>
                <MaterialCommunityIcons name="spa" size={26} color="#c5eccc" />
              </View>

              {/* Title & Description */}
              <View style={s.cardHeaderBlock}>
                <Text style={s.cardTitleRec}>{plan.name}</Text>
                <Text style={s.cardTaglineRec}>{plan.description}</Text>
              </View>

              {/* Price */}
              <View style={s.priceRow}>
                <Text style={s.priceValueRec}>{formatPaise(plan.amount_paise)}</Text>
                <Text style={s.priceUnitRec}>/{period}</Text>
              </View>

              {/* Feature List */}
              <View style={s.features}>
                {features.map((label, i) => (
                  <View key={`${plan.id}-feature-${i}`} style={s.featureRow}>
                    <View style={s.featureBulletRec}>
                      <Ionicons name="checkmark" size={13} color="#c5eccc" />
                    </View>
                    <Text style={s.featureTextRec}>{label}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* White Capsule CTA Button with "Pay" */}
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
                onContinue();
              }}
              style={({ pressed }) => [
                s.cardCtaRec,
                pressed && { transform: [{ scale: 0.98 }] },
              ]}
            >
              <Text style={s.cardCtaTextRec}>Pay</Text>
            </Pressable>
          </View>
        </View>
      </Animated.View>
    );
  }

  return (
    <Animated.View
      entering={FadeInDown.duration(550).delay(160 + index * 90)}
      style={[s.cardShadowLight, { width: CARD_WIDTH, marginRight: CARD_GAP }]}
    >
      <View style={[s.card, s.cardLight]}>
        {/* Simple gradient of primary color light shade */}
        <LinearGradient
          colors={['#eaf5ed', '#cde8d5']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
        <LinearGradient
          colors={['rgba(255, 255, 255, 0.45)', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.4, y: 0.7 }}
          style={StyleSheet.absoluteFillObject}
        />

        <View style={s.cardBody}>
          <View style={s.cardTopContent}>
            {/* Title & Description */}
            <View style={s.cardHeaderBlock}>
              <Text style={s.cardTitleLight}>{plan.name}</Text>
              <Text style={s.cardTaglineLight}>{plan.description}</Text>
            </View>

            {/* Price */}
            <View style={s.priceRow}>
              <Text style={s.priceValueLight}>{formatPaise(plan.amount_paise)}</Text>
              <Text style={s.priceUnitLight}>/{period}</Text>
            </View>

            {/* Feature List */}
            <View style={s.features}>
              {features.map((label, i) => (
                <View key={`${plan.id}-feature-${i}`} style={s.featureRow}>
                  <View style={s.featureBulletLight}>
                    <Ionicons name="checkmark" size={13} color="#2f4a37" />
                  </View>
                  <Text style={s.featureTextLight}>{label}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Primary Shade Capsule CTA Button with "Pay" */}
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
              onContinue();
            }}
            style={({ pressed }) => [
              s.cardCtaLight,
              pressed && { transform: [{ scale: 0.98 }] },
            ]}
          >
            <Text style={s.cardCtaTextLight}>Pay</Text>
          </Pressable>
        </View>
      </View>
    </Animated.View>
  );
}

export default function PlansScreen() {
  const { reason } = useLocalSearchParams<{ reason?: string }>();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [frequency, setFrequency] = useState<Frequency>('yearly');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { present: presentCheckoutSheet } = useCheckoutSheet();

  // Defense-in-depth: children never see pricing/billing screens. Their
  // access is managed by the paired parent and surfaced on the child home.
  const userRole = useAuthStore((s) => s.userRole);
  useEffect(() => {
    if (userRole === 'child') {
      router.replace('/(child)/home');
    }
  }, [userRole]);

  // Back navigation: this screen is reachable from Settings → Manage → View
  // Plans and from the Home locked-state CTAs (pushed), but also as the
  // cold-start paywall (replaced ,  no history). Show the back affordance and
  // honor hardware back only when there is actually a screen to return to.
  const canGoBack = router.canGoBack();
  const handleBack = () => {
    if (router.canGoBack()) router.back();
  };
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (router.canGoBack()) {
        router.back();
        return true;
      }
      // No history (cold-start entry): let the OS default run.
      return false;
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    let cancelled = false;
    listPlans()
      .then((p) => {
        if (cancelled) return;
        setPlans(p);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load plans');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const visiblePlans = useMemo(
    () => plans.filter((x) => x.frequency === frequency),
    [plans, frequency],
  );

  const tierAPlans = useMemo(() => plans.filter((x) => x.tier === 'tier_a'), [plans]);
  const monthlyTierA = tierAPlans.find((p) => p.frequency === 'monthly');
  const yearlyTierA = tierAPlans.find((p) => p.frequency === 'yearly');
  const yearlySavingsPct = useMemo(() => {
    if (!monthlyTierA || !yearlyTierA) return 0;
    return computeYearlySavingsPct(monthlyTierA.amount_paise, yearlyTierA.amount_paise);
  }, [monthlyTierA, yearlyTierA]);

  // Contextual notice when the user was routed here because their access
  // lapsed (cold-start gate) ,  answers "why am I seeing pricing?" politely.
  const accessNotice: { icon: keyof typeof Ionicons.glyphMap; title: string; body: string } | null =
    reason === 'trial_ended'
      ? {
          icon: 'hourglass-outline',
          title: 'Your free trial has ended',
          body: 'Choose a plan below to resume monitoring ,  everything is waiting for you.',
        }
      : reason === 'subscription_ended'
        ? {
            icon: 'pause-circle-outline',
            title: 'Your subscription has ended',
            body: 'Reactivate a plan to continue protecting your family.',
          }
        : null;

  if (loading) {
    return (
      <SafeAreaView style={[s.root, s.center]} edges={['top', 'bottom']}>
        <ActivityIndicator color={C.primary} size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.root} edges={['top', 'bottom']}>
      {canGoBack ? (
        <ScreenHeader onBack={handleBack} />
      ) : null}
      <View style={s.scrollContent}>
        <Animated.View entering={FadeInUp.duration(550)} style={s.hero}>
          <Text style={s.heroEyebrow}>Subscription</Text>
          <Text style={s.heroTitle}>
            Choose Your{'\n'}
            <Text style={s.heroTitleAccent}>Journey</Text>
          </Text>
        </Animated.View>

        {accessNotice ? (
          <Animated.View entering={FadeInDown.duration(450)} style={s.accessNotice}>
            <Ionicons name={accessNotice.icon} size={22} color={C.secondary} />
            <View style={s.accessNoticeTextWrap}>
              <Text style={s.accessNoticeTitle}>{accessNotice.title}</Text>
              <Text style={s.accessNoticeBody}>{accessNotice.body}</Text>
            </View>
          </Animated.View>
        ) : null}

        <Animated.View
          entering={FadeInDown.duration(450).delay(80)}
          style={s.toggleRow}
        >
          <FrequencyToggle
            value={frequency}
            onChange={setFrequency}
            savingsPct={yearlySavingsPct}
            layoutKey={visiblePlans.length}
          />
        </Animated.View>

        <View style={s.cardListContent}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            snapToInterval={CARD_WIDTH + CARD_GAP}
            decelerationRate="fast"
            contentContainerStyle={s.cardList}
          >
            {visiblePlans.map((plan, i) => (
              <SculpturalCard
                key={plan.id}
                plan={plan}
                index={i}
                onContinue={() => {
                  if (Platform.OS !== 'android') return;
                  logger.info('paywall', 'continue pressed', { planId: plan.id });
                  presentCheckoutSheet(plan.id);
                }}
              />
            ))}
            <View style={{ width: CARD_INSET }} />
          </ScrollView>
        </View>

        {error ? (
          <Animated.View entering={FadeInDown.duration(280)} style={s.errorBox}>
            <Ionicons name="alert-circle-outline" size={16} color={C.error} />
            <Text style={s.errorText}>{error}</Text>
          </Animated.View>
        ) : null}

        {Platform.OS !== 'android' ? (
          <Animated.View entering={FadeInDown.duration(450).delay(340)} style={s.iosNotice}>
            <Ionicons name="phone-portrait-outline" size={16} color={C.onSurfaceVariant} />
            <Text style={s.iosNoticeText}>
              UPI AutoPay is currently Android-only. Subscribe from an Android device.
            </Text>
          </Animated.View>
        ) : null}

        <View style={{ height: 32 }} />
      </View>
    </SafeAreaView>
  );
}

function formatPaise(paise: number): string {
  return `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.surface },
  center: { alignItems: 'center', justifyContent: 'center' },
  scrollContent: { paddingBottom: 48 },

  accessNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginHorizontal: 24,
    marginBottom: 20,
    padding: 16,
    borderRadius: R.xl,
    backgroundColor: C.secondaryContainer,
  },
  accessNoticeTextWrap: { flex: 1, gap: 2 },
  accessNoticeTitle: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 15,
    color: C.onSurface,
  },
  accessNoticeBody: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 13,
    lineHeight: 18,
    color: C.onSurfaceVariant,
  },

  hero: {
    paddingHorizontal: 24,
    alignItems: 'center',
    marginBottom: 24,
    marginTop: 8,
    gap: 8,
  },
  heroEyebrow: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 11,
    color: C.secondary,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  heroTitle: {
    fontFamily: 'PlusJakartaSans-ExtraBold',
    fontSize: 48,
    lineHeight: 52,
    color: C.onSurface,
    letterSpacing: -1.5,
    textAlign: 'center',
  },
  heroTitleAccent: {
    fontFamily: 'PlusJakartaSans-Light',
    fontStyle: 'italic',
    color: C.primary,
    fontSize: 48,
    letterSpacing: -1,
  },

  toggleRow: {
    paddingHorizontal: 24,
    alignItems: 'center',
    marginBottom: 24,
  },
  toggleWrap: {
    flexDirection: 'row',
    backgroundColor: C.surfaceContainerHigh,
    borderRadius: R.full,
    padding: 6,
    position: 'relative',
    shadowColor: '#363228',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 0,
  },
  toggleIndicator: {
    position: 'absolute',
    top: 6,
    bottom: 6,
    left: 0,
    width: 140,
    borderRadius: R.full,
    backgroundColor: C.surfaceContainerLowest,
    shadowColor: '#363228',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  toggleOption: {
    width: 140,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    zIndex: 1,
  },
  toggleLabel: {
    fontFamily: 'PlusJakartaSans-SemiBold',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 2,
    color: C.outline,
  },
  toggleLabelActive: { color: C.onSurface },
  savingsPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: R.full,
    backgroundColor: C.secondaryContainer,
  },
  savingsPillText: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 9,
    color: C.onSecondaryContainer,
    letterSpacing: 0.4,
  },

  cardListContent: {
    paddingBottom: 24,
    paddingTop: 12,
  },
  cardList: {
    paddingLeft: CARD_INSET,
    paddingRight: 16,
    alignItems: 'flex-start',
  },

  cardShadowRec: {
    shadowColor: '#1b3223',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.22,
    shadowRadius: 20,
    elevation: 6,
  },
  cardShadowLight: {
    shadowColor: '#2f4a37',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.10,
    shadowRadius: 16,
    elevation: 3,
  },
  card: {
    borderRadius: 32,
    overflow: 'hidden',
    position: 'relative',
  },
  cardRecommended: {
    backgroundColor: '#2f4a37',
  },
  cardLight: {
    backgroundColor: '#eaf5ed',
  },

  cardBody: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 24,
    zIndex: 2,
  },
  cardTopContent: {
    // Normal content flow
  },

  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 28,
    marginBottom: 16,
  },
  recommendedBadge: {
    backgroundColor: '#c5eccc',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 9999,
  },
  recommendedBadgeText: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 10.5,
    color: '#1b3223',
    letterSpacing: 0.8,
  },

  cardHeaderBlock: {
    marginBottom: 18,
  },
  cardTitleRec: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 24,
    lineHeight: 28,
    color: '#ffffff',
    letterSpacing: -0.4,
  },
  cardTaglineRec: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 13.5,
    lineHeight: 18,
    color: 'rgba(232, 255, 234, 0.85)',
    marginTop: 4,
  },
  cardTitleLight: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 24,
    lineHeight: 28,
    color: '#1b3223',
    letterSpacing: -0.4,
  },
  cardTaglineLight: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 13.5,
    lineHeight: 18,
    color: '#3d5c47',
    marginTop: 4,
  },

  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 3,
    marginBottom: 22,
  },
  priceValueRec: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 40,
    lineHeight: 44,
    color: '#ffffff',
    letterSpacing: -1.2,
    fontVariant: ['tabular-nums'],
  },
  priceUnitRec: {
    fontFamily: 'PlusJakartaSans-SemiBold',
    fontSize: 14,
    color: 'rgba(232, 255, 234, 0.85)',
    letterSpacing: 0.2,
  },
  priceValueLight: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 40,
    lineHeight: 44,
    color: '#1b3223',
    letterSpacing: -1.2,
    fontVariant: ['tabular-nums'],
  },
  priceUnitLight: {
    fontFamily: 'PlusJakartaSans-SemiBold',
    fontSize: 14,
    color: '#3d5c47',
    letterSpacing: 0.2,
  },

  features: {
    gap: 13,
    marginBottom: 16,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  featureBulletRec: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
  },
  featureTextRec: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 13.5,
    lineHeight: 18,
    color: '#ffffff',
    flex: 1,
  },
  featureBulletLight: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    backgroundColor: 'rgba(47, 74, 55, 0.12)',
  },
  featureTextLight: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 13.5,
    lineHeight: 18,
    color: '#1b3223',
    flex: 1,
  },

  cardCtaRec: {
    height: 50,
    borderRadius: 9999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    marginTop: 20,
    marginBottom: 6,
    backgroundColor: '#ffffff',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 3,
  },
  cardCtaTextRec: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 15,
    color: '#1b3223',
    letterSpacing: 0.3,
  },
  cardCtaLight: {
    height: 50,
    borderRadius: 9999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    marginTop: 20,
    marginBottom: 6,
    backgroundColor: '#2f4a37',
    shadowColor: '#2f4a37',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.20,
    shadowRadius: 10,
    elevation: 3,
  },
  cardCtaTextLight: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 15,
    color: '#ffffff',
    letterSpacing: 0.3,
  },

  errorBox: {
    marginHorizontal: 24,
    marginTop: 16,
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

  iosNotice: {
    marginHorizontal: 24,
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
