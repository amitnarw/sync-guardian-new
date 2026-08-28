import React, { useState, useEffect, useRef, useCallback } from 'react';
import { StyleSheet, View, Text, ActivityIndicator, Dimensions, KeyboardAvoidingView, Platform, TouchableOpacity, BackHandler } from 'react-native';
import { AuthColors, AuthFonts, AuthRadius } from '@/constants/auth-theme';
import { EdgeFadeScrollView } from '@/components/ui/edge-fade';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { router } from 'expo-router';
import { useAuthStore } from '@/hooks/use-auth-store';
import QRCode from 'react-native-qrcode-svg';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { supabase } from '@/lib/supabase';
import { logger } from '@/services/logger';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { isValidUUID } from '@/lib/uuid';

import { MaterialIcons } from '@expo/vector-icons';
import { Button } from '@/components/ui/button';
import { OtpInput } from '@/components/ui/otp-input';
import { useAppModal } from '@/hooks/use-app-modal';

const { width } = Dimensions.get('window');

export default function PairingScreen() {
  const { userRole, setUserRole, setPairId, setDeviceId } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [pairingData, setPairingData] = useState<{ code: string; token: string; child_device_id: string; qr_jwt: string; expires_at: string } | null>(null);
  const [manualCode, setManualCode] = useState('');
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [parentMode, setParentMode] = useState<'scan' | 'manual'>('scan');
  const [torch, setTorch] = useState(false);

  // Prevents the camera from firing multiple claims within 2 seconds of a scan
  const lastScanRef = useRef(0);

  const { showModal } = useAppModal();

  const handleBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else if (userRole === 'parent') {
      router.replace('/(tabs)/settings');
    } else {
      setUserRole(null);
      router.replace('/role-selection');
    }
  }, [userRole, setUserRole]);

  useEffect(() => {
    const onBackPress = () => {
      handleBack();
      return true;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, [handleBack]);

  const [isRegenerating, setIsRegenerating] = useState(false);
  const [timeLeft, setTimeLeft] = useState(600);

  const generatePairingToken = useCallback(async (isRegen = false) => {
    try {
      if (isRegen) {
        setIsRegenerating(true);
      } else {
        setLoading(true);
      }
      const { data, error } = await supabase.functions.invoke('create-pairing-token', {
        body: {},
      });

      if (error) throw error;

      setDeviceId(data.data.child_device_id);
      setPairingData(data.data);
    } catch (err: unknown) {
      let msg = 'Could not create pairing code.';
      let statusInfo = '';

      if (err instanceof FunctionsHttpError) {
        statusInfo = ` (status ${err.context.status})`;
        try {
          const body = await err.context.text();
          const parsed = JSON.parse(body);
          msg = parsed.error || msg;
        } catch {
          msg = `Server returned an error${statusInfo}. Please try again.`;
        }
      } else if (err instanceof Error && err.message !== 'Failed to create session') {
        msg = err.message;
        if (err.message.includes('failed to send a request') || err.message.includes('Network request failed')) {
          msg = 'Could not connect. Please check your internet and try again.';
        }
      }

      logger.error('create-pairing-token error:', msg);
      showModal({ title: 'Pairing Failed', message: msg + statusInfo, icon: 'error', primaryButton: 'Got it' });
    } finally {
      if (isRegen) {
        setIsRegenerating(false);
      } else {
        setLoading(false);
      }
    }
  }, [showModal, setDeviceId]);

  useEffect(() => {
    if (userRole === 'child') {
      (async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          showModal({ title: 'Pairing Failed', message: 'Session not ready. Please try signing in again.', icon: 'error', primaryButton: 'Got it' });
          setLoading(false);
          return;
        }
        generatePairingToken();
      })();
    } else {
      setLoading(false);
    }
  }, [userRole, generatePairingToken, showModal]);

  // Listen for the parent device claiming the token, and auto-regenerate on failure/expiry
  useEffect(() => {
    if (!pairingData?.token) return;

    let cancelled = false;

    const checkToken = async () => {
      if (cancelled) return;
      // Avoid regenerating while a regeneration is already in flight
      if (isRegenerating) return;

      const { data, error } = await supabase
        .from('pairing_tokens')
        .select('consumed_at, pair_id')
        .eq('token', pairingData.token)
        .maybeSingle();

      if (error) {
        logger.error('Pairing: polling query error:', error);
        return false;
      }

      // Token row is gone (rotated/deleted elsewhere) -> get a fresh one
      if (!data) {
        logger.warn('Pairing: token row missing, regenerating');
        generatePairingToken(true);
        return false;
      }

       if (data.consumed_at) {
        if (isValidUUID(data.pair_id)) {
          setPairId(data.pair_id);
          // Upload the child's installed app inventory so the parent can
          // choose which apps are allowed to send notifications.
          try {
            const { syncInstalledApps } = await import('@/services/installed-apps-sync');
            await syncInstalledApps(pairingData.child_device_id);
          } catch (syncErr) {
            logger.warn('Pairing: installed apps sync failed', syncErr);
          }
          router.replace('/onboarding');
          return true;
        }
        // Consumed but no pair created -> failed/partial claim -> regenerate immediately
        logger.warn('Pairing: token consumed without pair_id, regenerating');
        generatePairingToken(true);
        return false;
      }

      // Not consumed but expired -> regenerate automatically so a fresh code is shown
      const expiresAt = new Date(pairingData.expires_at).getTime();
      if (expiresAt <= Date.now()) {
        logger.warn('Pairing: token expired, regenerating');
        generatePairingToken(true);
        return false;
      }

      return false;
    };

    // Polling: check immediately then every 5 seconds
    checkToken();
    const pollInterval = setInterval(() => {
      checkToken();
    }, 5000);

    return () => {
      cancelled = true;
      clearInterval(pollInterval);
    };
  }, [pairingData, isRegenerating, generatePairingToken, setPairId]);

  // Countdown timer for pairing code expiry
  useEffect(() => {
    if (!pairingData?.expires_at) return;
    const expiresAt = new Date(pairingData.expires_at).getTime();
    const tick = () => {
      setTimeLeft(Math.max(0, Math.floor((expiresAt - Date.now()) / 1000)));
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [pairingData?.expires_at]);

  const handleBarcodeScanned = ({ type, data }: { type: string; data: string }) => {
    if (scanned) return;
    const now = Date.now();
    if (now - lastScanRef.current < 2000) return;
    lastScanRef.current = now;
    setScanned(true);
    verifyToken(data);
  };

  const verifyToken = async (tokenOrCodeRaw: string) => {
    try {
      setIsVerifying(true);

      // Sanitize scanned/typed input
      const tokenOrCode = (tokenOrCodeRaw || '').trim();
      if (!tokenOrCode) {
        throw new Error('Scanned code is empty. Please try again.');
      }

      const payload: Record<string, string> = {};

      if (tokenOrCode.includes('.')) {
        // Looks like a JWT (QR code path)
        const parts = tokenOrCode.split('.');
        if (parts.length !== 3 || parts.some((p) => !p)) {
          throw new Error(
            'This QR code is not a Sync Guardian pairing code. Enter the 6-digit code manually instead.'
          );
        }
        payload.qr_jwt = tokenOrCode;
      } else if (tokenOrCode.length === 6) {
        payload.code = tokenOrCode;
      } else {
        payload.token = tokenOrCode;
      }

      const { data, error } = await supabase.functions.invoke('claim-pairing-token', {
        body: payload,
      });

      if (error) throw error;

      if (data?.error === 'PARENT_CHILD_LIMIT_REACHED' || data?.message?.toLowerCase().includes('reached the connected child devices limit')) {
        showModal({
          title: 'Plan limit reached',
          message:
            'You\'ve reached the number of connected child devices on your current plan. Upgrade to add more children.',
          icon: 'warning',
          primaryButton: 'View Plans',
          onPrimaryPress: () => router.push('/(paywall)/plans'),
          secondaryButton: 'Close',
        });
        setScanned(false);
        setIsVerifying(false);
        return;
      }

      if (!isValidUUID(data?.data?.parent_device_id) || !isValidUUID(data?.data?.id)) {
        throw new Error('Pairing response contained invalid device identifiers. Please try scanning again.');
      }

      setDeviceId(data.data.parent_device_id);
      setPairId(data.data.id);
      // Edge function already advanced onboarding to the next step.
      // Return to the onboarding hub, which routes to permissions/app-selection.
      router.replace('/onboarding');
    } catch (err: unknown) {
      let msg = 'Pairing failed.';
      let statusInfo = '';
      let resolvedStatus = 0;

      if (err instanceof FunctionsHttpError) {
        resolvedStatus = err.context.status;
        statusInfo = ` (status ${err.context.status})`;
        try {
          const body = await err.context.text();
          const parsed = JSON.parse(body);
          msg = parsed.error || msg;
          if (
            (parsed.error === 'PARENT_CHILD_LIMIT_REACHED') ||
            (typeof parsed.message === 'string' &&
              parsed.message.toLowerCase().includes('connected child devices limit'))
          ) {
            showModal({
              title: 'Plan limit reached',
              message:
                "You've reached the number of connected child devices on your current plan. Upgrade to add more children.",
              icon: 'warning',
              primaryButton: 'View Plans',
              onPrimaryPress: () => router.push('/(paywall)/plans'),
              secondaryButton: 'Close',
            });
            setScanned(false);
            setIsVerifying(false);
            return;
          }
        } catch {
          msg = `Server returned an error${statusInfo}. Please try again.`;
        }

        if (resolvedStatus === 402 && msg === 'Pairing failed.') {
          showModal({
            title: 'Plan limit reached',
            message:
              "You've reached the number of connected child devices on your current plan. Upgrade to add more children.",
            icon: 'warning',
            primaryButton: 'View Plans',
            onPrimaryPress: () => router.push('/(paywall)/plans'),
            secondaryButton: 'Close',
          });
          setScanned(false);
          setIsVerifying(false);
          return;
        }
      } else if (err instanceof Error) {
        msg = err.message;
        if (err.message.includes('failed to send a request') || err.message.includes('Network request failed')) {
          msg = 'Could not connect. Please check your internet and try again.';
        }
      }

      // Make expiry/usage errors actionable
      if (msg.toLowerCase().includes('invalid') || msg.toLowerCase().includes('expired')) {
        msg = 'This pairing code has expired or already been used. Ask the child to tap Regenerate, then scan the new code.';
      }

      logger.error('claim-pairing-token error:', msg);
      showModal({ title: 'Pairing Failed', message: msg + statusInfo, icon: 'error', primaryButton: 'Got it' });
      setScanned(false);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleManualSubmit = () => {
    if (!manualCode.trim()) return;
    verifyToken(manualCode);
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#44674d" />
        <Text style={styles.loadingText}>Preparing your connection...</Text>
      </View>
    );
  }

  if (userRole === 'child') {
    const isExpired = timeLeft <= 0 && !!pairingData;

    return (
      <EdgeFadeScrollView contentContainerStyle={{ flexGrow: 1 }} bounces={false} style={styles.container}>
          <View style={styles.header}>
            <MaterialIcons name="spa" size={32} color="#44674d" />
            <Text style={styles.title}>Child Mode Setup</Text>
            <Text style={styles.subtitle}>Show this screen to the person with the Parent phone</Text>
          </View>

        <View style={styles.qrContainer}>
          {pairingData ? (
            <>
              <View style={styles.qrContent}>
                {pairingData.qr_jwt ? (
                  <View style={[styles.qrWrapper, isExpired && styles.expired]}>
                    <QRCode
                      value={pairingData.qr_jwt}
                      size={200}
                      color="#363228"
                      backgroundColor="#ffffff"
                    />
                  </View>
                ) : (
                  <View style={[styles.qrWrapper, styles.expired]}>
                    <MaterialIcons name="qr-code-2" size={48} color="#ba1a1a" />
                    <Text style={[styles.codeText, styles.expiredText]}>
                      QR unavailable
                    </Text>
                  </View>
                )}
                <Text style={styles.orText}>OR ENTER CODE</Text>
                <View style={[styles.codeWrapper, isExpired && styles.expired]}>
                  <Text style={[styles.codeText, isExpired && styles.expiredText]}>
                    {isExpired ? 'EXPIRED' : pairingData.code}
                  </Text>
                </View>

                <View style={styles.countdownContainer}>
                  <MaterialIcons name="timer" size={16} color={isExpired ? '#ba1a1a' : '#486730'} />
                  {isExpired ? (
                    <Text style={[styles.countdownText, styles.countdownExpired]}>Code expired</Text>
                  ) : (
                    <Text style={styles.countdownText}>
                      Code expires in{' '}
                      <Text style={styles.countdownDigits}>
                        {String(Math.floor(timeLeft / 60)).padStart(2, '0')}:{String(timeLeft % 60).padStart(2, '0')}
                      </Text>
                    </Text>
                  )}
                </View>

                <Text style={styles.childHint}>
                  Once they scan or enter this code, they’ll choose which apps to monitor and your dashboard will appear.
                </Text>
              </View>

              <View style={styles.bottomRow}>
                <Button
                  title="Regenerate"
                  icon="refresh"
                  variant="secondary"
                  onPress={() => generatePairingToken(true)}
                  loading={isRegenerating}
                  style={{ flex: 1 }}
                />
                <Button
                  title="Go Back"
                  variant="secondary"
                  onPress={() => {
                    setUserRole(null);
                    router.replace('/role-selection');
                  }}
                  style={{ flex: 1 }}
                />
              </View>
            </>
          ) : (
            <>
              <View style={{ flex: 1 }} />
              <Button title="Generate Pairing Code" onPress={() => generatePairingToken()} variant="secondary" />
              <View style={{ flex: 1 }} />
            </>
          )}
        </View>

      </EdgeFadeScrollView>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
      <EdgeFadeScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled" bounces={false}>
        <View style={styles.innerContainer}>
          
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={handleBack} style={styles.backArrowButton} accessibilityLabel="Go back">
              <MaterialIcons name="arrow-back" size={24} color={AuthColors.onSurface} />
            </TouchableOpacity>
          </View>

          <Text style={styles.parentTitle}>
            Scan the QR code on the child&apos;s phone, or enter the 6-digit code.
          </Text>

          <View style={styles.tabContainer}>
            <TouchableOpacity
              onPress={() => {
                setParentMode('scan');
                if (permission && !permission.granted) {
                  requestPermission();
                }
              }}
              style={[styles.tabButton, parentMode === 'scan' && styles.tabButtonActive]}
              activeOpacity={0.8}
            >
              <Text style={[styles.tabButtonText, parentMode === 'scan' && styles.tabButtonTextActive]}>
                Scan QR
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setParentMode('manual')}
              style={[styles.tabButton, parentMode === 'manual' && styles.tabButtonActive]}
              activeOpacity={0.8}
            >
              <Text style={[styles.tabButtonText, parentMode === 'manual' && styles.tabButtonTextActive]}>
                Enter Code
              </Text>
            </TouchableOpacity>
          </View>

          {parentMode === 'scan' ? (
            <Animated.View entering={FadeIn} exiting={FadeOut} style={styles.cardWrapper}>
              <View style={styles.viewfinderCard}>
                {!permission ? (
                  <View style={styles.cameraPlaceholder}>
                    <ActivityIndicator size="large" color={AuthColors.primary} />
                  </View>
                ) : !permission.granted ? (
                  <View style={styles.cameraPlaceholder}>
                    <MaterialIcons name="videocam-off" size={48} color={AuthColors.onSurfaceVariant} style={{ marginBottom: 12 }} />
                    <Text style={styles.cameraSubtitle}>Camera permission is needed to scan the QR code.</Text>
                    <Button 
                      title="Grant Permission" 
                      onPress={requestPermission} 
                      style={styles.grantButton}
                    />
                  </View>
                ) : (
                  <View style={styles.scannerWrapper}>
                    <CameraView
                      style={StyleSheet.absoluteFillObject}
                      facing="back"
                      enableTorch={torch}
                      onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
                      barcodeScannerSettings={{
                        barcodeTypes: ["qr"],
                      }}
                    />
                    
                    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
                      {/* Viewfinder brackets */}
                      <View style={[styles.cornerBracket, { top: 24, left: 24, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 24 }]} />
                      <View style={[styles.cornerBracket, { top: 24, right: 24, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 24 }]} />
                      <View style={[styles.cornerBracket, { bottom: 24, left: 24, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 24 }]} />
                      <View style={[styles.cornerBracket, { bottom: 24, right: 24, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 24 }]} />

                      {/* Center Circular Badge */}
                      <View style={styles.centerCircularBadge}>
                        <View style={styles.centerCircularBadgeInner}>
                          <MaterialIcons name="qr-code" size={24} color={AuthColors.primary} />
                        </View>
                      </View>
                    </View>

                    {/* Floating Torch Button */}
                    <TouchableOpacity 
                      style={styles.torchFloatingButton} 
                      onPress={() => setTorch(!torch)}
                      activeOpacity={0.7}
                    >
                      <MaterialIcons 
                        name={torch ? "flashlight-off" : "flashlight-on"} 
                        size={20} 
                        color={AuthColors.primary} 
                      />
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </Animated.View>
          ) : (
            <Animated.View entering={FadeIn} exiting={FadeOut} style={styles.manualEntryContainer}>
              <View style={styles.otpWrapper}>
                <OtpInput
                  length={6}
                  value={manualCode}
                  onChange={(val) => {
                    setManualCode(val);
                    if (val.length === 6) {
                      verifyToken(val);
                    }
                  }}
                />
              </View>
              <Button
                title="Verify Code"
                onPress={handleManualSubmit}
                loading={isVerifying}
                disabled={manualCode.length !== 6}
                style={styles.verifyButton}
              />
            </Animated.View>
          )}

          <TouchableOpacity 
            style={styles.helpLink} 
            onPress={() => {
              showModal({
                title: 'Where to find the code?',
                message: '1. Open Sync Guardian on your child\'s phone.\n2. Choose "Child" role.\n3. The 6-digit code and QR code will be displayed on their screen.',
                icon: 'info',
                primaryButton: 'Got it'
              });
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.helpLinkText}>Where to find the code?</Text>
          </TouchableOpacity>

        </View>
      </EdgeFadeScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: AuthColors.background,
  },
  loadingText: {
    marginTop: 16,
    ...AuthFonts.titleMedium,
    color: AuthColors.primary,
  },
  container: {
    flex: 1,
    backgroundColor: AuthColors.background,
  },
  innerContainer: {
    flexGrow: 1,
    paddingBottom: 24,
  },
  header: {
    paddingTop: 40,
    paddingHorizontal: 24,
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    ...AuthFonts.headlineMedium,
    fontFamily: 'PlusJakartaSans-ExtraBold',
    color: AuthColors.onSurface,
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    ...AuthFonts.titleMedium,
    color: AuthColors.onSurfaceVariant,
    textAlign: 'center',
  },
  qrContainer: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 48,
  },
  qrContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomRow: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
  },
  qrWrapper: {
    padding: 24,
    backgroundColor: AuthColors.surfaceContainerLowest,
    borderRadius: 24,
    shadowColor: AuthColors.onSurface,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 4,
    marginBottom: 32,
  },
  orText: {
    ...AuthFonts.labelLarge,
    fontFamily: 'PlusJakartaSans-Bold',
    color: AuthColors.outline,
    letterSpacing: 2,
    marginBottom: 16,
  },
  codeWrapper: {
    paddingVertical: 16,
    paddingHorizontal: 32,
    backgroundColor: AuthColors.primary,
    borderRadius: 16,
  },
  codeText: {
    ...AuthFonts.displaySmall,
    fontFamily: 'PlusJakartaSans-ExtraBold',
    color: AuthColors.onPrimary,
    letterSpacing: 4,
  },
  
  // Parent layout header row
  headerRow: {
    width: '100%',
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'ios' ? 24 : 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  backArrowButton: {
    padding: 8,
    marginLeft: -8,
  },
  parentTitle: {
    ...AuthFonts.titleMedium,
    color: AuthColors.onSurfaceVariant,
    textAlign: 'center',
    paddingHorizontal: 40,
    marginTop: 16,
  },
  
  // Segmented control
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: AuthColors.surfaceContainer,
    borderRadius: AuthRadius.full,
    padding: 4,
    alignSelf: 'center',
    marginTop: 24,
    marginBottom: 32,
    width: 260,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: AuthRadius.full,
  },
  tabButtonActive: {
    backgroundColor: AuthColors.primary,
    ...Platform.select({
      ios: {
        shadowColor: AuthColors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  tabButtonText: {
    ...AuthFonts.labelLarge,
    fontFamily: 'PlusJakartaSans-Bold',
    color: AuthColors.onSurfaceVariant,
  },
  tabButtonTextActive: {
    color: AuthColors.onPrimary,
  },

  // Viewfinder scan card container
  cardWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingHorizontal: 24,
  },
  viewfinderCard: {
    width: width - 80,
    height: width - 80,
    maxWidth: 320,
    maxHeight: 320,
    backgroundColor: AuthColors.surfaceContainer,
    borderRadius: AuthRadius.xl,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#3e2723',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.08,
        shadowRadius: 24,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  cameraPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: AuthColors.surfaceContainer,
  },
  cameraSubtitle: {
    ...AuthFonts.bodyMedium,
    color: AuthColors.onSurfaceVariant,
    textAlign: 'center',
    marginBottom: 20,
  },
  grantButton: {
    height: 48,
    borderRadius: AuthRadius.lg,
    width: '80%',
  },
  scannerWrapper: {
    flex: 1,
    borderRadius: AuthRadius.xl,
    overflow: 'hidden',
  },
  
  // Custom camera overlay elements
  cornerBracket: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderColor: AuthColors.primary,
  },
  centerCircularBadge: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 56,
    height: 56,
    borderRadius: 28,
    marginLeft: -28,
    marginTop: -28,
    backgroundColor: 'rgba(239, 239, 215, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerCircularBadgeInner: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(239, 239, 215, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(72, 103, 48, 0.2)',
  },
  torchFloatingButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },

  // Manual entry layout
  manualEntryContainer: {
    width: '100%',
    paddingHorizontal: 32,
    alignItems: 'center',
  },
  otpWrapper: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 24,
  },
  verifyButton: {
    width: '100%',
    height: 56,
    borderRadius: AuthRadius.lg,
  },

  // Help info link
  helpLink: {
    marginTop: 40,
    paddingVertical: 12,
    alignSelf: 'center',
  },
  helpLinkText: {
    ...AuthFonts.labelLarge,
    fontFamily: 'PlusJakartaSans-Bold',
    color: AuthColors.primary,
    textDecorationLine: 'underline',
  },

  expired: {
    opacity: 0.5,
  },
  expiredText: {
    color: AuthColors.error,
  },
  childHint: {
    ...AuthFonts.bodyMedium,
    color: AuthColors.onSurfaceVariant,
    textAlign: 'center',
    marginTop: 0,
    marginBottom: 15,
    marginHorizontal: 8,
  },
  countdownContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 20,
    marginBottom: 30,
  },
  countdownText: {
    ...AuthFonts.bodyMedium,
    color: AuthColors.outline,
    letterSpacing: 0.5,
  },
  countdownExpired: {
    color: AuthColors.error,
    ...AuthFonts.labelLarge,
    fontFamily: 'PlusJakartaSans-Bold',
  },
  countdownDigits: {
    color: AuthColors.primary,
    ...AuthFonts.labelLarge,
    fontFamily: 'PlusJakartaSans-Bold',
  },
});
