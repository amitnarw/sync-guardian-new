import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  Easing,
  FadeInDown,
  useAnimatedStyle,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import {
  AuthColors as C,
  AuthFonts,
  AuthRadius as R,
} from '@/constants/auth-theme';
import { useAuthStore } from '@/hooks/use-auth-store';
import { useSubscriptionStore } from '@/hooks/use-subscription-store';
import { useAppModal } from '@/hooks/use-app-modal';
import {
  cancelSubscription,
  formatPaise,
  listPlans,
  type Plan,
} from '@/services/subscription-api';

type ManageOrigin = 'settings' | 'plans' | undefined;

const FEATURES_BY_TIER: Record<'tier_a' | 'tier_b', { title: string; sub: string }[]> = {
  tier_a: [
    { title: 'Real-time mirror', sub: 'Notifications appear instantly on your device.' },
    { title: '30-day history', sub: 'Scroll through every mirror, last 30 days.' },
    { title: 'Cancel anytime', sub: 'UPI AutoPay pauses with a single tap.' },
  ],
  tier_b: [
    { title: 'Up to 4 devices', sub: 'Monitor every child in your household.' },
    { title: 'Priority push', sub: 'Lower-latency delivery during quiet hours.' },
    { title: 'Granular controls', sub: 'Per-app filtering and quiet windows.' },
  ],
};

