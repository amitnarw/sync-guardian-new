import React, { useState, useEffect } from 'react';
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
  const [pairingData, setPairingData] = useState<{ code: string; token: string; child_device_id: string; qr_jwt: string } | null>(null);
  const [manualCode, setManualCode] = useState('');
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [parentMode, setParentMode] = useState<'options' | 'scan' | 'manual'>('options');
  const [torch, setTorch] = useState(false);

  const [errorModalVisible, setErrorModalVisible] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

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

  // Listen for the parent device claiming the token (realtime + polling fallback)
  useEffect(() => {
    if (!pairingData?.token) return;

    let cancelled = false;

    const checkToken = async () => {
      if (cancelled) return;

      const { data, error } = await supabase
        .from('pairing_tokens')
        .select('consumed_at, pair_id')
        .eq('token', pairingData.token)
        .maybeSingle();

      if (error) {
        logger.error('Pairing: polling query error:', error);
        return false;
      }

      logger.debug('Pairing: polling result received');

      if (data?.consumed_at) {
        let newPairId = data.pair_id;

        // If pair_id is null (edge case), fallback to querying pairs by child_device_id
        if (!newPairId && pairingData.child_device_id) {
          logger.debug('Pairing: pair_id null, looking up by child_device_id');
          const { data: pairData } = await supabase
            .from('pairs')
            .select('id')
            .eq('child_device_id', pairingData.child_device_id)
            .in('status', ['active', 'pending'])
            .limit(1);
          if (pairData && pairData.length > 0) {
            newPairId = pairData[0].id;
            logger.debug('Pairing: found pair via fallback');
          }
        }

        if (newPairId) {
          setPairId(newPairId);
          router.replace('/onboarding');
          return true;
        } else {
          logger.warn('Pairing: token consumed but no pair_id found');
        }
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
  }, [pairingData]);

  const generatePairingToken = async () => {
    try {
      setLoading(true);
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
      setLoading(false);
    }
  };

  const handleBarcodeScanned = ({ type, data }: { type: string; data: string }) => {
    if (scanned) return;
    setScanned(true);
    verifyToken(data);
  };

  const verifyToken = async (tokenOrCode: string) => {
    try {
      setIsVerifying(true);

      const payload: Record<string, string> = {
        device_name: 'Parent Device'
      };

      if (tokenOrCode.length === 6) {
        payload.code = tokenOrCode;
      } else if (tokenOrCode.includes('.')) {
        payload.qr_jwt = tokenOrCode;
      } else {
        payload.token = tokenOrCode;
      }

      const { data, error } = await supabase.functions.invoke('claim-pairing-token', {
        body: payload,
      });

      if (error) throw error;

      setDeviceId(data.data.parent_device_id);
      setPairId(data.data.id);
      router.replace('/onboarding');
    } catch (err: unknown) {
      let msg = 'Could not complete pairing. Please check the code and try again.';

      if (err instanceof FunctionsHttpError) {
        try {
          const body = await err.context.text();
          logger.error('claim-pairing-token failed, status:', err.context.status);
          const parsed = JSON.parse(body);
          msg = parsed.error || msg;
        } catch {
          logger.error('claim-pairing-token response:', err.context.status, err.context.statusText);
        }
      } else if (err instanceof Error) {
        logger.error('claim-pairing-token error:', err.message);
        msg = err.message;
      }

      if (msg.includes('failed to send a request')) {
        msg = 'Could not connect. Please check your internet.';
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
              <View style={styles.qrWrapper}>
                <QRCode
                  value={pairingData.qr_jwt}
                  size={200}
                  color="#363228"
                  backgroundColor="#ffffff"
                />
              </View>
              <Text style={styles.orText}>OR ENTER CODE</Text>
              <View style={styles.codeWrapper}>
                <Text style={styles.codeText}>{pairingData.code}</Text>
              </View>
            </>
          ) : (
            <Button title="Retry Generation" onPress={generatePairingToken} variant="secondary" />
          )}

          <Button
            title="Go Back"
            variant="secondary"
            onPress={() => {
              setUserRole(null);
              router.replace('/role-selection');
            }}
            style={{ marginTop: 24 }}
          />
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
    paddingTop: 80,
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
    backgroundColor: '#eae1d2',
    borderRadius: 16,
  },
  codeText: {
    fontFamily: 'PlusJakartaSans-ExtraBold',
    fontSize: 32,
    color: '#363228',
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
});
