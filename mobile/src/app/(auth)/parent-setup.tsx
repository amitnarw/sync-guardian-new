import React, { useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useSetupStatus } from '@/hooks/use-setup-status';
import { AuthColors, AuthFonts, AuthRadius, AuthShadows } from '@/constants/auth-theme';
import { Button } from '@/components/ui/button';
import { SyncAnimation } from '@/components/ui/sync-animation';
import { EdgeFadeScrollView } from '@/components/ui/edge-fade';

const STEPS = ['Link device', 'Choose apps', 'All set'];

export default function ParentSetupScreen() {
  const { loading, hasPair, setupComplete, incompletePairId } = useSetupStatus();

  useEffect(() => {
    if (!loading && setupComplete) {
      router.replace('/(tabs)/home');
    }
  }, [loading, setupComplete]);

  const currentStep = setupComplete ? 3 : hasPair ? 2 : 1;

  return (
    <SafeAreaView style={styles.container}>
      <EdgeFadeScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <MaterialIcons name="family-restroom" size={28} color={AuthColors.primary} />
          <Text style={styles.headerTitle}>Set up Sync Guardian</Text>
          <Text style={styles.headerSubtitle}>
            Three quick steps and you&apos;ll be monitoring your child&apos;s device.
          </Text>
        </View>

        <View style={styles.stepper}>
          {STEPS.map((label, i) => {
            const stepNum = i + 1;
            const isDone = stepNum < currentStep;
            const isActive = stepNum === currentStep;
            return (
              <React.Fragment key={label}>
                <View style={styles.stepItem}>
                  <View
                    style={[
                      styles.stepDot,
                      isDone && styles.stepDotDone,
                      isActive && styles.stepDotActive,
                    ]}
                  >
                    {isDone ? (
                      <MaterialIcons name="check" size={18} color={AuthColors.onPrimary} />
                    ) : (
                      <Text style={[styles.stepNum, isActive && styles.stepNumActive]}>{stepNum}</Text>
                    )}
                  </View>
                  <Text style={[styles.stepLabel, isActive && styles.stepLabelActive]}>{label}</Text>
                </View>
                {stepNum < STEPS.length && (
                  <View style={[styles.stepLine, isDone && styles.stepLineDone]} />
                )}
              </React.Fragment>
            );
          })}
        </View>

        <View style={styles.card}>
          {currentStep === 1 && (
            <StepBody
              emoji="link"
              title="Link your child’s device"
              description="Open Sync Guardian on your child’s phone and choose “Child”. They’ll show a QR code or 6-digit code, then scan it here to create a secure connection."
              cta="Link a Child Device"
              onPress={() => router.push('/pairing')}
            />
          )}

          {currentStep === 2 && (
            <StepBody
              emoji="tune"
              title="Choose the apps to monitor"
              description="Your child’s device is connected and waiting. Pick which apps may send notifications so monitoring can begin. You can change this anytime."
              cta="Choose Apps"
              onPress={() =>
                router.push(incompletePairId ? `/app-filters?pairId=${incompletePairId}` : '/app-filters')
              }
            />
          )}

          {currentStep === 3 && (
            <View style={styles.stepBody}>
              <View style={styles.doneBadge}>
                <MaterialIcons name="celebration" size={32} color={AuthColors.primary} />
              </View>
              <Text style={styles.stepTitle}>All set!</Text>
              <Text style={styles.stepDescription}>
                Monitoring is ready. You’ll start seeing your child’s activity on the dashboard.
              </Text>
              <Button title="Go to Dashboard" icon="arrow-forward" onPress={() => router.replace('/(tabs)/home')} />
            </View>
          )}
        </View>

        <View style={styles.footerArt}>
          <SyncAnimation />
        </View>

        <TouchableOpacity style={styles.laterLink} onPress={() => router.replace('/(tabs)/home')}>
          <Text style={styles.laterText}>Maybe later</Text>
        </TouchableOpacity>
      </EdgeFadeScrollView>
    </SafeAreaView>
  );
}

function StepBody({
  emoji,
  title,
  description,
  cta,
  onPress,
}: {
  emoji: string;
  title: string;
  description: string;
  cta: string;
  onPress: () => void;
}) {
  return (
    <View style={styles.stepBody}>
      <View style={styles.stepIconWrap}>
        <MaterialIcons name={emoji as any} size={32} color={AuthColors.primary} />
      </View>
      <Text style={styles.stepTitle}>{title}</Text>
      <Text style={styles.stepDescription}>{description}</Text>
      <Button title={cta} icon="arrow-forward" onPress={onPress} style={styles.stepCta} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AuthColors.background,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 40,
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 28,
  },
  headerTitle: {
    ...AuthFonts.headlineSmall,
    color: AuthColors.onSurface,
    marginTop: 12,
    textAlign: 'center',
  },
  headerSubtitle: {
    ...AuthFonts.bodyMedium,
    color: AuthColors.onSurfaceVariant,
    marginTop: 8,
    textAlign: 'center',
    maxWidth: 320,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
    marginBottom: 24,
    width: '100%',
  },
  stepItem: {
    alignItems: 'center',
    width: 84,
  },
  stepDot: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: AuthColors.surfaceContainer,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: AuthColors.outlineVariant,
  },
  stepDotActive: {
    backgroundColor: AuthColors.primary,
    borderColor: AuthColors.primary,
  },
  stepDotDone: {
    backgroundColor: AuthColors.tertiary,
    borderColor: AuthColors.tertiary,
  },
  stepNum: {
    ...AuthFonts.titleMedium,
    color: AuthColors.onSurfaceVariant,
  },
  stepNumActive: {
    color: AuthColors.onPrimary,
  },
  stepLabel: {
    ...AuthFonts.labelSmall,
    color: AuthColors.onSurfaceVariant,
    marginTop: 8,
    textAlign: 'center',
  },
  stepLabelActive: {
    color: AuthColors.primary,
    fontFamily: 'PlusJakartaSans-Bold',
  },
  stepLine: {
    flex: 1,
    height: 2,
    backgroundColor: AuthColors.outlineVariant,
    marginTop: 17,
    maxWidth: 28,
  },
  stepLineDone: {
    backgroundColor: AuthColors.tertiary,
  },
  card: {
    width: '100%',
    backgroundColor: AuthColors.surfaceContainerLow,
    borderRadius: AuthRadius.xl,
    padding: 24,
    ...AuthShadows.ambient,
  },
  stepBody: {
    alignItems: 'center',
  },
  stepIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: AuthColors.tertiaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  doneBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: AuthColors.tertiaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  stepTitle: {
    ...AuthFonts.headlineSmall,
    color: AuthColors.onSurface,
    textAlign: 'center',
    marginBottom: 8,
  },
  stepDescription: {
    ...AuthFonts.bodyMedium,
    color: AuthColors.onSurfaceVariant,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
    maxWidth: 320,
  },
  stepCta: {
    width: '100%',
  },
  footerArt: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    opacity: 0.8,
  },
  laterLink: {
    marginTop: 20,
    paddingVertical: 8,
  },
  laterText: {
    ...AuthFonts.labelLarge,
    color: AuthColors.outline,
    textDecorationLine: 'underline',
  },
});
