import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Text, ActivityIndicator, Alert, Dimensions, KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Keyboard, Modal, ScrollView } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { router } from 'expo-router';
import { useAuthStore } from '@/hooks/use-auth-store';
import QRCode from 'react-native-qrcode-svg';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { supabase } from '@/lib/supabase';
import { logger } from '@/services/logger';
import { FunctionsHttpError } from '@supabase/supabase-js';

import { MaterialIcons } from '@expo/vector-icons';
import { Button } from '@/components/ui/button';
import { OtpInput } from '@/components/ui/otp-input';
import { SyncAnimation } from '@/components/ui/sync-animation';
import { ErrorModal } from '@/components/ui/error-modal';

const { width } = Dimensions.get('window');

export default function PairingScreen() {
  const { userRole, setUserRole, setPairId, setDeviceId } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [pairingData, setPairingData] = useState<{ code: string; token: string; child_device_id: string; qr_jwt: string; expires_at: string } | null>(null);
  const [manualCode, setManualCode] = useState('');
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [parentMode, setParentMode] = useState<'options' | 'scan' | 'manual'>('options');
  const [torch, setTorch] = useState(false);

  // Prevents the camera from firing multiple claims within 2 seconds of a scan
  const lastScanRef = useRef(0);

  const [errorModalVisible, setErrorModalVisible] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const [isRegenerating, setIsRegenerating] = useState(false);
  const [timeLeft, setTimeLeft] = useState(600);

  useEffect(() => {
    if (userRole === 'child') {
      (async () => {
        // Ensure session is ready before calling the edge function
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          setErrorMessage('Session not ready. Please try signing in again.');
          setErrorModalVisible(true);
          setLoading(false);
          return;
        }
        generatePairingToken();
      })();
    } else {
      setLoading(false);
    }
  }, [userRole]);

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
         if (data.pair_id) {
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
  }, [pairingData, isRegenerating]);

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

  const generatePairingToken = async (isRegen = false) => {
    try {
      if (isRegen) {
        setIsRegenerating(true);
      } else {
        setLoading(true);
      }
      const { data, error } = await supabase.functions.invoke('create-pairing-token', {
        body: { device_name: 'Child Device' },
      });

      if (error) throw error;
      
      // The edge function returns { data: { code, token, child_device_id, ... } }
      setDeviceId(data.data.child_device_id);
      setPairingData(data.data);
    } catch (err: unknown) {
      let msg = 'Could not create pairing code. Please check your internet and try again.';

      if (err instanceof FunctionsHttpError) {
        try {
          const body = await err.context.text();
          logger.error('create-pairing-token failed, status:', err.context.status);
          const parsed = JSON.parse(body);
          msg = parsed.error || msg;
        } catch {
          logger.error('create-pairing-token response:', err.context.status, err.context.statusText);
        }
      } else if (err instanceof Error && err.message !== 'Failed to create session') {
        logger.error('create-pairing-token error:', err.message);
        msg = err.message;
      }

      if (msg.includes('failed to send a request')) {
        msg = 'Could not connect. Please check your internet.';
      }

      setErrorMessage(msg);
      setErrorModalVisible(true);
    } finally {
      if (isRegen) {
        setIsRegenerating(false);
      } else {
        setLoading(false);
      }
    }
  };

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

      const payload: Record<string, string> = {
        device_name: 'Parent Device'
      };

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

      setDeviceId(data.data.parent_device_id);
      setPairId(data.data.id);
      // Parent chooses which child apps may send notifications before onboarding.
      router.replace('/app-filters');
    } catch (err: unknown) {
      let msg =
        'Pairing failed. Ask the child to wait for a new code, then scan again.';

      if (err instanceof FunctionsHttpError) {
        try {
          const body = await err.context.text();
          const parsed = JSON.parse(body);
          logger.error('claim-pairing-token failed, status:', err.context.status, 'error:', parsed.error);
          msg = parsed.error || msg;
        } catch {
          logger.error('claim-pairing-token response:', err.context.status, err.context.statusText);
        }
      } else if (err instanceof Error) {
        logger.error('claim-pairing-token error:', err.message);
        msg = err.message;
      }

      // Make expiry/usage errors actionable
      if (msg.toLowerCase().includes('invalid') || msg.toLowerCase().includes('expired')) {
        msg =
          'This pairing code has expired or already been used. Ask the child to tap Regenerate, then scan the new code.';
      } else if (msg.includes('failed to send a request')) {
        msg = 'Could not connect. Please check your internet and try again.';
      }

      setErrorMessage(msg);
      setErrorModalVisible(true);
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
        <Text style={styles.loadingText}>Preparing Sanctuary...</Text>
      </View>
    );
  }

  if (userRole === 'child') {
    const isExpired = timeLeft <= 0 && !!pairingData;

    return (
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} bounces={false} style={styles.container}>
        <View style={styles.header}>
          <MaterialIcons name="spa" size={32} color="#44674d" />
          <Text style={styles.title}>Child Mode Setup</Text>
          <Text style={styles.subtitle}>Scan this code on the Parent device</Text>
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
                    {isExpired ? '— EXPIRED —' : pairingData.code}
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

        <ErrorModal
          visible={errorModalVisible}
          message={errorMessage}
          onClose={() => setErrorModalVisible(false)}
        />

      </ScrollView>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled" bounces={false}>
        <View style={styles.innerContainer}>
          <View style={styles.header}>
            <MaterialIcons name="family-restroom" size={32} color="#44674d" />
            <Text style={styles.title}>Parent Mode Setup</Text>
            <Text style={styles.subtitle}>Secure your family&apos;s digital environment</Text>
          </View>

          {parentMode === 'options' && (
            <Animated.View entering={FadeIn} exiting={FadeOut} style={styles.optionsContainer}>
              <View style={styles.animationWrapper}>
                <SyncAnimation />
              </View>

              <View style={styles.bottomBlock}>
                <View style={styles.explainerWrapper}>
                  <Text style={styles.explainerTitle}>Link a Child Device</Text>
                  <Text style={styles.explainerText}>
                    Sync Guardian creates a secure, real-time connection to your child&apos;s phone. Once paired, you can monitor their notifications seamlessly.
                  </Text>
                </View>

                <Text style={styles.optionsPrompt}>Choose a pairing method:</Text>
                <View style={{ flexDirection: 'row', width: '100%', gap: 16 }}>
                  <Button
                    title="Scan QR"
                    icon="qr-code-scanner"
                    onPress={() => {
                      setParentMode('scan');
                      if (!permission?.granted) requestPermission();
                    }}
                    style={{ flex: 1 }}
                  />
                  <Button
                    title="Enter Code"
                    icon="keyboard"
                    variant="secondary"
                    onPress={() => setParentMode('manual')}
                    style={{ flex: 1 }}
                  />
                </View>
              </View>
            </Animated.View>
          )}

          {parentMode === 'scan' && (
            <Animated.View entering={FadeIn} exiting={FadeOut} style={styles.scanModeContainer}>
              {!permission ? (
                <View style={styles.cameraPlaceholder}><ActivityIndicator /></View>
              ) : !permission.granted ? (
                <View style={styles.cameraPlaceholder}>
                  <Text style={styles.cameraSubtitle}>We need camera permission to scan QR</Text>
                  <Button title="Grant Permission" onPress={requestPermission} />
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
                  <View style={styles.scannerOverlay}>
                    <View style={styles.scannerTarget} />
                  </View>
                </View>
              )}
              <Button
                title={torch ? "Turn Flashlight Off" : "Turn Flashlight On"}
                icon={torch ? "flashlight-off" : "flashlight-on"}
                variant="secondary"
                onPress={() => setTorch(!torch)}
                style={styles.torchButton}
              />
              <Button
                title="Back to Options"
                variant="secondary"
                onPress={() => setParentMode('options')}
                style={styles.backButton}
              />
            </Animated.View>
          )}

          {parentMode === 'manual' && (
            <Animated.View entering={FadeIn} exiting={FadeOut} style={styles.manualEntryContainer}>
              <Text style={styles.orText}>ENTER 6-DIGIT CODE</Text>
              <OtpInput
                length={6}
                value={manualCode}
                onChange={setManualCode}
              />
              <Button
                title="Verify Code"
                onPress={handleManualSubmit}
                loading={isVerifying}
                style={{ marginTop: 16 }}
              />
              <Button
                title="Back to Options"
                variant="secondary"
                onPress={() => setParentMode('options')}
                style={styles.backButton}
              />
            </Animated.View>
          )}
        </View>
      </ScrollView>

      <ErrorModal
        visible={errorModalVisible}
        message={errorMessage}
        onClose={() => setErrorModalVisible(false)}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff8f0',
  },
  loadingText: {
    marginTop: 16,
    fontFamily: 'PlusJakartaSans-Medium',
    color: '#44674d',
    fontSize: 16,
  },
  container: {
    flex: 1,
    backgroundColor: '#fff8f0',
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
    fontFamily: 'PlusJakartaSans-ExtraBold',
    fontSize: 28,
    color: '#363228',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 16,
    color: '#645e53',
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
    backgroundColor: '#ffffff',
    borderRadius: 24,
    shadowColor: '#363228',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 4,
    marginBottom: 32,
  },
  orText: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 12,
    color: '#807a6d',
    letterSpacing: 2,
    marginBottom: 16,
  },
  codeWrapper: {
    paddingVertical: 16,
    paddingHorizontal: 32,
    backgroundColor: '#486730',
    borderRadius: 16,
  },
  codeText: {
    fontFamily: 'PlusJakartaSans-ExtraBold',
    fontSize: 32,
    color: '#f8f8f8',
    letterSpacing: 4,
  },
  cameraPlaceholder: {
    flex: 1,
    maxHeight: width - 48,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
    borderRadius: 24,
    overflow: 'hidden',
  },
  scannerWrapper: {
    flex: 1,
    maxHeight: width - 48,
    borderRadius: 24,
    overflow: 'hidden',
  },
  scannerOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  scannerTarget: {
    width: 200,
    height: 200,
    borderWidth: 2,
    borderColor: '#c5eccc',
    borderRadius: 24,
    backgroundColor: 'transparent',
  },
  optionsContainer: {
    flex: 1,
    paddingHorizontal: 24,
    marginTop: 8,
    paddingBottom: 48,
  },
  animationWrapper: {
    flex: 1,
    justifyContent: 'center',
  },
  bottomBlock: {
    justifyContent: 'flex-end',
  },
  explainerTitle: {
    fontFamily: 'PlusJakartaSans-ExtraBold',
    fontSize: 20,
    color: '#363228',
    textAlign: 'center',
    marginBottom: 8,
  },
  explainerText: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 14,
    color: '#645e53',
    textAlign: 'center',
    lineHeight: 22,
  },
  optionsPrompt: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 14,
    color: '#807a6d',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 20,
    textAlign: 'center',
  },
  explainerWrapper: {
    marginBottom: 32,
  },
  scanModeContainer: {
    flex: 1,
    paddingHorizontal: 24,
    paddingBottom: 48,
  },
  cameraSubtitle: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 14,
    color: '#fff8f0',
    textAlign: 'center',
    marginBottom: 16,
  },
  torchButton: {
    marginTop: 24,
  },
  backButton: {
    marginTop: 16,
  },
  manualEntryContainer: {
    padding: 24,
    paddingBottom: 48,
  },
  expired: {
    opacity: 0.5,
  },
  expiredText: {
    color: '#ba1a1a',
  },
  countdownContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 20,
    marginBottom: 50,
  },
  countdownText: {
    fontFamily: 'Manrope-Medium',
    fontSize: 14,
    color: '#807a6d',
    letterSpacing: 0.5,
  },
  countdownExpired: {
    color: '#ba1a1a',
    fontFamily: 'PlusJakartaSans-Bold',
  },
  countdownDigits: {
    color: '#486730',
    fontFamily: 'PlusJakartaSans-Bold',
  },
});
