import { useEffect } from 'react';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/hooks/use-auth-store';

WebBrowser.maybeCompleteAuthSession();

export function useAuth() {
  const {
    setIsAuthenticated,
    setUserId,
    setEmail,
    email,
    userRole,
    resetAuth,
  } = useAuthStore();

  // Restore session on mount and listen for auth changes
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setIsAuthenticated(true);
        setUserId(session.user.id);
        setEmail(session.user.email ?? null);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          setIsAuthenticated(true);
          setUserId(session?.user.id ?? null);
          setEmail(session?.user.email ?? null);
        } else if (event === 'SIGNED_OUT') {
          resetAuth();
          router.replace('/login');
        }
      },
    );

    return () => subscription.unsubscribe();
  }, []);

  const signInWithEmail = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    setIsAuthenticated(true);
    setUserId(data.user.id);
    setEmail(data.user.email ?? null);
  };

  const signUpWithEmail = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });
    if (error) throw error;
    // signUp creates the user but may require email confirmation
    // If session available immediately (no confirmation), set auth
    if (data.session) {
      setIsAuthenticated(true);
      if (data.user) {
        setUserId(data.user.id);
        setEmail(data.user.email ?? null);
      }
    }
    return data;
  };

  const signInWithGoogle = async () => {
    const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
    const androidClientId = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID;

    if (!webClientId || !androidClientId) {
      throw new Error(
        'Google sign-in needs setup. Please check your settings.'
      );
    }

    const redirectUrl = makeRedirectUri();

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl,
      },
    });

    if (error) throw error;
    if (!data?.url) throw new Error('Sign-in link did not load. Please try again.');

    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);

    if (result.type !== 'success') {
      throw new Error('Sign-in was cancelled.');
    }

    const redirectUrlStr = result.url;

    // Check the redirect URL for both PKCE code and implicit token formats
    let code: string | null = null;
    let accessToken: string | null = null;
    let refreshToken: string | null = null;

    if (redirectUrlStr.includes('?')) {
      const qs = redirectUrlStr.split('?')[1].split('#')[0];
      const searchParams = new URLSearchParams(qs);
      code = searchParams.get('code');
    }

    if (redirectUrlStr.includes('#')) {
      const fragment = redirectUrlStr.split('#')[1].split('?')[0];
      const fragParams = new URLSearchParams(fragment);
      accessToken = fragParams.get('access_token');
      refreshToken = fragParams.get('refresh_token');
    }

    if (code) {
      const { data: sessionData, error: sessionError } =
        await supabase.auth.exchangeCodeForSession(code);
      if (sessionError) {
        console.error('exchangeCodeForSession error:', sessionError, 'redirectUrl:', redirectUrlStr);
        throw new Error('Google sign-in was not allowed for this account. Try a different account.');
      }
      if (!sessionData?.session) throw new Error('Could not sign in. Please try again.');
      setIsAuthenticated(true);
      setUserId(sessionData.session.user.id);
      setEmail(sessionData.session.user.email ?? null);
    } else if (accessToken && refreshToken) {
      const { data: sessionData, error: sessionError } =
        await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
      if (sessionError) {
        console.error('setSession error:', sessionError, 'redirectUrl:', redirectUrlStr);
        throw new Error('Google sign-in was not allowed for this account. Try a different account.');
      }
      if (!sessionData?.session) throw new Error('Could not sign in. Please try again.');
      setIsAuthenticated(true);
      setUserId(sessionData.session.user.id);
      setEmail(sessionData.session.user.email ?? null);
    } else {
      const qs = redirectUrlStr.split('?')[1]?.split('#')[0];
      const errParams = qs ? new URLSearchParams(qs) : null;
      const errorDesc = errParams?.get('error_description') || errParams?.get('error');
      throw new Error(errorDesc || 'Sign-in did not complete. Please try again.');
    }
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    resetAuth();
    router.replace('/login');
  };

  return {
    signInWithEmail,
    signUpWithEmail,
    signInWithGoogle,
    signOut,
  };
}
