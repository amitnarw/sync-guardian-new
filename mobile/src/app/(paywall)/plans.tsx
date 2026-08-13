import React, { useEffect, useMemo, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Platform,
  PressableStateCallbackType,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { AuthColors as C, AuthFonts, AuthRadius as R, AuthGradients } from '@/constants/auth-theme';
import { listPlans, createAutopaySubscription, type Plan } from '@/services/subscription-api';
import { startSubscriptionTransaction } from '@/services/phonepe-pg';
import { useSubscriptionStore } from '@/hooks/use-subscription-store';
import { useAuthStore } from '@/hooks/use-auth-store';
import { logger } from '@/services/logger';
import { Price } from '@/components/paywall/price';
import { TrialRibbon } from '@/components/paywall/trial-ribbon';

type Frequency = 'monthly' | 'yearly';

const TIER_LABELS: Record<'tier_a' | 'tier_b', { name: string; tagline: string }> = {
  tier_a: {
    name: 'Guardian',
    tagline: 'Everything you need to keep one device safe.',
  },
  tier_b: {
    name: 'Guardian+',
    tagline: 'Priority monitoring for families with multiple devices.',
  },
};

const TIER_A_FEATURES = [
  'Real-time notification mirror',
  'One paired child device',
  '30-day activity history',
  'Configurable app filters',
  'UPI AutoPay — cancel anytime',
];

const TIER_B_EXTRAS = [
  'Up to 4 paired child devices',
  'Priority push delivery',
  '90-day activity history',
  'Per-app granular controls',
  'Early access to new insights',
];

function computeYearlySavingsPct(monthlyPaise: number, yearlyPaise: number): number {
  const annualized = monthlyPaise * 12;
  if (annualized <= 0) return 0;
  return Math.round(((annualized - yearlyPaise) / annualized) * 100);
}

interface FrequencyToggleProps {
  value: Frequency;
  onChange: (next: Frequency) => void;
  savingsPct: number;
}

function FrequencyToggle({ value, onChange, savingsPct }: FrequencyToggleProps) {
  const options: { key: Frequency; label: string }[] = [
    { key: 'monthly', label: 'Monthly' },
    { key: 'yearly', label: 'Yearly' },
  ];

  const activeIndex = value === 'monthly' ? 0 : 1;
  const segmentWidthPct = 100 / options.length;
  const indicator = useSharedValue(activeIndex);

  useEffect(() => {
    indicator.value = withSpring(activeIndex, { damping: 18, stiffness: 220 });
  }, [activeIndex, indicator]);

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: interpolate(
          indicator.value,
          [0, 1],
          [0, 100],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  return (
    <View style={styles.toggle}>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.toggleIndicator,
          { width: `${segmentWidthPct}%`, left: 0 },
          indicatorStyle,
        ]}
      />
      {options.map((opt, i) => {
        const active = value === opt.key;
        const isYearly = opt.key === 'yearly';
        return (
          <Pressable
            key={opt.key}
            onPress={() => onChange(opt.key)}
            style={styles.toggleOption}
            android_ripple={{ color: 'transparent' }}
          >
            <Text style={[styles.toggleLabel, active && styles.toggleLabelActive]}>{opt.label}</Text>
            {isYearly && savingsPct > 0 ? (
              <View style={[styles.savePill, active && styles.savePillActive]}>
                <Text style={[styles.savePillText, active && styles.savePillTextActive]}>
                  Save {savingsPct}%
                </Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

interface PlanCardProps {
  plan: Plan;
  selected: boolean;
  onSelect: () => void;
  index: number;
  recommended?: boolean;
}

function PlanCard({ plan, selected, onSelect, index, recommended }: PlanCardProps) {
  const selection = useSharedValue(selected ? 1 : 0);

  useEffect(() => {
    selection.value = withSpring(selected ? 1 : 0, { damping: 18, stiffness: 220 });
  }, [selected, selection]);

  const ringStyle = useAnimatedStyle(() => ({
    opacity: interpolate(selection.value, [0, 1], [0, 1], Extrapolation.CLAMP),
    transform: [{ scale: interpolate(selection.value, [0, 1], [0.98, 1], Extrapolation.CLAMP) }],
  }));

  const scaleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(selection.value, [0, 1], [1, 1.012], Extrapolation.CLAMP) }],
  }));

  const tier = TIER_LABELS[plan.tier];
  const features = plan.tier === 'tier_b' ? [...TIER_A_FEATURES.slice(0, 2), ...TIER_B_EXTRAS.slice(0, 3)] : TIER_A_FEATURES;

  const onPressIn = () => onSelect();

  return (
    <Animated.View
      entering={FadeInDown.duration(450).delay(120 + index * 90)}
      style={[styles.cardWrap, scaleStyle]}
    >
      <Pressable
        onPress={onPressIn}
        android_ripple={{ color: C.surfaceContainer }}
        style={({ pressed }: PressableStateCallbackType) => [
          styles.card,
          pressed && { opacity: 0.96 },
        ]}
      >
        {recommended ? (
          <View style={styles.recommendedPill}>
            <Ionicons name="sparkles" size={11} color={C.onPrimary} />
            <Text style={styles.recommendedText}>Most chosen</Text>
          </View>
        ) : null}

        <View style={styles.cardHeader}>
          <Text style={styles.cardName}>{tier.name}</Text>
          {selected ? (
            <View style={styles.cardCheckWrap}>
              <Ionicons name="checkmark" size={16} color={C.onPrimary} />
            </View>
          ) : (
            <View style={styles.cardCheckWrapEmpty} />
          )}
        </View>

        <Text style={styles.cardTagline}>{tier.tagline}</Text>

        <View style={styles.priceWrap}>
          <Price amountPaise={plan.amount_paise} period={plan.frequency === 'monthly' ? 'month' : 'year'} />
        </View>

        <View style={styles.features}>
          {features.map((feature, i) => (
            <View key={i} style={styles.featureRow}>
              <View style={styles.featureDot}>
                <Ionicons name="checkmark" size={12} color={C.primary} />
              </View>
              <Text style={styles.featureText}>{feature}</Text>
            </View>
          ))}
        </View>
      </Pressable>

      {/* Animated selection ring — sits above the card with pointerEvents=none */}
      <Animated.View pointerEvents="none" style={[styles.cardRing, ringStyle]} />
    </Animated.View>
  );
}

interface TierBExpanderProps {
  expanded: boolean;
  onToggle: () => void;
}

function TierBExpander({ expanded, onToggle }: TierBExpanderProps) {
  const rotation = useSharedValue(expanded ? 1 : 0);
  useEffect(() => {
    rotation.value = withTiming(expanded ? 1 : 0, { duration: 220 });
  }, [expanded, rotation]);

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${interpolate(rotation.value, [0, 1], [0, 90])}deg` }],
  }));

  const collapseStyle = useAnimatedStyle(() => ({
    opacity: rotation.value,
    maxHeight: interpolate(rotation.value, [0, 1], [0, 320], Extrapolation.CLAMP),
  }));

  return (
    <View style={styles.expanderWrap}>
      <Pressable
        onPress={onToggle}
        android_ripple={{ color: 'transparent' }}
        style={styles.expanderTrigger}
      >
        <View style={styles.expanderLeft}>
          <View style={styles.expanderBadge}>
            <Ionicons name="diamond-outline" size={14} color={C.onSecondaryContainer} />
          </View>
          <View>
            <Text style={styles.expanderTitle}>Explore Guardian+</Text>
            <Text style={styles.expanderSub}>More devices, deeper insights</Text>
          </View>
        </View>
        <Animated.View style={chevronStyle}>
          <Ionicons name="chevron-forward" size={20} color={C.onSurfaceVariant} />
        </Animated.View>
      </Pressable>

      <Animated.View style={[styles.expanderBody, collapseStyle]}>
        <View style={styles.expanderDivider} />
        {TIER_B_EXTRAS.map((feat, i) => (
          <View key={i} style={styles.expanderRow}>
            <Ionicons name="add" size={14} color={C.secondary} />
            <Text style={styles.expanderRowText}>{feat}</Text>
          </View>
        ))}
        <Text style={styles.expanderNote}>
          Guardian+ is also available as a yearly plan. Choose it from the toggle above.
        </Text>
      </Animated.View>
    </View>
  );
}

interface StickyCtaProps {
  visible: boolean;
  loading: boolean;
  label: string;
  summary: string;
  disabled?: boolean;
  onPress: () => void;
}

function StickyCta({ visible, loading, label, summary, disabled, onPress }: StickyCtaProps) {
  const insets = useSafeAreaInsets();
  const opacity = useSharedValue(visible ? 1 : 0);
  const translate = useSharedValue(visible ? 0 : 12);

  useEffect(() => {
    opacity.value = withTiming(visible ? 1 : 0, { duration: 220 });
    translate.value = withSpring(visible ? 0 : 12, { damping: 18, stiffness: 220 });
  }, [visible, opacity, translate]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translate.value }],
  }));

  if (!visible && opacity.value === 0) return null;

  return (
    <Animated.View
      pointerEvents={visible ? 'auto' : 'none'}
      style={[
        styles.ctaWrap,
        { paddingBottom: Math.max(insets.bottom, 16) + 12 },
        animStyle,
      ]}
    >
      <View style={styles.ctaGlow} pointerEvents="none" />
      <Text style={styles.ctaSummary}>{summary}</Text>
      <Pressable
        onPress={onPress}
        disabled={disabled || loading}
        android_ripple={{ color: 'rgba(255,255,255,0.15)' }}
        style={({ pressed }) => [
          styles.ctaButton,
          pressed && { transform: [{ scale: 0.985 }] },
          disabled && { opacity: 0.6 },
        ]}
      >
        <LinearGradient
          colors={AuthGradients.primaryButton as unknown as [string, string]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.ctaGradient}
        >
          {loading ? (
            <ActivityIndicator color={C.onPrimary} size="small" />
          ) : (
            <>
              <Text style={styles.ctaText}>{label}</Text>
              <Ionicons name="arrow-forward" size={20} color={C.onPrimary} />
            </>
          )}
        </LinearGradient>
      </Pressable>
      <View style={styles.ctaLegalRow}>
        <Ionicons name="shield-checkmark" size={12} color={C.primary} />
        <Text style={styles.ctaLegal}>Auto-debit from your UPI account. Cancel anytime.</Text>
      </View>
    </Animated.View>
  );
}

export default function PlansScreen() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [frequency, setFrequency] = useState<Frequency>('yearly');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tierBExpanded, setTierBExpanded] = useState(false);

  const userId = useAuthStore((s) => s.userId);
  const refreshSubscription = useSubscriptionStore((s) => s.refresh);
  const trialDaysRemaining = useSubscriptionStore((s) => s.trialDaysRemaining);

  // Load plans.
  useEffect(() => {
    let cancelled = false;
    listPlans()
      .then((p) => {
        if (cancelled) return;
        setPlans(p);
        const yearly = p.filter((x) => x.frequency === 'yearly' && x.tier === 'tier_a');
        const firstYearly = yearly[0] ?? p.find((x) => x.frequency === 'yearly') ?? p[0];
        if (firstYearly) setSelectedId(firstYearly.id);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load plans'))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  // Keep selection valid when toggle changes.
  useEffect(() => {
    const forFreq = plans.filter((x) => x.frequency === frequency);
    const currentSelected = plans.find((x) => x.id === selectedId);
    if (!currentSelected || currentSelected.frequency !== frequency) {
      const first = forFreq[0];
      if (first) setSelectedId(first.id);
    }
  }, [frequency, plans, selectedId]);

  const tierAPlans = useMemo(() => plans.filter((x) => x.tier === 'tier_a'), [plans]);
  const monthlyTierA = tierAPlans.find((p) => p.frequency === 'monthly');
  const yearlyTierA = tierAPlans.find((p) => p.frequency === 'yearly');
  const visiblePlans = useMemo(
    () => plans.filter((x) => x.frequency === frequency && x.tier === 'tier_a'),
    [plans, frequency],
  );
  const selectedPlan = useMemo(() => plans.find((x) => x.id === selectedId) ?? null, [plans, selectedId]);

  const yearlySavingsPct = useMemo(() => {
    if (!monthlyTierA || !yearlyTierA) return 0;
    return computeYearlySavingsPct(monthlyTierA.amount_paise, yearlyTierA.amount_paise);
  }, [monthlyTierA, yearlyTierA]);

  const ctaSummary = selectedPlan
    ? `Continue with ${TIER_LABELS[selectedPlan.tier].name} · ${formatRupeesShort(selectedPlan.amount_paise)}/${selectedPlan.frequency === 'monthly' ? 'mo' : 'yr'}`
    : 'Select a plan to continue';

  const ctaLabel = Platform.OS === 'android' ? 'Continue with UPI AutoPay' : 'Coming soon on iOS';

  const handleSubscribe = async () => {
    if (!selectedPlan || submitting) return;
    if (Platform.OS !== 'android') return;

    setSubmitting(true);
    setError(null);
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
        router.replace('/(tabs)/home');
      } else {
        setError(result.error ?? 'The subscription could not be completed. Please try again.');
        refreshSubscription().catch(() => {});
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
      logger.warn('paywall', 'subscribe failed', { message: e instanceof Error ? e.message : 'unknown' });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.root, styles.center]} edges={['top', 'bottom']}>
        <ActivityIndicator color={C.primary} size="large" />
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces
      >
        {/* HERO */}
        <Animated.View entering={FadeInDown.duration(500)} style={styles.hero}>
          <Text style={styles.eyebrow}>Sync Guardian</Text>
          <Text style={styles.title}>Protect your family&apos;s attention.</Text>
          <Text style={styles.subtitle}>
            Real-time notification monitoring, with the convenience of UPI AutoPay.
          </Text>
        </Animated.View>

        {/* TRIAL RIBBON */}
        {trialDaysRemaining != null && trialDaysRemaining > 0 ? (
          <Animated.View entering={FadeInDown.duration(450).delay(60)}>
            <TrialRibbon daysRemaining={trialDaysRemaining} />
          </Animated.View>
        ) : null}

        {/* FREQUENCY TOGGLE */}
        <Animated.View entering={FadeInDown.duration(450).delay(80)} style={styles.toggleWrap}>
          <FrequencyToggle value={frequency} onChange={setFrequency} savingsPct={yearlySavingsPct} />
        </Animated.View>

        {/* PLAN CARDS */}
        <View style={styles.cardsWrap}>
          {visiblePlans.map((plan, i) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              selected={selectedId === plan.id}
              onSelect={() => setSelectedId(plan.id)}
              index={i}
              recommended={plan.tier === 'tier_a' && plan.frequency === 'yearly'}
            />
          ))}
        </View>

        {/* TIER B EXPANDER */}
        <Animated.View entering={FadeInDown.duration(450).delay(280)}>
          <TierBExpander
            expanded={tierBExpanded}
            onToggle={() => setTierBExpanded((v) => !v)}
          />
        </Animated.View>

        {/* iOS placeholder */}
        {Platform.OS !== 'android' ? (
          <Animated.View entering={FadeInDown.duration(450).delay(340)} style={styles.iosNotice}>
            <Ionicons name="phone-portrait-outline" size={18} color={C.onSurfaceVariant} />
            <Text style={styles.iosNoticeText}>
              UPI AutoPay is currently Android-only. Please subscribe from an Android device.
            </Text>
          </Animated.View>
        ) : null}

        {/* ERROR */}
        {error ? (
          <Animated.View entering={FadeInDown.duration(280)} style={styles.errorBox}>
            <Ionicons name="alert-circle-outline" size={16} color={C.error} />
            <Text style={styles.errorText}>{error}</Text>
          </Animated.View>
        ) : null}

        <View style={styles.scrollSpacer} />
      </ScrollView>

      <StickyCta
        visible={!!selectedPlan}
        loading={submitting}
        label={Platform.OS === 'android' ? ctaLabel : 'Coming soon on iOS'}
        summary={ctaSummary}
        disabled={!selectedPlan || Platform.OS !== 'android'}
        onPress={handleSubscribe}
      />
    </View>
  );
}

function formatRupeesShort(amountPaise: number): string {
  const rupees = Math.floor(amountPaise / 100);
  return `₹${rupees}`;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.surface,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 200,
  },
  scrollSpacer: {
    height: 8,
  },
  hero: {
    marginBottom: 20,
    gap: 8,
  },
  eyebrow: {
    ...AuthFonts.labelSmall,
    color: C.secondary,
    textTransform: 'uppercase',
    letterSpacing: 2,
    fontWeight: '700',
  },
  title: {
    fontFamily: 'PlusJakartaSans-ExtraBold',
    fontSize: 30,
    lineHeight: 36,
    color: C.onSurface,
    letterSpacing: -0.8,
  },
  subtitle: {
    ...AuthFonts.bodyMedium,
    color: C.onSurfaceVariant,
    lineHeight: 20,
  },

  // Toggle
  toggleWrap: {
    marginTop: 8,
    marginBottom: 22,
  },
  toggle: {
    flexDirection: 'row',
    backgroundColor: C.surfaceContainer,
    borderRadius: R.full,
    padding: 5,
    position: 'relative',
  },
  toggleIndicator: {
    position: 'absolute',
    top: 5,
    bottom: 5,
    left: 5,
    backgroundColor: C.primary,
    borderRadius: R.full,
    // width set inline
  },
  toggleOption: {
    flex: 1,
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: R.full,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    zIndex: 1,
  },
  toggleLabel: {
    ...AuthFonts.labelLarge,
    color: C.onSurfaceVariant,
    fontWeight: '600',
  },
  toggleLabelActive: {
    color: C.onPrimary,
  },
  savePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: R.full,
    backgroundColor: C.secondaryContainer,
  },
  savePillActive: {
    backgroundColor: C.secondary,
  },
  savePillText: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 10,
    color: C.onSecondaryContainer,
    letterSpacing: 0.3,
  },
  savePillTextActive: {
    color: C.onSecondary,
  },

  // Cards
  cardsWrap: {
    gap: 18,
  },
  cardWrap: {
    position: 'relative',
  },
  card: {
    backgroundColor: C.surfaceContainerLowest,
    borderRadius: R.xl,
    padding: 22,
    overflow: 'hidden',
  },
  cardRing: {
    position: 'absolute',
    top: -2,
    left: -2,
    right: -2,
    bottom: -2,
    borderRadius: R.xl + 2,
    borderWidth: 2,
    borderColor: C.primary,
    shadowColor: C.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 4,
  },
  recommendedPill: {
    position: 'absolute',
    top: 14,
    right: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: R.full,
    backgroundColor: C.primary,
  },
  recommendedText: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 10,
    color: C.onPrimary,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  cardName: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 22,
    color: C.onSurface,
    letterSpacing: -0.3,
  },
  cardCheckWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: C.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardCheckWrapEmpty: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  cardTagline: {
    ...AuthFonts.bodySmall,
    color: C.onSurfaceVariant,
    marginBottom: 14,
    lineHeight: 18,
  },
  priceWrap: {
    marginBottom: 18,
  },
  features: {
    gap: 10,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  featureDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: C.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureText: {
    ...AuthFonts.bodySmall,
    color: C.onSurface,
    lineHeight: 18,
    flex: 1,
  },

  // Tier B expander
  expanderWrap: {
    marginTop: 24,
    backgroundColor: C.surfaceContainerLow,
    borderRadius: R.lg,
    paddingHorizontal: 16,
    overflow: 'hidden',
  },
  expanderTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
  },
  expanderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  expanderBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: C.secondaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  expanderTitle: {
    ...AuthFonts.titleSmall,
    color: C.onSurface,
  },
  expanderSub: {
    ...AuthFonts.labelMedium,
    color: C.onSurfaceVariant,
    marginTop: 2,
  },
  expanderBody: {
    paddingBottom: 18,
    gap: 8,
  },
  expanderDivider: {
    height: 1,
    backgroundColor: C.surfaceContainerHigh,
    marginBottom: 12,
  },
  expanderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  expanderRowText: {
    ...AuthFonts.bodySmall,
    color: C.onSurface,
    flex: 1,
  },
  expanderNote: {
    ...AuthFonts.labelMedium,
    color: C.onSurfaceVariant,
    marginTop: 8,
    lineHeight: 16,
  },

  // iOS notice
  iosNotice: {
    marginTop: 20,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: C.surfaceContainer,
    borderRadius: R.md,
    padding: 14,
  },
  iosNoticeText: {
    flex: 1,
    ...AuthFonts.labelMedium,
    color: C.onSurfaceVariant,
    lineHeight: 17,
  },

  // Error
  errorBox: {
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
    ...AuthFonts.labelMedium,
    color: C.onErrorContainer,
    flex: 1,
  },

  // CTA
  ctaWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 24,
    paddingTop: 20,
    backgroundColor: C.surface,
  },
  ctaGlow: {
    position: 'absolute',
    top: -28,
    left: 0,
    right: 0,
    height: 28,
    backgroundColor: C.surface,
  },
  ctaSummary: {
    ...AuthFonts.labelLarge,
    color: C.onSurface,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 10,
  },
  ctaButton: {
    borderRadius: R.full,
    overflow: 'hidden',
    shadowColor: C.primary,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.22,
    shadowRadius: 24,
    elevation: 10,
  },
  ctaGradient: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 24,
  },
  ctaText: {
    ...AuthFonts.titleMedium,
    color: C.onPrimary,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
  ctaLegalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 10,
  },
  ctaLegal: {
    fontFamily: 'Manrope-Regular',
    fontSize: 11,
    color: C.onSurfaceVariant,
    letterSpacing: 0.1,
  },
});