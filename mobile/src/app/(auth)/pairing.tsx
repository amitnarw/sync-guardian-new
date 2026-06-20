import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, ActivityIndicator, Alert, Dimensions, KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Keyboard, Modal } from 'react-native';
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

const { width } = Dimensions.get('window');

export default function PairingScreen() {
  const { userRole, setPairId, setDeviceId } = useAuthStore();
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

  const generatePairingToken = async () => {
    try {
      setLoading(true);
      // Dummy generated ID for the device
      const newDeviceId = 'child-dev-' + Math.random().toString(36).substring(7);
      setDeviceId(newDeviceId);

      const { data, error } = await supabase.functions.invoke('create-pairing-token', {
        body: { deviceId: newDeviceId, deviceName: 'Child Device' },
      });

      if (error) throw error;
      setPairingData(data);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to generate token');
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
      const newDeviceId = 'parent-dev-' + Math.random().toString(36).substring(7);
      setDeviceId(newDeviceId);

      // We call the edge function `claim-pairing-token`
      const payload = {
        parent_device_id: newDeviceId,
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

      setPairId(data.data.id);
      router.replace('/onboarding');
    } catch (err: any) {
      const msg = err.message?.includes('non-2xx') 
        ? 'Invalid or expired code. Please verify the code on the child device and try again.'
        : err.message || 'Failed to verify token';
        
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
      <View style={styles.container}>
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
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
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
      </TouchableWithoutFeedback>

      <Modal
        visible={errorModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setErrorModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalIconContainer}>
              <MaterialIcons name="error-outline" size={32} color="#cc3333" />
            </View>
            <Text style={styles.modalTitle}>Pairing Failed</Text>
            <Text style={styles.modalText}>{errorMessage}</Text>
            <Button
              title="Got it"
              onPress={() => setErrorModalVisible(false)}
              style={styles.modalButton}
            />
          </View>
        </View>
      </Modal>
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
    flex: 1,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#fff8f0',
    borderRadius: 24,
    padding: 32,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#363228',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 8,
  },
  modalIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#ffe6e6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontFamily: 'PlusJakartaSans-ExtraBold',
    fontSize: 24,
    color: '#363228',
    marginBottom: 12,
    textAlign: 'center',
  },
  modalText: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 16,
    color: '#645e53',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  modalButton: {
    width: '100%',
  },
});
