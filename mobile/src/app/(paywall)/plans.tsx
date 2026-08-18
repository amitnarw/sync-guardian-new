import React, { useEffect, useMemo, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Platform,
  PressableStateCallbackType,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { AuthColors as C, AuthRadius as R, AuthGradients } from '@/constants/auth-theme';
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

const TIER_B_FEATURES = [
  'Up to 4 paired child devices',
  'Priority push delivery',
  '90-day activity history',
  'Per-app granular controls',
  'Early access to new insights',
  'Priority support',
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
  return (
    <View style={styles.toggleWrap}>
      {(['monthly', 'yearly'] as Frequency[]).map((freq) => {
        const active = value === freq;
        return (
          <Pressable
            key={freq}
            onPress={() => onChange(freq)}
            style={[styles.toggleOption, active && styles.toggleOptionActive]}
          >
            <Text style={[styles.toggleLabel, active && styles.toggleLabelActive]}>
              {freq === 'monthly' ? 'Monthly' : 'Yearly'}
            </Text>
            {freq === 'yearly' && savingsPct > 0 && (
              <View style={[styles.savingsPill, active && styles.savingsPillActive]}>
                <Text style={[styles.savingsPillText, active && styles.savingsPillTextActive]}>
                  Save {savingsPct}%
                </Text>
              </View>
            )}
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
  isRecommended?: boolean;
}

function PlanCard({ plan, selected, onSelect, index, isRecommended }: PlanCardProps) {
  const tier = TIER_LABELS[plan.tier];
  const features = plan.tier === 'tier_a' ? TIER_A_FEATURES : TIER_B_FEATURES;

  return (
    <Animated.View entering={FadeInDown.duration(450).delay(120 + index * 80)}>
      <Pressable
        onPress={onSelect}
        style={({ pressed }: PressableStateCallbackType) => [
          styles.planCard,
          pressed && { opacity: 0.96 },
          selected && styles.planCardSelected,
        ]}
      >
        {isRecommended && (
          <View style={styles.recommendedBadge}>
            <Ionicons name="sparkles" size={12} color={C.onPrimary} />
            <Text style={styles.recommendedBadgeText}>Recommended</Text>
          </View>
        )}

        <View style={styles.planHeader}>
          <View style={styles.planTitleRow}>
            <Text style={styles.planName}>{tier.name}</Text>
            <View style={[styles.radioOuter, selected && styles.radioOuterActive]}>
              {selected && <View style={styles.radioInner} />}
            </View>
          </View>
          <Text style={styles.planTagline}>{tier.tagline}</Text>
        </View>

        <View style={styles.priceRow}>
          <Price amountPaise={plan.amount_paise} period={plan.frequency === 'monthly' ? 'month' : 'year'} />
        </View>

        <View style={styles.featureList}>
          {features.map((feat, i) => (
            <View key={i} style={styles.featureRow}>
              <Ionicons name="checkmark-circle" size={16} color={C.primary} />
              <Text style={styles.featureText}>{feat}</Text>
            </View>
          ))}
        </View>
      </Pressable>
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

  const userId = useAuthStore((s) => s.userId);
  const refreshSubscription = useSubscriptionStore((s) => s.refresh);
  const trialDaysRemaining = useSubscriptionStore((s) => s.trialDaysRemaining);

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
    return () => { cancelled = true; };
  }, []);

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
    () => plans.filter((x) => x.frequency === frequency),
    [plans, frequency],
  );
  const selectedPlan = useMemo(() => plans.find((x) => x.id === selectedId) ?? null, [plans, selectedId]);

  const yearlySavingsPct = useMemo(() => {
    if (!monthlyTierA || !yearlyTierA) return 0;
    return computeYearlySavingsPct(monthlyTierA.amount_paise, yearlyTierA.amount_paise);
  }, [monthlyTierA, yearlyTierA]);

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
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Back button */}
        {router.canGoBack() && (
          <TouchableOpacity onPress={() => router.back()} hitSlop={10} style={styles.backButton}>
            <Ionicons name="chevron-back" size={24} color={C.onSurface} />
          </TouchableOpacity>
        )}

        {/* Hero */}
        <Animated.View entering={FadeInDown.duration(500)} style={styles.hero}>
          <Text style={styles.eyebrow}>Sync Guardian</Text>
          <Text style={styles.title}>Choose your plan</Text>
          <Text style={styles.subtitle}>
            Real-time notification monitoring with UPI AutoPay. Cancel anytime.
          </Text>
        </Animated.View>

        {/* Trial ribbon */}
        {trialDaysRemaining != null && trialDaysRemaining > 0 && (
          <Animated.View entering={FadeInDown.duration(450).delay(60)}>
            <TrialRibbon daysRemaining={trialDaysRemaining} />
          </Animated.View>
        )}

        {/* Frequency toggle */}
        <Animated.View entering={FadeInDown.duration(450).delay(80)}>
          <FrequencyToggle value={frequency} onChange={setFrequency} savingsPct={yearlySavingsPct} />
        </Animated.View>

        {/* Plan cards */}
        <View style={styles.cardsContainer}>
          {visiblePlans.map((plan, i) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              selected={selectedId === plan.id}
              onSelect={() => setSelectedId(plan.id)}
              index={i}
              isRecommended={plan.tier === 'tier_a' && plan.frequency === 'yearly'}
            />
          ))}
        </View>

        {/* Error */}
        {error && (
          <Animated.View entering={FadeInDown.duration(280)} style={styles.errorBox}>
            <Ionicons name="alert-circle-outline" size={16} color={C.error} />
            <Text style={styles.errorText}>{error}</Text>
          </Animated.View>
        )}

        {/* CTA */}
        {selectedPlan && (
          <Animated.View entering={FadeInDown.duration(300).delay(350)}>
            <Pressable
              onPress={handleSubscribe}
              disabled={submitting || Platform.OS !== 'android'}
              style={({ pressed }) => [
                styles.ctaButton,
                pressed && { transform: [{ scale: 0.985 }] },
                (submitting || Platform.OS !== 'android') && { opacity: 0.6 },
              ]}
            >
              <LinearGradient
                colors={AuthGradients.primaryButton as unknown as [string, string]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.ctaGradient}
              >
                {submitting ? (
                  <ActivityIndicator color={C.onPrimary} size="small" />
                ) : (
                  <>
                    <Text style={styles.ctaText}>
                      {Platform.OS === 'android'
                        ? `Continue with UPI AutoPay`
                        : 'Coming soon on iOS'}
                    </Text>
                    {Platform.OS === 'android' && <Ionicons name="arrow-forward" size={18} color={C.onPrimary} />}
                  </>
                )}
              </LinearGradient>
            </Pressable>

            <View style={styles.ctaLegalRow}>
              <Ionicons name="shield-checkmark" size={12} color={C.primary} />
              <Text style={styles.ctaLegal}>Auto-debit from your UPI account. Cancel anytime.</Text>
            </View>
          </Animated.View>
        )}

        {/* iOS notice */}
        {Platform.OS !== 'android' && (
          <Animated.View entering={FadeInDown.duration(450).delay(340)} style={styles.iosNotice}>
            <Ionicons name="phone-portrait-outline" size={16} color={C.onSurfaceVariant} />
            <Text style={styles.iosNoticeText}>
              UPI AutoPay is currently Android-only. Subscribe from an Android device.
            </Text>
          </Animated.View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.surface },
  center: { alignItems: 'center', justifyContent: 'center' },
  scrollContent: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 120 },
  backButton: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },

  hero: { marginBottom: 20, gap: 6 },
  eyebrow: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 11,
    color: C.secondary,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  title: {
    fontFamily: 'PlusJakartaSans-ExtraBold',
    fontSize: 30,
    lineHeight: 36,
    color: C.onSurface,
    letterSpacing: -0.8,
  },
  subtitle: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 15,
    lineHeight: 22,
    color: C.onSurfaceVariant,
  },

  /* Toggle */
  toggleWrap: {
    flexDirection: 'row',
    backgroundColor: C.surfaceContainer,
    borderRadius: R.full,
    padding: 4,
    marginBottom: 24,
  },
  toggleOption: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: R.full,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  toggleOptionActive: { backgroundColor: C.primary },
  toggleLabel: {
    fontFamily: 'PlusJakartaSans-SemiBold',
    fontSize: 14,
    color: C.onSurfaceVariant,
  },
  toggleLabelActive: { color: C.onPrimary },
  savingsPill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: R.full,
    backgroundColor: C.secondaryContainer,
  },
  savingsPillActive: { backgroundColor: C.secondary },
  savingsPillText: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 10,
    color: C.onSecondaryContainer,
  },
  savingsPillTextActive: { color: C.onSecondary },

  /* Plan cards */
  cardsContainer: { gap: 16, marginBottom: 24 },
  planCard: {
    backgroundColor: C.surfaceContainerLowest,
    borderRadius: R.xl,
    padding: 22,
    borderWidth: 2,
    borderColor: 'transparent',
    shadowColor: '#363228',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 16,
    elevation: 2,
    position: 'relative',
  },
  planCardSelected: {
    borderColor: C.primary,
    shadowColor: C.primary,
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 4,
  },
  recommendedBadge: {
    position: 'absolute',
    top: 14,
    right: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: C.primary,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: R.full,
  },
  recommendedBadgeText: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 10,
    color: C.onPrimary,
    letterSpacing: 0.4,
  },
  planHeader: { marginBottom: 14 },
  planTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  planName: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 22,
    color: C.onSurface,
    letterSpacing: -0.3,
  },
  radioOuter: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: C.outlineVariant,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOuterActive: { borderColor: C.primary },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: C.primary,
  },
  planTagline: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 13,
    color: C.onSurfaceVariant,
    lineHeight: 18,
  },
  priceRow: { marginBottom: 16 },
  featureList: { gap: 8 },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  featureText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 13,
    color: C.onSurface,
    lineHeight: 18,
    flex: 1,
  },

  /* CTA */
  ctaButton: {
    borderRadius: R.full,
    overflow: 'hidden',
    shadowColor: C.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 8,
  },
  ctaGradient: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 24,
  },
  ctaText: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 15,
    color: C.onPrimary,
    letterSpacing: 0.1,
  },
  ctaLegalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 12,
  },
  ctaLegal: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 11,
    color: C.onSurfaceVariant,
  },

  /* Error */
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
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 13,
    color: C.onErrorContainer,
    flex: 1,
  },

  /* iOS */
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
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 13,
    color: C.onSurfaceVariant,
    lineHeight: 18,
  },
});
