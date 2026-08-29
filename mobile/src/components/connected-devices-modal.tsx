import React from 'react';
import { View, Text, Modal, Pressable, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';

const C = {
  primary: '#2f4a37',
  primaryContainer: '#c5eccc',
  onPrimary: '#e8ffea',
  secondary: '#a0412d',
  secondaryContainer: '#ffdad3',
  surface: '#fff8f0',
  surfaceContainerLow: '#faf3e7',
  surfaceContainerHigh: '#efe7da',
  surfaceContainerHighest: '#eae1d2',
  surfaceContainerLowest: '#ffffff',
  onSurface: '#363228',
  onSurfaceVariant: '#645e53',
  outline: '#807a6d',
};

interface Device {
  id: string;
  display_name: string | null;
  child_device_id: string;
  is_foreground: boolean;
  last_seen_at: string | null;
}

interface ConnectedDevicesModalProps {
  visible: boolean;
  onClose: () => void;
  devices: Device[];
  onManage?: (deviceId: string) => void;
}

function formatTimeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export function ConnectedDevicesModal({ visible, onClose, devices, onManage }: ConnectedDevicesModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={s.overlay} onPress={onClose}>
        <Pressable style={s.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={s.handle} />
          <Text style={s.sheetTitle}>Connected Devices</Text>
          <Text style={s.sheetSubtitle}>{devices.length} device{devices.length !== 1 ? 's' : ''} paired</Text>

          <ScrollView style={s.scrollArea} showsVerticalScrollIndicator={false}>
            {devices.length === 0 ? (
              <View style={s.emptyState}>
                <Ionicons name="phone-portrait-outline" size={40} color={C.outline} />
                <Text style={s.emptyText}>No devices paired yet.</Text>
                <TouchableOpacity
                  style={s.pairBtn}
                  onPress={() => { onClose(); router.push('/pairing'); }}
                >
                  <Text style={s.pairBtnText}>Pair New Device</Text>
                </TouchableOpacity>
              </View>
            ) : (
              devices.map((device) => {
                const isOnline = device.is_foreground || (device.last_seen_at && (Date.now() - new Date(device.last_seen_at).getTime() < 120000));
                const lastSeenText = isOnline ? 'Online' : device.last_seen_at ? `Last seen ${formatTimeAgo(new Date(device.last_seen_at).getTime())}` : 'Offline';

                return (
                  <View key={device.id} style={s.deviceRow}>
                    <Image source={require('@/assets/images/leo_avatar.jpg')} style={s.deviceAvatar} />
                    <View style={s.deviceInfo}>
                      <Text style={s.deviceName}>{device.display_name || 'Child Device'}</Text>
                      <View style={s.statusRow}>
                        <View style={[s.statusDot, { backgroundColor: isOnline ? C.primary : C.outline }]} />
                        <Text style={s.statusText}>{lastSeenText}</Text>
                      </View>
                    </View>
                    <TouchableOpacity
                      style={s.manageBtn}
                      onPress={() => {
                        onClose();
                        onManage?.(device.id);
                      }}
                    >
                      <Text style={s.manageBtnText}>Manage</Text>
                    </TouchableOpacity>
                  </View>
                );
              })
            )}
          </ScrollView>

          <TouchableOpacity style={s.closeBtn} onPress={onClose}>
            <Text style={s.closeBtnText}>Done</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(54, 50, 40, 0.25)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: C.surfaceContainerLowest,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 12,
    paddingBottom: 24,
    maxHeight: '70%',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: C.surfaceContainerHighest,
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetTitle: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 20,
    color: C.onSurface,
    paddingHorizontal: 24,
    marginBottom: 4,
  },
  sheetSubtitle: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 13,
    color: C.onSurfaceVariant,
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  scrollArea: {
    paddingHorizontal: 24,
    maxHeight: 400,
  },
  deviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.surfaceContainerLow,
    borderRadius: 20,
    padding: 16,
    marginBottom: 10,
    gap: 12,
  },
  deviceAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: C.surfaceContainerHigh,
  },
  deviceInfo: {
    flex: 1,
    gap: 2,
  },
  deviceName: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 15,
    color: C.onSurface,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  statusText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    color: C.onSurfaceVariant,
  },
  manageBtn: {
    backgroundColor: C.primaryContainer,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 9999,
  },
  manageBtnText: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 12,
    color: C.primary,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 12,
  },
  emptyText: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 14,
    color: C.outline,
  },
  pairBtn: {
    backgroundColor: C.primary,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 9999,
  },
  pairBtnText: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 13,
    color: C.onPrimary,
  },
  closeBtn: {
    marginHorizontal: 24,
    marginTop: 16,
    backgroundColor: C.surfaceContainerLow,
    paddingVertical: 14,
    borderRadius: 9999,
    alignItems: 'center',
  },
  closeBtnText: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 14,
    color: C.onSurface,
  },
});
