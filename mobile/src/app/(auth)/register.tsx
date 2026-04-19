import { useState, useEffect } from 'react';
import { StyleSheet, View, Text, Pressable, KeyboardAvoidingView, Platform, TextInput, Image } from 'react-native';
import { router } from 'expo-router';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { MaterialIcons, AntDesign } from '@expo/vector-icons';
import { useAuthStore } from '@/hooks/use-auth-store';
import Svg, { Path } from 'react-native-svg';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';


// Generic Hearth Shape
const hearthShapeBlock = "M153.6 0 C 210.16 0 256 57.3 256 128 C 256 212.8 175.7 256 76.8 256 C 34.39 256 0 175.73 0 102.4 C 0 34.39 68.76 0 153.6 0 Z";

export default function RegisterScreen() {
  const { userRole, setIsAuthenticated, setHasCompletedOnboarding } = useAuthStore();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const screenOpacity = useSharedValue(0);

  useEffect(() => {
    screenOpacity.value = withTiming(1, { duration: 600 });
  }, []);

  const handleRegister = async () => {
    // Simulate registration
    setIsAuthenticated(true);
    setHasCompletedOnboarding(false); // New users go through onboarding

    router.replace('/onboarding');
  };

  const animatedScreenStyle = useAnimatedStyle(() => ({ opacity: screenOpacity.value }));

  return (
    <Animated.View style={[styles.container, animatedScreenStyle]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.innerContainer}
      >
      {/* Background SVG Blobs */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Svg width={192} height={192} viewBox="0 0 256 256" style={{ position: 'absolute', top: -64, left: -48, opacity: 0.15 }}>
          <Path d={hearthShapeBlock} fill="#c5eccc" />
        </Svg>
        <Svg width={256} height={256} viewBox="0 0 256 256" style={{ position: 'absolute', top: 0, right: -128, marginTop: -128, opacity: 0.15, transform: [{ rotate: '45deg' }] }}>
          <Path d={hearthShapeBlock} fill="#ffdad3" />
        </Svg>
        <Svg width={384} height={384} viewBox="0 0 256 256" style={{ position: 'absolute', bottom: -192, left: -192, opacity: 0.15, transform: [{ rotate: '120deg' }] }}>
          <Path d={hearthShapeBlock} fill="#d3fbda" />
        </Svg>
      </View>

      <View style={styles.fixedContent}>
        {/* Header Identity */}
        <View style={styles.headerArea}>
          <View style={styles.headerLogoCircle}>
            <MaterialIcons name="spa" size={32} color="#e8ffea" />
          </View>
          <Text style={styles.welcomeText}>Join the Sanctuary</Text>
          <Text style={styles.subWelcomeText}>Create your family account</Text>
        </View>

        {/* Form Module */}
        <View style={styles.formArea}>
          <Input
            label="Full Name"
            placeholder="John Doe"
            icon="person"
            value={name}
            onChangeText={setName}
          />
          <Input
            label="Email Address"
            placeholder="hello@sanctuary.com"
            icon="mail"
            value={email}
            onChangeText={setEmail}
          />
          <Input
            label="Password"
            placeholder="••••••••"
            icon="lock"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          {/* Core Action */}
          <View style={styles.actionsBox}>
            <Button
              title="Create Account"
              onPress={handleRegister}
              icon="arrow-forward"
            />

            <View style={styles.createAccountBox}>
              <Text style={styles.newToText}>Already have an account?</Text>
              <Pressable onPress={() => router.push('/login')}>
                <Text style={styles.createAccountLink}>Login to Sanctuary</Text>
              </Pressable>
            </View>
          </View>
        </View>

        {/* Social Links Footer */}
        <View style={styles.footerArea}>
          <View style={styles.dividerBox}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>Quick Access</Text>
            <View style={styles.dividerLine} />
          </View>
          <View style={styles.socialGrid}>
            <Button 
               imageSource={{ uri: 'https://img.icons8.com/color/48/000000/google-logo.png' }}
               onPress={() => {}}
               variant="secondary"
               style={styles.socialBtnSingle}
            />
          </View>
        </View>
      </View>

    </KeyboardAvoidingView>
  </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff8f0', // AuthColors.surface
  },
  fixedContent: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerArea: {
    width: '100%',
    maxWidth: 448,
    alignItems: 'flex-start',
    marginBottom: 32, // Slightly reduced to fit 3 inputs
  },
  headerLogoCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#44674d',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: '#44674d',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 6,
  },
  welcomeText: {
    color: '#363228',
    fontFamily: 'PlusJakartaSans-ExtraBold',
    fontWeight: '800',
    fontSize: 32, // Slightly smaller to fit content
    lineHeight: 38,
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  subWelcomeText: {
    color: '#645e53',
    fontFamily: 'PlusJakartaSans-Medium',
    fontWeight: '500',
    fontSize: 16,
  },
  formArea: {
    width: '100%',
    maxWidth: 448,
    gap: 16, // Reduced gap as requested
  },
  actionsBox: {
    width: '100%',
    paddingTop: 16,
    gap: 20,
  },
  createAccountBox: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: 8,
  },
  newToText: {
    color: 'rgba(100, 94, 83, 0.6)',
    fontFamily: 'PlusJakartaSans-Medium',
    fontWeight: '500',
    fontSize: 14,
  },
  createAccountLink: {
    color: '#44674d',
    fontFamily: 'PlusJakartaSans-Bold',
    fontWeight: '700',
    fontSize: 14,
    textDecorationLine: 'underline',
  },
  footerArea: {
    width: '100%',
    maxWidth: 448,
    marginTop: 24,
    gap: 16,
  },
  dividerBox: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    gap: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#eae1d2',
  },
  dividerText: {
    color: '#807a6d',
    fontFamily: 'PlusJakartaSans-Bold',
    fontWeight: '700',
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 2.4,
  },
  socialGrid: {
    flexDirection: 'row',
    width: '100%',
  },
  socialBtnSingle: {
    flex: 1,
    height: 50,
    backgroundColor: '#eae1d2',
    borderRadius: 25, // Standardized to half of height for rounded look
    alignItems: 'center',
    justifyContent: 'center',
  },
  innerContainer: {
    flex: 1,
    width: '100%',
  },
});
