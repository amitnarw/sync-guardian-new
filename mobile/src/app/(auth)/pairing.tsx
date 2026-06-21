import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, ActivityIndicator, Alert, Dimensions, KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Keyboard, Modal, ScrollView } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { router } from 'expo-router';
import { useAuthStore } from '@/hooks/use-auth-store';
import QRCode from 'react-native-qrcode-svg';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { supabase } from '@/lib/supabase';

import { MaterialIcons } from '@expo/vector-icons';
import { Button } from '@/components/ui/button';
import { OtpInput } from '@/components/ui/otp-input';
import { SyncAnimation } from '@/components/ui/sync-animation';
import { ErrorModal } from '@/components/ui/error-modal';

const { width } = Dimensions.get('window');

export default function PairingScreen() {
  const { userRole, setUserRole, setPairId, setDeviceId } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [pairingData, setPairingData] = useState<{ code: string; token: string } | null>(null);
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
      generatePairingToken();
    } else {
      setLoading(false);
    }
  }, [userRole]);

  // Listen for the parent device claiming the token
  useEffect(() => {
    if (!pairingData?.token) return;

    const channel = supabase
      .channel('pairing-watch')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'pairing_tokens',
          filter: `token=eq.${pairingData.token}`,
        },
        (payload: any) => {
          if (payload.new && payload.new.consumed_at) {
            setPairId(payload.new.pair_id);
            router.replace('/onboarding');
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
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
    } catch (err: any) {
      let msg = err.message || 'Failed to generate token';
      
      if (msg.includes('non-2xx')) {
        msg = 'Backend rejected the request. Please try again.';
      } else if (msg.includes('failed to send a request')) {
        msg = 'Could not connect to the server. Please ensure your backend is running.';
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
    // Assuming data is the token or a JSON string with the token
    let tokenToVerify = data;
    try {
      const parsed = JSON.parse(data);
      if (parsed.token) tokenToVerify = parsed.token;
    } catch (e) {
      // It's not JSON, assume raw token string
    }
    verifyToken(tokenToVerify);
  };

  const verifyToken = async (tokenOrCode: string) => {
    try {
      setIsVerifying(true);

      // We call the edge function `claim-pairing-token`
      const payload = {
        device_name: 'Parent Device'
      } as any;

      // Determine if tokenOrCode is a UUID or a 6 digit code
      if (tokenOrCode.length === 6) {
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
      router.replace('/onboarding');
    } catch (err: any) {
      let msg = err.message || 'Failed to verify token';
      
      if (msg.includes('non-2xx')) {
        msg = 'Invalid or expired code. Please verify the code on the child device and try again.';
      } else if (msg.includes('failed to send a request')) {
        msg = 'Could not connect to the server. Please ensure your backend is running.';
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
                  value={JSON.stringify({ token: pairingData.token, code: pairingData.code })}
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
            <Text style={styles.subtitle}>Secure your family's digital environment</Text>
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
                    Sync Guardian creates a secure, real-time connection to your child's phone. Once paired, you can monitor their notifications seamlessly.
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
