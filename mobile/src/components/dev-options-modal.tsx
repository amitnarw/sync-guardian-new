import React, { useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Pressable,
  ScrollView,
  BackHandler,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { isValidUUID } from '@/lib/uuid';
import { useAuthStore } from '@/hooks/use-auth-store';
import { resolveParentDeviceId, resolveChildDeviceId } from '@/lib/device-recovery';
import { AuthColors, AuthFonts, AuthRadius } from '@/constants/auth-theme';

interface DeviceRow {
  id: string;
  role: string;
  user_id: string;
  last_seen_at: string | null;
  is_foreground: boolean | null;
}
interface PairRow {
  id: string;
  parent_device_id: string;
  child_device_id: string;
  parent_user_id: string;
  child_user_id: string;
  status: string;
  paired_at: string;
}

function relTime(iso: string | null | undefined): string {
  if (!iso) return 'never';
  const d = new Date(iso).getTime();
  if (Number.isNaN(d)) return 'invalid';
  const mins = Math.floor((Date.now() - d) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

// Mask a UUID to a short, non-reversible form so a leaked screenshot or
// shoulder-surf in this dev panel cannot expose real identifiers.
// "ee119451-80ac-40e3-9a9a-3a4357c22529" -> "ee11…22529"
function maskId(id: string | null | undefined): string {
  if (!id) return '(null)';
  if (id.length <= 12) return id;
  return `${id.slice(0, 4)}…${id.slice(-5)}`;
}

export interface DevOptionsModalProps {
  visible: boolean;
  onClose: () => void;
  role: 'parent' | 'child';
}

function DevOptionsContent({ role, onClose }: { role: 'parent' | 'child'; onClose: () => void }) {
  const userId = useAuthStore((s) => s.userId);
  const email = useAuthStore((s) => s.email);
  const deviceId = useAuthStore((s) => s.deviceId);
  const pairId = useAuthStore((s) => s.pairId);
  const selectedChildId = useAuthStore((s) => s.selectedChildId);
  const setDeviceId = useAuthStore((s) => s.setDeviceId);
  const resetAuth = useAuthStore((s) => s.resetAuth);

  const [devices, setDevices] = React.useState<DeviceRow[] | null>(null);
  const [pairs, setPairs] = React.useState<PairRow[] | null>(null);
  const [fetchError, setFetchError] = React.useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [recoveryResult, setRecoveryResult] = React.useState<string | null>(null);
  const [notifProbe, setNotifProbe] = React.useState<string | null>(null);

  const load = useCallback(async () => {
    if (!isValidUUID(userId)) {
      setFetchError('No signed-in user');
      return;
    }
    setIsRefreshing(true);
    setFetchError(null);
    try {
      const [{ data: devRows, error: devErr }, { data: pairRows, error: pairErr }] =
        await Promise.all([
          supabase
            .from('devices')
            .select('id, role, user_id, last_seen_at, is_foreground')
            .eq('user_id', userId)
            .order('last_seen_at', { ascending: false })
            .limit(20),
          supabase
            .from('pairs')
            .select('id, parent_device_id, child_device_id, parent_user_id, child_user_id, status, paired_at')
            .or(`parent_user_id.eq.${userId},child_user_id.eq.${userId}`)
            .order('paired_at', { ascending: false })
            .limit(20),
        ]);
      if (devErr) throw devErr;
      if (pairErr) throw pairErr;
      setDevices((devRows ?? []) as DeviceRow[]);
      setPairs((pairRows ?? []) as PairRow[]);
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : 'unknown error');
    } finally {
      setIsRefreshing(false);
    }
  }, [userId]);

  React.useEffect(() => {
    load();
  }, [load]);

  const runRecovery = useCallback(async () => {
    if (!isValidUUID(userId)) {
      setRecoveryResult('No user');
      return;
    }
    setRecoveryResult('Running…');
    try {
      const recovered =
        role === 'child'
          ? await resolveChildDeviceId(userId, deviceId)
          : await resolveParentDeviceId(userId, deviceId);
      if (recovered) {
        if (recovered !== deviceId) setDeviceId(recovered);
        setRecoveryResult(`Recovered → ${maskId(recovered)}`);
      } else {
        setRecoveryResult('No active pair found for this user');
      }
    } catch (err) {
      setRecoveryResult(`Error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, [userId, deviceId, setDeviceId, role]);

  const probeNotifications = useCallback(async () => {
    if (!isValidUUID(userId)) {
      setNotifProbe('No user');
      return;
    }
    setNotifProbe('Probing…');
    try {
      const childId =
        role === 'parent'
          ? pairs?.find((p) => p.parent_user_id === userId)?.child_user_id
          : userId;
      if (!isValidUUID(childId)) {
        setNotifProbe('No child_user_id available');
        return;
      }
      const { data, error } = await supabase.functions.invoke('get-notifications', {
        body: { child_user_id: childId, limit: 3 },
      });
      if (error) {
        setNotifProbe(`Error: ${(error as any).message ?? String(error)}`);
      } else {
        const cnt = (data?.data ?? []).length;
        const sample = (data?.data ?? [])[0];
        const title = sample?.notification_title ?? '(none)';
        setNotifProbe(`OK · ${cnt} rows · title="${title.slice(0, 60)}"`);
      }
    } catch (err) {
      setNotifProbe(`Exception: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, [userId, role, pairs]);

  const handleClearStorage = useCallback(() => {
    resetAuth();
    setRecoveryResult('Cleared local auth storage. Restart app.');
  }, [resetAuth]);

  const currentDeviceInList =
    devices && deviceId && devices.some((d) => d.id === deviceId);

  return (
    <View style={styles.content}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.title}>Developer Diagnostics</Text>
          <Text style={styles.subtitle}>Hidden. Only for the developer.</Text>
        </View>
        <TouchableOpacity
          onPress={onClose}
          hitSlop={12}
          activeOpacity={0.7}
          style={styles.closeBtn}
          accessibilityLabel="Close developer options"
        >
          <Ionicons name="close" size={22} color={AuthColors.onSurfaceVariant} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.label}>Signed-in user</Text>
        <Text style={styles.valueMono}>{email ?? '(no email)'}</Text>
        <Text style={styles.valueMono}>{maskId(userId)}</Text>

        <Text style={styles.label}>Current deviceId (auth store)</Text>
        <Text style={styles.valueMono}>{maskId(deviceId)}</Text>
        {!currentDeviceInList && deviceId ? (
          <Text style={styles.warnText}>deviceId not in your devices list</Text>
        ) : null}

        <Text style={styles.label}>pairId · selectedChildId</Text>
        <Text style={styles.valueMono}>pairId: {maskId(pairId)}</Text>
        <Text style={styles.valueMono}>selectedChildId: {maskId(selectedChildId)}</Text>

        <View style={styles.sectionGap} />

        <View style={styles.row}>
          <Text style={styles.label}>Your devices ({devices?.length ?? '?'})</Text>
          <TouchableOpacity onPress={load} disabled={isRefreshing} hitSlop={8}>
            {isRefreshing ? (
              <ActivityIndicator size="small" color={AuthColors.primary} />
            ) : (
              <Ionicons name="refresh" size={18} color={AuthColors.primary} />
            )}
          </TouchableOpacity>
        </View>
        {fetchError ? <Text style={styles.errorText}>{fetchError}</Text> : null}
        {devices?.map((d) => (
          <View key={d.id} style={styles.item}>
            <Text style={styles.itemTitle}>
              {maskId(d.id)} {d.id === deviceId ? '← current' : ''}
            </Text>
            <Text style={styles.itemMeta}>
              role={d.role} fg={String(d.is_foreground)} seen={relTime(d.last_seen_at)}
            </Text>
          </View>
        ))}

        <View style={styles.sectionGap} />

        <Text style={styles.label}>Your pairs ({pairs?.length ?? '?'})</Text>
        {pairs?.map((p) => (
          <View key={p.id} style={styles.item}>
            <Text style={styles.itemTitle}>
              {p.status} · {maskId(p.id)}
            </Text>
            <Text style={styles.itemMeta}>
              parent_dev={maskId(p.parent_device_id)}
              {'\n'}child_dev={maskId(p.child_device_id)}
              {'\n'}paired={relTime(p.paired_at)}
            </Text>
          </View>
        ))}

        <View style={styles.sectionGap} />

        <TouchableOpacity style={styles.btn} onPress={runRecovery} activeOpacity={0.7}>
          <Ionicons name="refresh-circle" size={16} color={AuthColors.onPrimary} />
          <Text style={styles.btnText}>Force device-id recovery</Text>
        </TouchableOpacity>
        {recoveryResult ? <Text style={styles.valueMono}>{recoveryResult}</Text> : null}

        <TouchableOpacity style={styles.btn} onPress={probeNotifications} activeOpacity={0.7}>
          <Ionicons name="paper-plane" size={16} color={AuthColors.onPrimary} />
          <Text style={styles.btnText}>Probe get-notifications (first child)</Text>
        </TouchableOpacity>
        {notifProbe ? <Text style={styles.valueMono}>{notifProbe}</Text> : null}

        <TouchableOpacity
          style={[styles.btn, styles.btnDanger]}
          onPress={handleClearStorage}
          activeOpacity={0.7}
        >
          <Ionicons name="trash" size={16} color={AuthColors.error} />
          <Text style={[styles.btnText, { color: AuthColors.error }]}>Clear local auth storage</Text>
        </TouchableOpacity>

        <Text style={styles.footer}>
          Logger tag: SG · logs go to logcat → filter ReactNativeJS. Auto-recovers parent deviceId
          on session restore / sign-in when persisted id doesn&apos;t match any active pair.
        </Text>
      </ScrollView>
    </View>
  );
}

export function DevOptionsModal({ visible, onClose, role }: DevOptionsModalProps) {
  // Outer wrapper. The dev panel exposes user / device / pair identifiers
  // (masked, but still sensitive) and recovery actions that a production
  // user should never reach. Compiled out of release builds.
  if (!__DEV__) return null;
  return <DevOptionsModalImpl visible={visible} onClose={onClose} role={role} />;
}

function DevOptionsModalImpl({ visible, onClose, role }: DevOptionsModalProps) {
  React.useEffect(() => {
    if (!visible) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [visible, onClose]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <View style={[StyleSheet.absoluteFillObject, styles.backdrop]} />
        <Pressable style={StyleSheet.absoluteFillObject} onPress={onClose} />
        <View style={styles.card}>
          <DevOptionsContent role={role} onClose={onClose} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    zIndex: 200,
  },
  backdrop: {
    backgroundColor: 'rgba(27, 29, 14, 0.45)',
  },
  card: {
    width: '100%',
    maxWidth: 420,
    height: '88%',
    backgroundColor: AuthColors.surface,
    borderRadius: AuthRadius.xl,
    overflow: 'hidden',
    shadowColor: '#1b1d0e',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 32,
    elevation: 12,
  },
  content: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
  },
  headerLeft: {
    flex: 1,
    paddingRight: 8,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 9999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: AuthColors.surfaceContainer,
  },
  title: {
    ...AuthFonts.titleLarge,
    color: AuthColors.onSurface,
  },
  subtitle: {
    ...AuthFonts.bodySmall,
    color: AuthColors.onSurfaceVariant,
    marginTop: 2,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  label: {
    ...AuthFonts.labelMedium,
    color: AuthColors.onSurfaceVariant,
    marginTop: 12,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  valueMono: {
    fontFamily: 'monospace',
    fontSize: 11,
    color: AuthColors.onSurface,
    marginTop: 2,
  },
  warnText: {
    ...AuthFonts.bodyMedium,
    color: AuthColors.secondary,
    marginTop: 4,
  },
  errorText: {
    ...AuthFonts.bodyMedium,
    color: AuthColors.error,
    marginTop: 4,
  },
  sectionGap: {
    height: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  item: {
    backgroundColor: AuthColors.surfaceContainerLow,
    borderRadius: 16,
    padding: 12,
    marginTop: 8,
  },
  itemTitle: {
    fontFamily: 'monospace',
    fontSize: 11,
    color: AuthColors.onSurface,
  },
  itemMeta: {
    fontFamily: 'monospace',
    fontSize: 11,
    color: AuthColors.onSurfaceVariant,
    marginTop: 4,
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: AuthColors.primary,
    borderRadius: 9999,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginTop: 12,
    gap: 6,
  },
  btnText: {
    ...AuthFonts.labelLarge,
    color: AuthColors.onPrimary,
  },
  btnDanger: {
    backgroundColor: AuthColors.surfaceContainer,
  },
  footer: {
    ...AuthFonts.bodySmall,
    color: AuthColors.onSurfaceVariant,
    marginTop: 16,
    opacity: 0.7,
  },
});
