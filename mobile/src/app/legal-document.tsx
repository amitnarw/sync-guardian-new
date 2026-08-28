import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Markdown from 'react-native-markdown-display';
import { EdgeFadeScrollView } from '@/components/ui/edge-fade';
import { getLegalDocument, type LegalKey, type LegalDocument } from '@/services/legal-api';

const C = {
  primary: '#44674d',
  primaryContainer: '#c5eccc',
  onPrimary: '#e8ffea',
  tertiary: '#44674e',
  tertiaryContainer: '#d3fbda',
  surface: '#fff8f0',
  surfaceContainerLow: '#faf3e7',
  surfaceContainerHigh: '#efe7da',
  surfaceContainerHighest: '#eae1d2',
  surfaceContainerLowest: '#ffffff',
  onSurface: '#363228',
  onSurfaceVariant: '#645e53',
  outline: '#807a6d',
  outlineVariant: '#b9b1a3',
  white: '#ffffff',
} as const;

export default function LegalDocumentScreen() {
  const params = useLocalSearchParams<{ key?: string; doc?: string }>();
  const rawKey = params.key || params.doc || 'privacy';
  const key = (['privacy', 'terms', 'licenses'].includes(rawKey) ? rawKey : 'privacy') as LegalKey;

  const [doc, setDoc] = useState<LegalDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getLegalDocument(key)
      .then((d) => {
        if (!cancelled) setDoc(d);
      })
      .catch(() => {
        if (!cancelled) setError('Document not available. Please try again later.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [key]);

  const docTitle = doc?.title || (key === 'privacy' ? 'Privacy Policy' : 'Terms of Service');
  const iconName = key === 'privacy' ? 'shield-checkmark' : 'document-text';

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      {/* Background ambient glow */}
      <View style={s.ambientBg}>
        <LinearGradient
          colors={['rgba(197, 236, 204, 0.35)', 'transparent']}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
      </View>

      {/* Top Header with Centered Title (Matching Image 2) */}
      <View style={s.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={10}
          style={s.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Ionicons name="chevron-back" size={24} color={C.onSurface} />
        </TouchableOpacity>
        <Text style={s.headerTitle} numberOfLines={1}>{docTitle}</Text>
        <View style={s.headerRightSpacer} />
      </View>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator color={C.primary} size="large" />
          <Text style={s.loadingText}>Loading document...</Text>
        </View>
      ) : error ? (
        <View style={s.center}>
          <View style={s.errorIconCircle}>
            <Ionicons name="alert-circle-outline" size={32} color={C.primary} />
          </View>
          <Text style={s.errorText}>{error}</Text>
          <TouchableOpacity
            style={s.retryBtn}
            onPress={() => {
              setLoading(true);
              setError(null);
              getLegalDocument(key)
                .then(setDoc)
                .catch(() => setError('Document not available. Please try again later.'))
                .finally(() => setLoading(false));
            }}
          >
            <Text style={s.retryBtnText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : doc ? (
        <EdgeFadeScrollView contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Hero Banner Card */}
          <View style={s.heroCard}>
            <View style={s.heroTopRow}>
              <View style={s.heroIconWrap}>
                <Ionicons name={iconName} size={24} color={C.primary} />
              </View>
              <View style={s.badgePill}>
                <Text style={s.badgeText}>OFFICIAL DOCUMENT</Text>
              </View>
            </View>
            <Text style={s.heroTitle}>{doc.title}</Text>
            <View style={s.updatedRow}>
              <Ionicons name="time-outline" size={14} color={C.outline} />
              <Text style={s.updatedText}>
                Last updated {new Date(doc.updated_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </Text>
            </View>
          </View>

          {/* Document Content Card */}
          <View style={s.contentCard}>
            <Markdown style={mdStyles}>{doc.content}</Markdown>
          </View>

          {/* Trust & Guarantee Footer Card */}
          <View style={s.trustCard}>
            <Ionicons name="lock-closed" size={20} color={C.primary} />
            <View style={s.trustTextWrap}>
              <Text style={s.trustTitle}>End-to-End Encrypted Protection</Text>
              <Text style={s.trustDesc}>Your family&apos;s data privacy is guaranteed with per-pair AES-256 keys.</Text>
            </View>
          </View>

          <Text style={s.footerNote}>Sync Guardian · Security & Transparency</Text>
        </EdgeFadeScrollView>
      ) : null}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.surface },
  ambientBg: {
    ...StyleSheet.absoluteFillObject,
    height: 300,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 18,
    color: C.onSurface,
    textAlign: 'center',
    flex: 1,
  },
  headerRightSpacer: { width: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 14, padding: 32 },
  loadingText: { fontFamily: 'PlusJakartaSans-Medium', fontSize: 14, color: C.onSurfaceVariant },
  errorIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: C.primaryContainer,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: { fontFamily: 'PlusJakartaSans-Medium', fontSize: 14, color: C.outline, textAlign: 'center', lineHeight: 20 },
  retryBtn: { backgroundColor: C.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 9999 },
  retryBtnText: { fontFamily: 'PlusJakartaSans-Bold', fontSize: 13, color: '#ffffff' },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 60, paddingTop: 6, gap: 16 },

  heroCard: {
    backgroundColor: C.surfaceContainerLowest,
    borderRadius: 28,
    padding: 22,
    shadowColor: '#363228',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 14,
    elevation: 2,
    gap: 8,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  heroIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: C.primaryContainer,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgePill: {
    backgroundColor: C.surfaceContainerHigh,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 9999,
  },
  badgeText: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 10,
    color: C.primary,
    letterSpacing: 0.5,
  },
  heroTitle: {
    fontFamily: 'PlusJakartaSans-ExtraBold',
    fontSize: 22,
    color: C.onSurface,
    lineHeight: 28,
  },
  updatedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  updatedText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    color: C.outline,
  },

  contentCard: {
    backgroundColor: C.surfaceContainerLowest,
    borderRadius: 28,
    padding: 22,
    shadowColor: '#363228',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
  },

  trustCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: C.primaryContainer,
    borderRadius: 20,
    padding: 16,
  },
  trustTextWrap: { flex: 1, gap: 2 },
  trustTitle: { fontFamily: 'PlusJakartaSans-Bold', fontSize: 13, color: C.onSurface },
  trustDesc: { fontFamily: 'PlusJakartaSans-Regular', fontSize: 11.5, color: C.onSurfaceVariant, lineHeight: 16 },

  footerNote: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 12,
    color: C.outline,
    textAlign: 'center',
    marginTop: 8,
  },
});

const mdStyles = {
  body: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 14,
    lineHeight: 22,
    color: C.onSurface,
  },
  heading1: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 20,
    lineHeight: 26,
    color: C.onSurface,
    marginTop: 12,
    marginBottom: 8,
  },
  heading2: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 16,
    lineHeight: 22,
    color: C.primary,
    marginTop: 14,
    marginBottom: 6,
  },
  heading3: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 14.5,
    lineHeight: 20,
    color: C.onSurface,
    marginTop: 12,
    marginBottom: 4,
  },
  paragraph: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 13.5,
    lineHeight: 21,
    color: C.onSurfaceVariant,
    marginBottom: 10,
  },
  bullet_list: {
    marginBottom: 10,
  },
  list_item: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 13.5,
    lineHeight: 21,
    color: C.onSurfaceVariant,
    marginBottom: 4,
  },
  strong: {
    fontFamily: 'PlusJakartaSans-Bold',
    color: C.onSurface,
  },
  link: {
    fontFamily: 'PlusJakartaSans-SemiBold',
    fontSize: 13.5,
    color: C.primary,
    textDecorationLine: 'underline' as const,
  },
};
