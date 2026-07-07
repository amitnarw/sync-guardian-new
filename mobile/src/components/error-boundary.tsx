import React, { Component, type ReactNode } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

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

  componentDidCatch(error: Error, info: { componentStack?: string }) {
    console.error('ErrorBoundary caught:', error, info?.componentStack);
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
    backgroundColor: '#fff8f0',
  },
  title: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 20,
    color: '#1b1d0e',
    marginBottom: 12,
  },
  message: {
    fontFamily: 'Manrope-Regular',
    fontSize: 14,
    color: '#43483d',
    textAlign: 'center',
    marginBottom: 24,
  },
  button: {
    backgroundColor: '#486730',
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
