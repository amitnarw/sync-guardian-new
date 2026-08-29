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
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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

type Frequency = 'monthly' | 'yearly';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const CARD_WIDTH = Math.min(SCREEN_WIDTH * 0.78, 380);
const CARD_GAP = 24;
const CARD_INSET = (SCREEN_WIDTH - CARD_WIDTH) / 2;

const PLAN_META: Record<
  'tier_a' | 'tier_b',
  {
    icon: keyof typeof Ionicons.glyphMap;
  }
> = {
  tier_a: {
    icon: 'sparkles',
  },
  tier_b: {
    icon: 'rocket',
  },
};

const TIER_FEATURES: Record<'tier_a' | 'tier_b', string[]> = {
  tier_a: [
    'Real-time notification mirror',
    'One paired child device',
    '30-day activity history',
    'UPI AutoPay — cancel anytime',
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
  const meta = PLAN_META[plan.tier];
  const features = TIER_FEATURES[plan.tier];
  const period = plan.frequency === 'monthly' ? 'mo' : 'yr';
  const isRecommended = plan.tier === 'tier_b'; // Tier B / Pro is recommended

  if (isRecommended) {
    return (
      <Animated.View
        entering={FadeInDown.duration(550).delay(160 + index * 90)}
        style={[s.cardShadow, { width: CARD_WIDTH, marginRight: CARD_GAP }]}
      >
        <View style={[s.card, s.cardRecommended]}>
          <View style={s.cardBody}>
            {/* Top Badge & Icon Row (Image 4) */}
            <View style={s.recommendedTopRow}>
              <View style={s.recommendedBadge}>
                <Text style={s.recommendedBadgeText}>RECOMMENDED</Text>
              </View>
              <View style={s.recommendedIconCircle}>
                <Ionicons name="leaf-outline" size={20} color="#a5d6a7" />
              </View>
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
                    <Ionicons name="checkmark" size={14} color="#a5d6a7" />
                  </View>
                  <Text style={s.featureTextRec}>{label}</Text>
                </View>
              ))}
            </View>

            {/* White Capsule CTA Button */}
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
                onContinue();
              }}
              style={({ pressed }) => [
                s.cardCtaRec,
                pressed && { transform: [{ scale: 0.97 }] },
              ]}
            >
              <Text style={s.cardCtaTextRec}>Choose {plan.name}</Text>
            </Pressable>
          </View>
        </View>
      </Animated.View>
    );
  }

  return (
    <Animated.View
      entering={FadeInDown.duration(550).delay(160 + index * 90)}
      style={[s.cardShadow, { width: CARD_WIDTH, marginRight: CARD_GAP }]}
    >
      <View style={s.card}>
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <LinearGradient
            colors={['rgba(54,50,40,0.06)', 'rgba(54,50,40,0)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ flex: 1 }}
          />
        </View>

        <View pointerEvents="none" style={s.blob} />

        <View style={s.cardBody}>
          <View style={s.cardHeaderRow}>
            <View style={s.cardHeaderBlock}>
              <Text style={s.cardTitle}>{plan.name}</Text>
              <Text style={s.cardTagline}>{plan.description}</Text>
            </View>
            <View style={s.iconCircle}>
              <Ionicons name={meta.icon} size={22} color={C.primary} />
            </View>
          </View>

          <View style={s.priceRow}>
            <Text style={s.priceValue}>{formatPaise(plan.amount_paise)}</Text>
            <Text style={s.priceUnit}>/{period}</Text>
          </View>

          <View style={s.features}>
            {features.map((label, i) => (
              <View key={`${plan.id}-feature-${i}`} style={s.featureRow}>
                <View style={s.featureBullet}>
                  <Ionicons name="checkmark" size={14} color={C.primary} />
                </View>
                <Text style={s.featureText}>{label}</Text>
              </View>
            ))}
          </View>

          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
              onContinue();
            }}
            style={({ pressed }) => [s.cardCta, pressed && { transform: [{ scale: 0.97 }] }]}
          >
            <Text style={s.cardCtaText}>Choose {plan.name}</Text>
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
  // cold-start paywall (replaced — no history). Show the back affordance and
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
  // lapsed (cold-start gate) — answers "why am I seeing pricing?" politely.
  const accessNotice: { icon: keyof typeof Ionicons.glyphMap; title: string; body: string } | null =
    reason === 'trial_ended'
      ? {
          icon: 'hourglass-outline',
          title: 'Your free trial has ended',
          body: 'Choose a plan below to resume monitoring — everything is waiting for you.',
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
      <SafeAreaView style={[s.root, s.center]} edges={['bottom']}>
        <ActivityIndicator color={C.primary} size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.root} edges={['bottom']}>
      {canGoBack ? (
        <View style={s.appBar}>
          <TouchableOpacity
            onPress={handleBack}
            hitSlop={10}
            style={s.appBarButton}
            accessibilityLabel="Go back"
            accessibilityRole="button"
          >
            <Ionicons name="chevron-back" size={22} color={C.onSurface} />
          </TouchableOpacity>
        </View>
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
  root: { flex: 1, backgroundColor: C.surface, marginTop: 50 },
  center: { alignItems: 'center', justifyContent: 'center' },
  scrollContent: { paddingBottom: 48 },

  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? 4 : 0,
    paddingBottom: 0,
  },
  appBarButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
    alignItems: 'center',
  },

  cardShadow: {
    shadowColor: '#363228',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 4,
  },
  card: {
    borderRadius: 40,
    overflow: 'hidden',
    minHeight: 460,
    position: 'relative',
    backgroundColor: C.surfaceContainer,
  },
  cardRecommended: {
    backgroundColor: '#2f4a37',
  },

  recommendedTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  recommendedBadge: {
    backgroundColor: '#a5d6a7',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 9999,
  },
  recommendedBadgeText: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 10,
    color: '#1b3d22',
    letterSpacing: 1,
  },
  recommendedIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  cardTitleRec: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 22,
    lineHeight: 28,
    marginBottom: 6,
    color: '#ffffff',
    letterSpacing: -0.4,
  },
  cardTaglineRec: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 13,
    lineHeight: 18,
    color: '#d1dfd5',
  },

  priceValueRec: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 44,
    lineHeight: 48,
    color: '#ffffff',
    letterSpacing: -1.5,
    fontVariant: ['tabular-nums'],
  },
  priceUnitRec: {
    fontFamily: 'PlusJakartaSans-SemiBold',
    fontSize: 13,
    color: '#b5cbbb',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },

  featureBulletRec: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
  },
  featureTextRec: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 13,
    lineHeight: 18,
    color: '#ffffff',
    flex: 1,
  },

  cardCtaRec: {
    height: 52,
    borderRadius: R.full,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: '#ffffff',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
  },
  cardCtaTextRec: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 2,
    color: '#1f3a28',
  },

  blob: {
    position: 'absolute',
    right: -48,
    top: -48,
    width: 192,
    height: 192,
    borderRadius: 96,
    backgroundColor: C.surfaceContainerLowest,
    opacity: 0.5,
  },

  cardBody: {
    padding: 28,
    zIndex: 2,
  },

  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: C.surfaceContainerLowest,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#363228',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },

  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    marginBottom: 24,
  },

  cardHeaderBlock: {
    flex: 1,
    minWidth: 0,
  },

  cardTitle: {
    fontFamily: 'PlusJakartaSans-Light',
    fontWeight: '300',
    fontSize: 22,
    lineHeight: 28,
    marginBottom: 6,
    color: C.onSurface,
    letterSpacing: -0.4,
  },

  cardTagline: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 13,
    lineHeight: 18,
    color: C.onSurfaceVariant,
  },

  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    marginBottom: 28,
  },
  priceValue: {
    fontFamily: 'PlusJakartaSans-Light',
    fontSize: 48,
    lineHeight: 52,
    color: C.onSurface,
    letterSpacing: -1.5,
    fontVariant: ['tabular-nums'],
  },
  priceUnit: {
    fontFamily: 'PlusJakartaSans-SemiBold',
    fontSize: 12,
    color: C.onSurfaceVariant,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },

  features: {
    gap: 12,
    marginBottom: 28,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  featureBullet: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    backgroundColor: C.surfaceContainerLow,
    shadowColor: '#363228',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  featureText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 13,
    lineHeight: 18,
    color: C.onSurface,
    flex: 1,
  },

  cardCta: {
    height: 52,
    borderRadius: R.full,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: C.primary,
    shadowColor: C.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 16,
    elevation: 6,
  },
  cardCtaText: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 2,
    color: C.onPrimary,
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
