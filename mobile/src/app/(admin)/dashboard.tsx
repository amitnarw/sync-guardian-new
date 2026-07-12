import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { AuthColors, AuthFonts } from '@/constants/auth-theme';
import { EdgeFadeScrollView } from '@/components/ui/edge-fade';

export default function AdminDashboard() {
  return (
    <SafeAreaView style={s.safeArea} edges={['top']}>
      <View style={s.header}>
        <View style={s.headerLogo}>
          <MaterialIcons name="spa" size={24} color={AuthColors.primary} />
          <Text style={s.headerTitle}>Sync Guardian Admin</Text>
        </View>
      </View>

      <EdgeFadeScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <Text style={s.title}>Admin Console</Text>
        <Text style={s.subtitle}>
          This account is an administrator. Monitoring and pairing controls live here.
        </Text>

        <View style={s.card}>
          <MaterialIcons name="admin-panel-settings" size={28} color={AuthColors.primary} />
          <Text style={s.cardTitle}>System Status</Text>
          <Text style={s.cardText}>Review device pairs, notifications, and delivery logs.</Text>
        </View>

        <View style={s.card}>
          <MaterialIcons name="people" size={28} color={AuthColors.primary} />
          <Text style={s.cardTitle}>Accounts</Text>
          <Text style={s.cardText}>Manage parent and child accounts and their setup state.</Text>
        </View>
      </EdgeFadeScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: AuthColors.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  headerLogo: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { ...AuthFonts.titleMedium, color: AuthColors.primary },
  content: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 32 },
  title: { ...AuthFonts.headlineMedium, color: AuthColors.onSurface, marginBottom: 8 },
  subtitle: { ...AuthFonts.bodyMedium, color: AuthColors.onSurfaceVariant, marginBottom: 24, lineHeight: 22 },
  card: {
    backgroundColor: AuthColors.surfaceContainerLow,
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
    gap: 8,
  },
  cardTitle: { ...AuthFonts.titleSmall, color: AuthColors.onSurface },
  cardText: { ...AuthFonts.bodyMedium, color: AuthColors.onSurfaceVariant, lineHeight: 20 },
});
