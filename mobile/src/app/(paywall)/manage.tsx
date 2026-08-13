import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text, ActivityIndicator, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { AuthColors as C, AuthFonts, AuthRadius as R } from '@/constants/auth-theme';
import { useSubscriptionStore } from '@/hooks/use-subscription-store';
import { useAppModal } from '@/hooks/use-app-modal';
import { cancelSubscription, listPlans, formatPaise, type Plan } from '@/services/subscription-api';

type ManageOrigin = 'settings' | 'plans' | undefined;

export default function ManageSubscriptionScreen() {
  const { from } = useLocalSearchParams<{ from?: string }>();
  const origin: ManageOrigin = from === 'settings' ? 'settings' : 'plans';

  const { subscription, reason, trialDaysRemaining, refresh, loading } = useSubscriptionStore();
  const { showModal } = useAppModal();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    listPlans().then(setPlans).catch(() => {});
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

  const handleClose = () => {
    if (origin === 'settings') {
      if (router.canGoBack()) router.back();
      else router.replace('/(tabs)/home');
    } else {
      router.replace('/(tabs)/home');
    }
  };

  const formatDate = (iso: string | null) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  if (loading && !subscription) {
    return (
      <View style={[s.container, s.center]}>
        <ActivityIndicator color={C.primary} size="large" />
      </View>
    );
  }

  const statusLabel: Record<string, string> = {
    pending: 'Pending',
    active: 'Active',
    paused: 'Paused',
    expired: 'Expired',
    cancelled: 'Cancelled',
    revoked: 'Cancelled',
  };

  const headerTitle = subscription ? 'Manage subscription' : 'Subscription';

  return (
    <View style={s.container}>
      {/* CONTEXTUAL HEADER */}
      <View style={s.header}>
        {origin === 'settings' ? (
          <TouchableOpacity onPress={handleClose} style={s.headerButton} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back">
            <Ionicons name="chevron-back" size={24} color={C.onSurface} />
          </TouchableOpacity>
        ) : (
          <View style={s.headerSpacer} />
        )}
        <Text style={s.headerTitle}>{headerTitle}</Text>
        {origin !== 'settings' ? (
          <TouchableOpacity onPress={handleClose} style={s.headerPill} hitSlop={6} accessibilityRole="button" accessibilityLabel="Done">
            <Text style={s.headerPillText}>Done</Text>
          </TouchableOpacity>
        ) : (
          <View style={s.headerSpacer} />
        )}
      </View>

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        {reason === 'trial' && trialDaysRemaining != null && trialDaysRemaining > 0 ? (
          <Animated.View entering={FadeInDown.duration(400)} style={s.trialBanner}>
            <Ionicons name="hourglass-outline" size={18} color={C.onTertiaryContainer} />
            <Text style={s.trialBannerText}>
              {trialDaysRemaining} {trialDaysRemaining === 1 ? 'day' : 'days'} left in your free trial
            </Text>
          </Animated.View>
        ) : null}

        {subscription ? (
          <>
            <Animated.View entering={FadeInDown.duration(400).delay(60)} style={s.card}>
              <View style={s.cardHeader}>
                <Text style={s.cardLabel}>Current plan</Text>
                <View style={[s.statusPill, { backgroundColor: subscription.status === 'active' ? C.primaryContainer : C.surfaceContainer }]}>
                  <Text style={[s.statusText, { color: subscription.status === 'active' ? C.onPrimaryContainer : C.onSurfaceVariant }]}>
                    {statusLabel[subscription.status] ?? subscription.status}
                  </Text>
                </View>
              </View>

              <Text style={s.planName}>{activePlan?.name ?? subscription.plan_id}</Text>
              {activePlan ? (
                <Text style={s.planPriceRow}>
                  <Text style={s.planPrice}>{formatPaise(activePlan.amount_paise)}</Text>
                  <Text style={s.planPeriod}>  ·  per {activePlan.frequency === 'monthly' ? 'month' : 'year'}</Text>
                </Text>
              ) : null}

              <View style={s.divider} />

              <DetailRow label="Next charge" value={formatDate(subscription.next_charge_at)} />
              <DetailRow label="Current period ends" value={formatDate(subscription.current_cycle_end)} />
              <DetailRow
                label="Last charged"
                value={subscription.last_charge_amount_paise ? formatPaise(subscription.last_charge_amount_paise) : '—'}
              />
            </Animated.View>

            <Animated.View entering={FadeInDown.duration(400).delay(120)}>
              <TouchableOpacity
                onPress={handleCancel}
                disabled={cancelling}
                activeOpacity={0.85}
                style={s.cancelBtn}
              >
                {cancelling ? (
                  <ActivityIndicator color={C.error} />
                ) : (
                  <Text style={s.cancelBtnText}>Cancel subscription</Text>
                )}
              </TouchableOpacity>
              <Text style={s.cancelHint}>You will keep access until the end of the current period.</Text>
            </Animated.View>
          </>
        ) : (
          <Animated.View entering={FadeInDown.duration(400)} style={s.noSub}>
            <View style={s.noSubIconWrap}>
              <Ionicons name="card-outline" size={28} color={C.onSurfaceVariant} />
            </View>
            <Text style={s.noSubTitle}>No active subscription</Text>
            <Text style={s.noSubText}>Choose a plan to keep your monitoring running.</Text>
            <TouchableOpacity onPress={() => router.replace('/(paywall)/plans')} activeOpacity={0.85} style={s.viewPlansBtn}>
              <Text style={s.viewPlansBtnText}>View plans</Text>
            </TouchableOpacity>
          </Animated.View>
        )}
      </ScrollView>
    </View>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.detailRow}>
      <Text style={s.detailLabel}>{label}</Text>
      <Text style={s.detailValue}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.surface,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 48,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? 14 : 6,
    paddingBottom: 12,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerSpacer: {
    width: 40,
    height: 40,
  },
  headerTitle: {
    ...AuthFonts.titleMedium,
    color: C.onSurface,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
  },
  headerPill: {
    minWidth: 40,
    height: 40,
    paddingHorizontal: 14,
    borderRadius: R.full,
    backgroundColor: C.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerPillText: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 13,
    color: C.onPrimaryContainer,
    letterSpacing: 0.2,
  },
  trialBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: C.tertiaryContainer,
    borderRadius: R.full,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 20,
    alignSelf: 'flex-start',
  },
  trialBannerText: {
    fontFamily: 'PlusJakartaSans-SemiBold',
    fontSize: 13,
    color: C.onTertiaryContainer,
    flex: 1,
  },
  card: {
    backgroundColor: C.surfaceContainerLowest,
    borderRadius: R.xl,
    padding: 22,
    marginBottom: 20,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardLabel: {
    fontFamily: 'PlusJakartaSans-SemiBold',
    fontSize: 12,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: C.onSurfaceVariant,
  },
  statusPill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: R.full,
  },
  statusText: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  planName: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 22,
    color: C.onSurface,
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  planPriceRow: {
    marginBottom: 12,
  },
  planPrice: {
    fontFamily: 'PlusJakartaSans-ExtraBold',
    fontSize: 28,
    color: C.onSurface,
    letterSpacing: -0.5,
    fontVariant: ['tabular-nums'],
  },
  planPeriod: {
    ...AuthFonts.bodyMedium,
    color: C.onSurfaceVariant,
  },
  divider: {
    height: 1,
    backgroundColor: C.surfaceContainerHigh,
    marginVertical: 14,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  detailLabel: {
    ...AuthFonts.bodySmall,
    color: C.onSurfaceVariant,
  },
  detailValue: {
    ...AuthFonts.bodyMedium,
    color: C.onSurface,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  cancelBtn: {
    height: 52,
    borderRadius: R.full,
    backgroundColor: 'transparent',
    borderWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  cancelBtnText: {
    ...AuthFonts.titleSmall,
    color: C.error,
    fontWeight: '700',
  },
  cancelHint: {
    ...AuthFonts.labelMedium,
    color: C.onSurfaceVariant,
    textAlign: 'center',
  },
  noSub: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 56,
  },
  noSubIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: C.surfaceContainer,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  noSubTitle: {
    ...AuthFonts.titleMedium,
    color: C.onSurface,
    fontWeight: '700',
  },
  noSubText: {
    ...AuthFonts.bodySmall,
    color: C.onSurfaceVariant,
    textAlign: 'center',
  },
  viewPlansBtn: {
    marginTop: 16,
    paddingHorizontal: 24,
    height: 48,
    borderRadius: R.full,
    backgroundColor: C.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewPlansBtnText: {
    ...AuthFonts.titleSmall,
    color: C.onPrimary,
    fontWeight: '700',
  },
});