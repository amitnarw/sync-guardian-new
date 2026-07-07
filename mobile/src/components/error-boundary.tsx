import React, { Component, type ReactNode } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { AuthColors } from '@/constants/auth-theme';
import { logger } from '@/services/logger';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error) {
    logger.error('ErrorBoundary caught:', error);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.message}>
            {this.state.error?.message || 'An unexpected error occurred.'}
          </Text>
          <TouchableOpacity style={styles.button} onPress={this.handleReset}>
            <Text style={styles.buttonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: AuthColors.background,
  },
  title: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 20,
    color: AuthColors.onSurface,
    marginBottom: 12,
  },
  message: {
    fontFamily: 'Manrope-Regular',
    fontSize: 14,
    color: AuthColors.onSurfaceVariant,
    textAlign: 'center',
    marginBottom: 24,
  },
  button: {
    backgroundColor: AuthColors.primary,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 9999,
  },
  buttonText: {
    fontFamily: 'PlusJakartaSans-SemiBold',
    fontSize: 15,
    color: '#ffffff',
  },
});
