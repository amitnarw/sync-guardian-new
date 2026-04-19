import { useState } from 'react';
import { StyleSheet, View, Text, Pressable, KeyboardAvoidingView, Platform } from 'react-native';
import { router } from 'expo-router';
import { MaterialIcons } from '@/components/auth/icon';
import { useAuthTheme } from '@/hooks/use-auth-theme';
import { useAuthStore } from '@/hooks/use-auth-store';
import { OrganicInput } from '@/components/auth/organic-input';
import { OrganicButton } from '@/components/auth/organic-button';

export default function LoginScreen() {
  const colors = useAuthTheme();
  const { userRole, setIsAuthenticated } = useAuthStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async () => {
    setIsLoading(true);
    // Simulate login delay
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setIsAuthenticated(true);

    // If parent, go to onboarding. If child, go to app.
    if (userRole === 'parent' && !useAuthStore.getState().hasCompletedOnboarding) {
      router.replace('/onboarding');
    } else {
      router.replace('/home');
    }
    setIsLoading(false);
  };

  const handleForgotPassword = () => {
    // TODO: Implement forgot password flow
    console.log('Forgot password');
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      {/* Logo */}
      <View style={styles.logoContainer}>
        <View style={[styles.logoCircle, { backgroundColor: colors.primaryContainer }]}>
          <MaterialIcons name="spa" size={48} color={colors.primary} />
        </View>
      </View>

      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.heading, { color: colors.onSurface }]}>Welcome Back</Text>
        <Text style={[styles.subtitle, { color: colors.onSurfaceVariant }]}>
          Enter your sanctuary
        </Text>
      </View>

      {/* Form */}
      <View style={styles.form}>
        <OrganicInput
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          icon="mail"
          keyboardType="email-address"
          autoCapitalize="none"
          style={styles.input}
          testID="login-email-input"
        />
        <OrganicInput
          placeholder="Password"
          value={password}
          onChangeText={setPassword}
          icon="lock"
          secureTextEntry
          style={styles.input}
          testID="login-password-input"
        />

        <Pressable onPress={handleForgotPassword} style={styles.forgotPassword} testID="login-forgot-password">
          <Text style={[styles.forgotPasswordText, { color: colors.primary }]}>
            Forgot Password?
          </Text>
        </Pressable>

        <OrganicButton
          title="Login"
          onPress={handleLogin}
          disabled={isLoading}
          style={styles.loginButton}
          testID="login-submit-button"
        />
      </View>

      {/* Divider */}
      <View style={styles.dividerContainer}>
        <View style={[styles.dividerLine, { backgroundColor: colors.outlineVariant }]} />
        <Text style={[styles.dividerText, { color: colors.onSurfaceVariant }]}>
          Or Sanctuary Access
        </Text>
        <View style={[styles.dividerLine, { backgroundColor: colors.outlineVariant }]} />
      </View>

      {/* Social Buttons */}
      <View style={styles.socialButtons}>
        <Pressable style={[styles.socialButton, { backgroundColor: colors.surfaceContainerHigh }]} testID="login-google-button">
          <MaterialIcons name="mail" size={24} color={colors.onSurface} />
          <Text style={[styles.socialButtonText, { color: colors.onSurface }]}>Google</Text>
        </Pressable>
        <Pressable style={[styles.socialButton, { backgroundColor: colors.surfaceContainerHigh }]} testID="login-apple-button">
          <MaterialIcons name="apple" size={24} color={colors.onSurface} />
          <Text style={[styles.socialButtonText, { color: colors.onSurface }]}>iOS</Text>
        </Pressable>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <MaterialIcons name="shield" size={16} color={colors.onSurfaceVariant} />
        <Text style={[styles.footerText, { color: colors.onSurfaceVariant }]}>
          Encrypted Space
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 60,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  heading: {
    fontSize: 28,
    fontWeight: '600',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '400',
  },
  form: {
    gap: 16,
  },
  input: {
    marginBottom: 0,
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginBottom: 16,
  },
  forgotPasswordText: {
    fontSize: 14,
    fontWeight: '500',
  },
  loginButton: {
    marginTop: 8,
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 32,
    gap: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    fontSize: 14,
    fontWeight: '400',
  },
  socialButtons: {
    flexDirection: 'row',
    gap: 16,
  },
  socialButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 9999,
  },
  socialButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 32,
    paddingBottom: 32,
  },
  footerText: {
    fontSize: 12,
    fontWeight: '400',
  },
});