export default function ManageSubscriptionScreen() {
  const { from } = useLocalSearchParams<{ from?: string }>();
  const origin: ManageOrigin = from === 'settings' ? 'settings' : 'plans';

  const { subscription, reason, trialDaysRemaining, refresh, loading } = useSubscriptionStore();
  const { showModal } = useAppModal();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [cancelling, setCancelling] = useState(false);

  // Defense-in-depth: children never see billing screens. Their access is
  // managed by the paired parent and surfaced on the child home screen.
  const userRole = useAuthStore((s) => s.userRole);
  useEffect(() => {
    if (userRole === 'child') {
      router.replace('/(child)/home');
    }
  }, [userRole]);

  useEffect(() => {
    listPlans().then(setPlans).catch(() => undefined);
  }, []);

  const activePlan = plans.find((p) => p.id === subscription?.plan_id) ?? null;

  const handleCancel = () => {
    showModal({
      title: 'Cancel subscription?',
      message: 'Your access will end at the end of the current billing period. You can resubscribe anytime.',
      icon: 'warning',
      primaryButton: 'Cancel subscription',
      primaryVariant: 'destructive',
      onPrimaryPress: async () => {
        setCancelling(true);
        try {
          await cancelSubscription();
          await refresh();
          showModal({
            title: 'Subscription cancelled',
            message: 'Your subscription has been cancelled.',
            icon: 'success',
          });
        } catch (e) {
          showModal({
            title: 'Could not cancel',
            message: e instanceof Error ? e.message : 'Please try again.',
            icon: 'error',
          });
        } finally {
          setCancelling(false);
        }
      },
    });
  };

  const handleChangePlan = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    router.push('/(paywall)/plans');
  };

  const handleClose = () => {
    if (origin === 'settings') {
      if (router.canGoBack()) router.back();
      else router.replace('/(tabs)/home');
    } else {
      router.replace('/(tabs)/home');
    }
  };

  const formatDate = (iso: string | null) => {
    if (!iso) return ', ';
    return new Date(iso).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const trialActive = reason === 'trial' && trialDaysRemaining != null && trialDaysRemaining > 0;

  if (loading && !subscription && !trialActive) {
    return (
      <SafeAreaView style={[s.root, s.center]} edges={['top', 'bottom']}>
        <ActivityIndicator color={C.primary} size="large" />
      </SafeAreaView>
    );
  }

  const features = activePlan ? FEATURES_BY_TIER[activePlan.tier] ?? [] : [];

  return (
    <SafeAreaView style={s.root} edges={['top', 'bottom']}>
      <AppBar origin={origin} onClose={handleClose} />

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeInDown.duration(500)} style={s.heroSection}>
          <Text style={s.heroEyebrow}>Subscription</Text>
          <Text style={s.heroTitle}>
            Manage Your{'\n'}
            <Text style={s.heroTitleAccent}>Journey</Text>
          </Text>
          <Text style={s.heroSubtitle}>
            Review your current plan, explore benefits, and update your billing preferences in one
            mindful space.
          </Text>
        </Animated.View>

        {trialActive ? (
          <Animated.View
            entering={FadeInDown.duration(450).delay(40)}
            style={s.heroBlob}
            pointerEvents="none"
          />
        ) : null}

        {subscription ? (
          <>
            <Animated.View entering={FadeInDown.duration(500).delay(80)} style={s.card}>
              <View style={s.cardBlob} pointerEvents="none" />
              <Animated.View entering={FadeInDown.duration(500).delay(150)}>
                <View style={s.cardHeader}>
                  <View style={s.cardIconWrap}>
                    <Ionicons name="sparkles" size={24} color={C.primary} />
                  </View>
                  <View style={s.cardHeaderText}>
                    <View style={s.premiumBadge}>
                      <Text style={s.premiumBadgeText}>Premium</Text>
                    </View>
                    <Text style={s.planName}>
                      {activePlan?.name ?? subscription.plan_id} Plan
                    </Text>
                  </View>
                </View>
              </Animated.View>

              <Animated.View entering={FadeInDown.duration(500).delay(220)}>
                <View style={s.priceRow}>
                  <Text style={s.priceValue}>
                    {activePlan ? formatPaise(activePlan.amount_paise) : ', '}
                  </Text>
                  <Text style={s.priceUnit}>
                    /{activePlan?.frequency === 'monthly' ? 'mo' : 'yr'}
                  </Text>
                </View>
                <View style={s.renewalRow}>
                  <Ionicons name="calendar-outline" size={16} color={C.onSurfaceVariant} />
                  <Text style={s.renewalText}>
                    {subscription.next_charge_at
                      ? `Renews on ${formatDate(subscription.next_charge_at)}`
                      : subscription.current_cycle_end
                        ? `Current period ends ${formatDate(subscription.current_cycle_end)}`
                        : 'Auto-debit scheduled'}
                  </Text>
                </View>
              </Animated.View>

              {features.length > 0 ? (
                <Animated.View
                  entering={FadeInDown.duration(500).delay(300)}
                  style={s.benefitsSection}
                >
                  <Text style={s.benefitsHeading}>Active Benefits</Text>
                  {features.map((f, i) => (
                    <View key={`${activePlan?.id}-${i}`} style={s.benefitRow}>
                      <View style={s.benefitIcon}>
                        <Ionicons name="checkmark" size={14} color={C.primary} />
                      </View>
                      <View style={s.benefitText}>
                        <Text style={s.benefitTitle}>{f.title}</Text>
                        <Text style={s.benefitSub}>{f.sub}</Text>
                      </View>
                    </View>
                  ))}
                </Animated.View>
              ) : null}

              <View style={s.actionStack}>
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
                      () => undefined,
                    );
                    handleChangePlan();
                  }}
                  style={({ pressed }) => [
                    s.primaryBtn,
                    pressed && { transform: [{ scale: 0.97 }] },
                  ]}
                >
                  <Text style={s.primaryBtnText}>Change Plan</Text>
                  <Ionicons name="arrow-forward" size={16} color={C.onPrimary} />
                </Pressable>

                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
                      () => undefined,
                    );
                    handleClose();
                  }}
                  style={({ pressed }) => [
                    s.secondaryBtn,
                    pressed && { transform: [{ scale: 0.97 }] },
                  ]}
                >
                  <Text style={s.secondaryBtnText}>View Billing History</Text>
                </Pressable>

                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
                      () => undefined,
                    );
                    handleCancel();
                  }}
                  disabled={cancelling}
                  style={({ pressed }) => [
                    s.cancelBtn,
                    pressed && { opacity: 0.7 },
                    cancelling && { opacity: 0.5 },
                  ]}
                >
                  <Text style={s.cancelBtnText}>Cancel Subscription</Text>
                </Pressable>
              </View>
            </Animated.View>

            {trialActive ? (
              <Animated.View
                entering={FadeInDown.duration(450).delay(120)}
                style={s.trialRibbon}
              >
                <Ionicons name="hourglass-outline" size={18} color={C.onTertiaryContainer} />
                <Text style={s.trialRibbonText}>
                  {trialDaysRemaining} {trialDaysRemaining === 1 ? 'day' : 'days'} left in your
                  free trial
                </Text>
              </Animated.View>
            ) : null}
          </>
        ) : (
          <Animated.View entering={FadeInDown.duration(450)} style={s.emptyWrap}>
            <View style={s.emptyIconWrap}>
              <Ionicons name="card-outline" size={28} color={C.onSurfaceVariant} />
            </View>
            <Text style={s.emptyTitle}>
              {trialActive ? 'You are on a free trial' : 'No active subscription'}
            </Text>
            <Text style={s.emptyText}>
              {trialActive
                ? `You have ${trialDaysRemaining ?? 0} day${trialDaysRemaining === 1 ? '' : 's'} left. Subscribe to keep monitoring uninterrupted.`
                : 'Choose a plan to keep your monitoring running.'}
            </Text>
            <TouchableOpacity
              onPress={() => router.push('/(paywall)/plans')}
              activeOpacity={0.85}
              style={s.emptyCta}
            >
              <Text style={s.emptyCtaText}>
                {trialActive ? 'View Plans' : 'View Plans'}
              </Text>
              <Ionicons name="arrow-forward" size={16} color={C.onPrimary} />
            </TouchableOpacity>
          </Animated.View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function AppBar({ origin, onClose }: { origin: ManageOrigin; onClose: () => void }) {
  const showBack = origin === 'settings';
  return (
    <View style={s.appBar}>
      {showBack ? (
        <TouchableOpacity onPress={onClose} hitSlop={10} style={s.appBarButton}>
          <Ionicons name="chevron-back" size={22} color={C.onSurface} />
        </TouchableOpacity>
      ) : (
        <View style={s.appBarButtonSpacer} />
      )}
      <Text style={s.appBarTitle}>Nurturing Atelier</Text>
      {showBack ? (
        <View style={s.appBarButtonSpacer} />
      ) : (
        <TouchableOpacity onPress={onClose} hitSlop={6} style={s.appBarPill}>
          <Text style={s.appBarPillText}>Done</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.surface },
  center: { alignItems: 'center', justifyContent: 'center' },

  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? 14 : 6,
    paddingBottom: 12,
  },
  appBarTitle: {
    ...AuthFonts.titleMedium,
    color: C.onSurface,
    fontWeight: '700',
  },
  appBarButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appBarButtonSpacer: { width: 40, height: 40 },
  appBarPill: {
    minWidth: 40,
    height: 40,
    paddingHorizontal: 14,
    borderRadius: R.full,
    backgroundColor: C.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appBarPillText: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 13,
    color: C.onPrimaryContainer,
    letterSpacing: 0.2,
  },

  content: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 32,
  },

  heroSection: { marginBottom: 24, gap: 8, paddingTop: 8 },
  heroEyebrow: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 12,
    color: C.secondary,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  heroTitle: {
    fontFamily: 'PlusJakartaSans-ExtraBold',
    fontSize: 52,
    lineHeight: 56,
    color: C.onBackground,
    letterSpacing: -1.6,
  },
  heroTitleAccent: {
    fontFamily: 'PlusJakartaSans-Light',
    fontStyle: 'italic',
    color: C.primary,
    fontSize: 52,
    letterSpacing: -1,
  },
  heroSubtitle: {
    ...AuthFonts.bodyMedium,
    fontSize: 16,
    lineHeight: 24,
    color: C.onSurfaceVariant,
    marginTop: 4,
    maxWidth: 320,
  },

  heroBlob: {
    position: 'absolute',
    top: 110,
    right: -80,
    width: 240,
    height: 240,
    borderRadius: 96,
    backgroundColor: C.primaryContainer,
    opacity: 0.2,
  },

  card: {
    backgroundColor: C.surfaceContainerLowest,
    borderRadius: 32,
    padding: 28,
    marginBottom: 24,
    overflow: 'hidden',
    shadowColor: '#363228',
    shadowOffset: { width: 0, height: 32 },
    shadowOpacity: 0.06,
    shadowRadius: 64,
    elevation: 4,
  },
  cardBlob: {
    position: 'absolute',
    top: -64,
    left: -64,
    width: 128,
    height: 128,
    borderRadius: 64,
    backgroundColor: C.primaryContainer,
    opacity: 0.3,
  },

  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 24,
  },
  cardIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: C.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardHeaderText: { flex: 1, gap: 4 },
  premiumBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: R.full,
    backgroundColor: C.surfaceContainer,
  },
  premiumBadgeText: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 11,
    color: C.primary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  planName: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 22,
    color: C.onBackground,
    letterSpacing: -0.3,
  },

  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    marginBottom: 8,
  },
  priceValue: {
    fontFamily: 'PlusJakartaSans-ExtraBold',
    fontSize: 36,
    color: C.onBackground,
    letterSpacing: -0.6,
    fontVariant: ['tabular-nums'],
  },
  priceUnit: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 18,
    color: C.onSurfaceVariant,
  },

  renewalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 24,
  },
  renewalText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 14,
    color: C.onSurfaceVariant,
  },

  benefitsSection: { marginBottom: 24 },
  benefitsHeading: {
    fontFamily: 'PlusJakartaSans-SemiBold',
    fontSize: 13,
    color: C.onBackground,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 12,
  },
  benefitIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(72,103,48,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  benefitText: { flex: 1 },
  benefitTitle: {
    fontFamily: 'PlusJakartaSans-SemiBold',
    fontSize: 15,
    color: C.onBackground,
    marginBottom: 2,
  },
  benefitSub: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 13,
    color: C.onSurfaceVariant,
    lineHeight: 18,
  },

  actionStack: { gap: 12, marginTop: 8 },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: R.full,
    backgroundColor: C.primary,
    shadowColor: '#363228',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 16,
    elevation: 2,
  },
  primaryBtnText: {
    fontFamily: 'PlusJakartaSans-SemiBold',
    fontSize: 14,
    color: C.onPrimary,
    letterSpacing: 0.1,
  },
  secondaryBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: R.full,
    backgroundColor: C.surfaceContainerHigh,
  },
  secondaryBtnText: {
    fontFamily: 'PlusJakartaSans-SemiBold',
    fontSize: 14,
    color: C.onSurface,
    letterSpacing: 0.1,
  },
  cancelBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
  },
  cancelBtnText: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 11,
    color: C.onSurfaceVariant,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },

  trialRibbon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: C.tertiaryContainer,
    borderRadius: R.full,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  trialRibbonText: {
    ...AuthFonts.labelLarge,
    color: C.onTertiaryContainer,
  },

  emptyWrap: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 40,
    paddingHorizontal: 24,
  },
  emptyIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: C.surfaceContainer,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  emptyTitle: {
    ...AuthFonts.titleMedium,
    color: C.onSurface,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptyText: {
    ...AuthFonts.bodyMedium,
    color: C.onSurfaceVariant,
    textAlign: 'center',
    lineHeight: 20,
  },
  emptyCta: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: R.full,
    backgroundColor: C.primary,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  emptyCtaText: {
    ...AuthFonts.titleSmall,
    color: C.onPrimary,
    fontWeight: '700',
  },
});

void Easing;
void useAnimatedStyle;
void withRepeat;
void withTiming;
