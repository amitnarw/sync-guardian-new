import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Markdown from 'react-native-markdown-display';
import { getLegalDocument, type LegalKey, type LegalDocument } from '@/services/legal-api';

const C = {
  primary: '#44674d',
  surface: '#fff8f0',
  surfaceContainerLowest: '#ffffff',
  onSurface: '#363228',
  onSurfaceVariant: '#645e53',
  outline: '#807a6d',
} as const;

export default function LegalDocumentScreen() {
  const { key } = useLocalSearchParams<{ key: LegalKey }>();
  const [doc, setDoc] = useState<LegalDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!key) return;
    setLoading(true);
    setError(null);
    getLegalDocument(key)
      .then((d) => { if (!cancelled) setDoc(d); })
      .catch(() => { if (!cancelled) setError('Document not available. Please try again later.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [key]);

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={24} color={C.onSurface} />
        </TouchableOpacity>
        <Text style={s.headerTitle} numberOfLines={1}>{doc?.title || 'Document'}</Text>
        <View style={s.headerSpacer} />
      </View>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator color={C.primary} size="large" />
        </View>
      ) : error ? (
        <View style={s.center}>
          <Ionicons name="alert-circle-outline" size={40} color={C.outline} />
          <Text style={s.errorText}>{error}</Text>
          <TouchableOpacity style={s.retryBtn} onPress={() => {
            setLoading(true);
            setError(null);
            if (key) {
              getLegalDocument(key)
                .then(setDoc)
                .catch(() => setError('Document not available. Please try again later.'))
                .finally(() => setLoading(false));
            }
          }}>
            <Text style={s.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : doc ? (
        <ScrollView contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
          <Markdown style={mdStyles}>{doc.content}</Markdown>
        </ScrollView>
      ) : null}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.surface },
  header: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 8, gap: 12,
  },
  headerTitle: { fontFamily: 'PlusJakartaSans-Bold', fontSize: 18, color: C.onSurface, flex: 1 },
  headerSpacer: { width: 24 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, padding: 32 },
  errorText: { fontFamily: 'PlusJakartaSans-Medium', fontSize: 14, color: C.outline, textAlign: 'center' },
  retryBtn: { backgroundColor: C.primary, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 9999 },
  retryBtnText: { fontFamily: 'PlusJakartaSans-Bold', fontSize: 13, color: '#ffffff' },
  scrollContent: { paddingHorizontal: 24, paddingBottom: 120 },
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
    fontSize: 24,
    lineHeight: 30,
    color: C.onSurface,
    marginTop: 16,
    marginBottom: 8,
  },
  heading2: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 18,
    lineHeight: 24,
    color: C.onSurface,
    marginTop: 12,
    marginBottom: 6,
  },
  paragraph: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 14,
    lineHeight: 22,
    color: C.onSurface,
    marginBottom: 8,
  },
  bullet_list: {
    marginBottom: 8,
  },
  list_item: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 14,
    lineHeight: 22,
    color: C.onSurface,
  },
  strong: {
    fontFamily: 'PlusJakartaSans-Bold',
    color: C.onSurface,
  },
  link: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 14,
    color: C.primary,
    textDecorationLine: 'underline' as const,
  },
};
