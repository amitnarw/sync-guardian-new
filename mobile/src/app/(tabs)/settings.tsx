import React, { useState, useEffect } from 'react';
import { StyleSheet, ScrollView, View, TouchableOpacity, Image, Dimensions, Text, ActivityIndicator, Modal, TouchableWithoutFeedback, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { ThemedView } from '@/components/themed-view';
import { useAuthStore } from '@/hooks/use-auth-store';
import { supabase } from '@/lib/supabase';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withSpring, runOnJS } from 'react-native-reanimated';

const { width: SCREEN_W } = Dimensions.get('window');

// ============================================================
// EXACT STITCH COLORS (from HTML Tailwind config)
// ============================================================
const C = {
  primary: '#44674d',
  primaryContainer: '#c5eccc',
  onPrimary: '#e8ffea',
  secondary: '#a0412d',
  secondaryContainer: '#ffdad3',
  onSecondary: '#fff7f6',
  tertiary: '#44674e',
  tertiaryContainer: '#d3fbda',
  surface: '#fff8f0',
  surfaceBright: '#fff8f0',
  surfaceContainer: '#f5ede0',
  surfaceContainerLow: '#faf3e7',
  surfaceContainerHigh: '#efe7da',
  surfaceContainerHighest: '#eae1d2',
  surfaceContainerLowest: '#ffffff',
  surfaceVariant: '#eae1d2',
  onSurface: '#363228',
  onSurfaceVariant: '#645e53',
  outline: '#807a6d',
  outlineVariant: '#b9b1a3',
  error: '#a83836',
  white: '#ffffff',
} as const;

export default function SettingsScreen() {
  const [isDropdownVisible, setIsDropdownVisible] = useState(false);
  const [isDropdownRendered, setIsDropdownRendered] = useState(false);
  const dropdownProgress = useSharedValue(0);

  const [children, setChildren] = useState<{ id: string; device_name: string }[]>([]);
  const { deviceId } = useAuthStore();

  useEffect(() => {
    const fetchChildren = async () => {
      if (!deviceId) return;
      const { data, error } = await supabase
        .from('pairs')
        .select('id, child_device:devices!child_device_id(device_name)')
        .eq('parent_device_id', deviceId)
        .in('status', ['active', 'pending']);
      
      if (data) {
        setChildren(data.map((d: any) => ({
          id: d.id,
          device_name: d.child_device?.device_name || 'Child Device'
        })));
      }
    };
    fetchChildren();
  }, [deviceId]);

  const handleDisconnectChild = (pairId: string, name: string) => {
    Alert.alert('Disconnect', `Are you sure you want to unpair ${name}?`, [
      { text: 'Cancel', style: 'cancel' },
      { 
        text: 'Unpair', 
        style: 'destructive', 
        onPress: async () => {
          await supabase.from('pairs').update({ status: 'revoked' }).eq('id', pairId);
          setChildren(children.filter(c => c.id !== pairId));
        }
      }
    ]);
  };

  useEffect(() => {
    if (isDropdownVisible) {
      setIsDropdownRendered(true);
      dropdownProgress.value = withTiming(1, { duration: 250 });
    } else {
      dropdownProgress.value = withTiming(0, { duration: 200 }, (finished) => {
        if (finished) {
          runOnJS(setIsDropdownRendered)(false);
        }
      });
    }
  }, [isDropdownVisible]);

  const handleProfilePress = () => {
    setIsDropdownVisible(!isDropdownVisible);
  };

  const dropdownAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: dropdownProgress.value,
      transform: [
        { scale: dropdownProgress.value * 0.08 + 0.92 },
        { translateY: (1 - dropdownProgress.value) * -12 },
      ],
    };
  });

  const dropdownOverlayStyle = useAnimatedStyle(() => {
    return {
      opacity: dropdownProgress.value,
    };
  });

  const [isSigningOut, setIsSigningOut] = useState(false);
  const screenOpacity = useSharedValue(1);
  const containerAnimatedStyle = useAnimatedStyle(() => ({
    opacity: screenOpacity.value,
  }));

  const [showDialog, setShowDialog] = useState(false);
  const dialogOpacity = useSharedValue(0);
  const dialogCardScale = useSharedValue(0.88);
  const dialogCardTranslateY = useSharedValue(24);

  const dialogOverlayStyle = useAnimatedStyle(() => ({
    opacity: dialogOpacity.value,
  }));

  const cardAnimatedStyle = useAnimatedStyle(() => ({
    opacity: dialogOpacity.value,
    transform: [
      { scale: dialogCardScale.value },
      { translateY: dialogCardTranslateY.value },
    ],
  }));

  useEffect(() => {
    if (showDialog) {
      dialogOpacity.value = withTiming(1, { duration: 300 });
      dialogCardScale.value = withSpring(1, { stiffness: 300, damping: 24 });
      dialogCardTranslateY.value = withSpring(0, { stiffness: 300, damping: 24 });
    }
  }, [showDialog]);

  const handleOpenDialog = () => setShowDialog(true);

  const handleStay = () => {
    dialogOpacity.value = withTiming(0, { duration: 200 }, (finished) => {
      if (finished) {
        runOnJS(setShowDialog)(false);
        dialogCardScale.value = 0.88;
        dialogCardTranslateY.value = 24;
      }
    });
  };

  const performSignOut = async () => {
    try {
      // Import at top, but just use inline require or add import if needed.
      const { supabase } = require('@/lib/supabase');
      await supabase.auth.signOut();
    } catch(e) {}
    useAuthStore.getState().resetAuth();
    router.replace('/login');
  };

  const handleConfirmSignOut = () => {
    setIsSigningOut(true);
    dialogOpacity.value = withTiming(0, { duration: 200 }, (finished) => {
      if (finished) {
        runOnJS(setShowDialog)(false);
        screenOpacity.value = withTiming(0, { duration: 400 }, (finished2) => {
          if (finished2) {
            runOnJS(performSignOut)();
          }
        });
      }
    });
  };

  return (
    <ThemedView style={s.container}>
      <Animated.View style={[{ flex: 1 }, containerAnimatedStyle]}>
      {/* Ambient background glowing circle layer */}
      <View style={s.ambientBgWrapper}>
        <LinearGradient
          colors={['rgba(211, 251, 218, 0.4)', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={s.ambientShape}
        />
      </View>

      <SafeAreaView style={s.safeArea} edges={['top']}>
        {/* Floating Glass Header */}
        <View style={s.header}>
          <View style={s.headerLeft}>
            <MaterialCommunityIcons name="spa" size={24} color={C.primary} style={s.headerIcon} />
            <Text style={s.headerTitle}>Nurturing Atelier</Text>
          </View>
          <View style={s.headerRight}>
            <TouchableOpacity 
              onPress={handleProfilePress}
              activeOpacity={0.8}
            >
              <View style={s.profileWrap}>
                <Image
                  source={require('@/assets/images/mother_avatar.jpg')}
                  style={s.profileAvatar}
                />
              </View>
            </TouchableOpacity>
            <TouchableOpacity 
              style={s.iconButton}
              onPress={() => router.push('/notifications')}
              activeOpacity={0.8}
            >
              <Ionicons name="notifications-outline" size={22} color={C.primary} />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={s.scrollContent}
          showsVerticalScrollIndicator={false}
          onScrollBeginDrag={() => setIsDropdownVisible(false)}
        >
          {/* ========== HERO SECTION: EDITORIAL ========== */}
          <View style={s.heroSection}>
            <Text style={s.heroTitle}>Sanctuary{'\n'}Spaces</Text>
            <Text style={s.heroSubtitle}>
              Shape the rhythm and boundaries of your digital home. Gentle adjustments for a balanced life.
            </Text>
          </View>

          {/* ========== BENTO GRID SECTION ========== */}
          <View style={s.bentoGrid}>
            {/* Card 1: Profile & Family (Sage Theme) */}
            <TouchableOpacity style={[s.bentoCard, s.cardProfile]}>
              <View style={[s.iconWrapper, { backgroundColor: C.primaryContainer }]}>
                <Ionicons name="people" size={26} color={C.primary} />
              </View>
              <Text style={s.cardTitle}>Profile & Family</Text>
              <Text style={s.cardDesc}>Manage members, update avatars, and nurture your core circle.</Text>
              
              {/* Backing blurry green radial blob */}
              <View style={s.cardBlobProfile} />
            </TouchableOpacity>

            {/* Card 2: Notifications Rhythm (Terracotta Theme) - Custom top-right corner */}
            <TouchableOpacity style={[s.bentoCard, s.cardNotifications]}>
              <View style={[s.iconWrapper, { backgroundColor: C.secondaryContainer }]}>
                <Ionicons name="notifications-circle" size={26} color={C.secondary} />
              </View>
              <Text style={s.cardTitle}>Notifications Rhythm</Text>
              <Text style={s.cardDesc}>Tune alerts to respect your time. Silence the noise, keep the signals.</Text>
            </TouchableOpacity>

            {/* Card 3: Device Sanctuary (Umber Theme) - Custom bottom-left corner */}
            <TouchableOpacity style={[s.bentoCard, s.cardDevices]}>
              <View style={[s.iconWrapper, { backgroundColor: C.surfaceVariant }]}>
                <Ionicons name="laptop" size={26} color={C.onSurfaceVariant} />
              </View>
              <Text style={s.cardTitle}>Device Sanctuary</Text>
              <Text style={s.cardDesc}>Overview connected devices, battery health, and sync status.</Text>
            </TouchableOpacity>

            {/* Card 4: Privacy & Soul (Sage/Cream Blend) */}
            <TouchableOpacity style={[s.bentoCard, s.cardPrivacy]}>
              <View style={[s.iconWrapper, { backgroundColor: C.tertiaryContainer }]}>
                <Ionicons name="key" size={26} color={C.tertiary} />
              </View>
              <Text style={s.cardTitle}>Privacy & Soul</Text>
              <Text style={s.cardDesc}>Data controls, keyword safety, and deep settings for peace of mind.</Text>

              {/* Backing blurry tertiary blob */}
              <View style={s.cardBlobPrivacy} />
            </TouchableOpacity>
          </View>

          {/* ========== CONNECTED CHILDREN ========== */}
          <View style={s.childrenSection}>
            <Text style={s.childrenSectionTitle}>Connected Devices ({children.length})</Text>
            {children.length === 0 ? (
              <View style={s.emptyStateCard}>
                <Text style={s.emptyStateText}>No children connected yet.</Text>
              </View>
            ) : (
              children.map(child => (
                <View key={child.id} style={s.childRowCard}>
                  <View style={s.childInfo}>
                    <View style={s.childAvatarBox}>
                      <Ionicons name="phone-portrait" size={20} color={C.primary} />
                    </View>
                    <Text style={s.childNameText}>{child.device_name}</Text>
                  </View>
                  <TouchableOpacity 
                    style={s.disconnectSmallBtn}
                    onPress={() => handleDisconnectChild(child.id, child.device_name)}
                  >
                    <Text style={s.disconnectSmallText}>Disconnect</Text>
                  </TouchableOpacity>
                </View>
              ))
            )}
          </View>

          {/* ========== ACTION AREA: SIGN OUT GENTLY ========== */}
          <View style={s.actionSection}>
            <TouchableOpacity
              style={[s.signOutButton, isSigningOut && s.signOutButtonDisabled]}
              onPress={handleOpenDialog}
              disabled={isSigningOut}
            >
              {isSigningOut ? (
                <ActivityIndicator size="small" color={C.onSurface} style={s.signOutIcon} />
              ) : (
                <Ionicons name="log-out-outline" size={20} color={C.onSurface} style={s.signOutIcon} />
              )}
              <Text style={s.signOutText}>Sign Out Gently</Text>
            </TouchableOpacity>
          </View>

          {/* Bottom spacing */}
          <View style={s.bottomSpacer} />
        </ScrollView>
      </SafeAreaView>

      <Modal
        visible={showDialog}
        transparent={true}
        animationType="none"
        onRequestClose={handleStay}
      >
        <Animated.View style={[s.dialogOverlay, dialogOverlayStyle]}>
          <TouchableWithoutFeedback onPress={handleStay}>
            <View style={StyleSheet.absoluteFill} />
          </TouchableWithoutFeedback>
          <Animated.View style={[s.dialogCard, cardAnimatedStyle]}>
            <Text style={s.dialogTitle}>Leaving so soon?</Text>
            <Text style={s.dialogBody}>
              Your digital sanctuary will be here when you return.
            </Text>
            <View style={s.dialogActions}>
              <TouchableOpacity style={s.dialogButtonStay} onPress={handleStay}>
                <Text style={s.dialogButtonStayText}>Stay</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.dialogButtonSignOut} onPress={handleConfirmSignOut}>
                {isSigningOut ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={s.dialogButtonSignOutText}>Sign Out</Text>
                )}
              </TouchableOpacity>
            </View>
          </Animated.View>
        </Animated.View>
      </Modal>
      </Animated.View>
      {isDropdownRendered && (
        <>
          <TouchableWithoutFeedback onPress={() => setIsDropdownVisible(false)}>
            <Animated.View style={[s.dropdownBackdrop, dropdownOverlayStyle]} />
          </TouchableWithoutFeedback>
          <Animated.View style={[s.dropdownMenuContainer, dropdownAnimatedStyle]}>
            <View style={s.dropdownMenu}>
              <BlurView intensity={90} tint="light" style={s.dropdownBlur}>
                <View style={s.dropdownHeaderInfo}>
                  <Text style={s.dropdownUserTitle}>Mother's Space</Text>
                  <Text style={s.dropdownUserRole}>Atelier Curator</Text>
                </View>
                
                <View style={s.dropdownDivider} />
                
                <TouchableOpacity 
                  style={s.dropdownItem} 
                  onPress={() => {
                    setIsDropdownVisible(false);
                    console.log("Profile");
                  }}
                  activeOpacity={0.7}
                >
                  <View style={s.dropdownItemLeft}>
                    <Ionicons name="person-outline" size={18} color={C.primary} />
                    <Text style={s.dropdownItemText}>View Profile</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={14} color={C.primary} style={{ opacity: 0.3 }} />
                </TouchableOpacity>
                
                <View style={s.dropdownDivider} />
                
                <TouchableOpacity 
                  style={s.dropdownItem} 
                  onPress={() => {
                    setIsDropdownVisible(false);
                    router.push('/notifications');
                  }}
                  activeOpacity={0.7}
                >
                  <View style={s.dropdownItemLeft}>
                    <Ionicons name="notifications-outline" size={18} color={C.primary} />
                    <Text style={s.dropdownItemText}>Daily Pulse</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={14} color={C.primary} style={{ opacity: 0.3 }} />
                </TouchableOpacity>
                
                <View style={s.dropdownDivider} />
                
                <TouchableOpacity 
                  style={s.dropdownItem} 
                  onPress={() => {
                    setIsDropdownVisible(false);
                    router.push('/(tabs)/settings');
                  }}
                  activeOpacity={0.7}
                >
                  <View style={s.dropdownItemLeft}>
                    <Ionicons name="settings-outline" size={18} color={C.primary} />
                    <Text style={s.dropdownItemText}>Sanctuary Settings</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={14} color={C.primary} style={{ opacity: 0.3 }} />
                </TouchableOpacity>
              </BlurView>
            </View>
          </Animated.View>
        </>
      )}
    </ThemedView>
  );
}

// ============================================================
// STYLES — mapped precisely from Stitch settings.html
// ============================================================
const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.surface,
  },
  ambientBgWrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 400,
    zIndex: 0,
    overflow: 'hidden',
    pointerEvents: 'none',
  },
  ambientShape: {
    position: 'absolute',
    top: -120,
    right: -120,
    width: 320,
    height: 320,
    borderRadius: 160,
  },
  safeArea: {
    flex: 1,
    zIndex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 8,
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: 'rgba(255,248,240,0.80)',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerIcon: {
    marginRight: 2,
  },
  headerTitle: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 18,
    lineHeight: 24,
    color: C.primary,
    letterSpacing: -0.5,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: C.white,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#363228',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  profileWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: C.surfaceContainerLowest,
    backgroundColor: C.surfaceContainerHighest,
    overflow: 'hidden',
    shadowColor: '#363228',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 32,
  },
  profileAvatar: {
    width: '100%',
    height: '100%',
  },
  dropdownBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(54, 50, 40, 0.08)',
    zIndex: 99,
  },
  dropdownMenuContainer: {
    position: 'absolute',
    top: 95,
    right: 24,
    width: 240,
    zIndex: 100,
    shadowColor: '#363228',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 10,
  },
  dropdownMenu: {
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(68, 103, 77, 0.12)',
  },
  dropdownBlur: {
    padding: 8,
    backgroundColor: 'rgba(255, 248, 240, 0.95)',
  },
  dropdownHeaderInfo: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 2,
  },
  dropdownUserTitle: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 15,
    color: C.onSurface,
  },
  dropdownUserRole: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 12,
    color: C.primary,
    opacity: 0.8,
  },
  dropdownDivider: {
    height: 1,
    backgroundColor: 'rgba(68, 103, 77, 0.08)',
    marginVertical: 4,
    marginHorizontal: 8,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 16,
  },
  dropdownItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dropdownItemText: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 14,
    color: C.onSurface,
  },

  /* ---------- Hero Section ---------- */
  heroSection: {
    marginTop: 24,
    marginBottom: 32,
    gap: 12,
  },
  heroTitle: {
    fontFamily: 'PlusJakartaSans-ExtraBold',
    fontSize: 48,
    lineHeight: 54,
    color: C.onSurface,
    letterSpacing: -1.2,
  },
  heroSubtitle: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 16,
    lineHeight: 24,
    color: C.onSurfaceVariant,
    maxWidth: 320,
  },

  /* ---------- Bento Grid ---------- */
  bentoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 32,
  },
  bentoCard: {
    width: (SCREEN_W - 64) / 2, // Beautiful 2 column wrap
    minHeight: 180,
    backgroundColor: C.surfaceContainerLow,
    borderRadius: 24,
    padding: 20,
    position: 'relative',
    overflow: 'hidden',
    shadowColor: '#363228',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.02,
    shadowRadius: 24,
    elevation: 1,
  },
  cardProfile: {
    borderRadius: 28,
  },
  cardNotifications: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 12, // Asymmetrical top-right corner from spec
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  cardDevices: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderBottomLeftRadius: 12, // Asymmetrical bottom-left corner from spec
    borderBottomRightRadius: 28,
  },
  cardPrivacy: {
    borderRadius: 28,
  },
  iconWrapper: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 16,
    lineHeight: 22,
    color: C.onSurface,
    marginBottom: 4,
  },
  cardDesc: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    lineHeight: 16,
    color: C.onSurfaceVariant,
  },
  cardBlobProfile: {
    position: 'absolute',
    bottom: -24,
    right: -24,
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(68,103,77,0.1)',
  },
  cardBlobPrivacy: {
    position: 'absolute',
    top: -24,
    left: -24,
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(197,236,204,0.15)',
  },

  /* ---------- Action Section ---------- */
  actionSection: {
    alignItems: 'center',
    marginTop: 8,
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.surfaceContainerHighest,
    paddingHorizontal: 28,
    paddingVertical: 16,
    borderRadius: 9999,
    gap: 8,
  },
  signOutButtonDisabled: {
    opacity: 0.6,
  },
  signOutIcon: {
    marginRight: 2,
  },
  signOutText: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 14,
    lineHeight: 20,
    color: C.onSurface,
  },

  /* Children Section */
  childrenSection: {
    marginBottom: 32,
    gap: 12,
  },
  childrenSectionTitle: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 14,
    color: C.onSurfaceVariant,
    letterSpacing: 0.5,
    marginLeft: 8,
    marginBottom: 4,
  },
  emptyStateCard: {
    backgroundColor: C.surfaceContainerLowest,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#363228',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.02,
    shadowRadius: 12,
    elevation: 1,
  },
  emptyStateText: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 14,
    color: C.outline,
  },
  childRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: C.surfaceContainerLowest,
    borderRadius: 20,
    padding: 16,
    shadowColor: '#363228',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.02,
    shadowRadius: 12,
    elevation: 1,
  },
  childInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  childAvatarBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: C.primaryContainer,
    justifyContent: 'center',
    alignItems: 'center',
  },
  childNameText: {
    fontFamily: 'PlusJakartaSans-SemiBold',
    fontSize: 15,
    color: C.onSurface,
  },
  disconnectSmallBtn: {
    backgroundColor: C.secondaryContainer,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
  },
  disconnectSmallText: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 12,
    color: C.secondary,
  },

  /* Bottom Spacer */
  bottomSpacer: {
    height: 130,
  },

  /* ---------- Sign Out Dialog ---------- */
  dialogOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(27,29,14,0.35)',
  },
  dialogCard: {
    width: SCREEN_W - 64,
    backgroundColor: C.surface,
    borderRadius: 32,
    padding: 32,
    shadowColor: C.onSurface,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.08,
    shadowRadius: 32,
    elevation: 8,
  },
  dialogTitle: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 20,
    lineHeight: 26,
    color: C.onSurface,
    letterSpacing: -0.3,
  },
  dialogBody: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 14,
    lineHeight: 20,
    color: C.onSurfaceVariant,
    marginTop: 8,
    marginBottom: 28,
  },
  dialogActions: {
    flexDirection: 'row',
    gap: 12,
  },
  dialogButtonStay: {
    flex: 1,
    backgroundColor: C.surfaceContainer,
    borderRadius: 9999,
    paddingVertical: 14,
    alignItems: 'center',
  },
  dialogButtonStayText: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 14,
    lineHeight: 20,
    color: C.onSurface,
  },
  dialogButtonSignOut: {
    flex: 1,
    backgroundColor: C.primary,
    borderRadius: 9999,
    paddingVertical: 14,
    alignItems: 'center',
  },
  dialogButtonSignOutText: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 14,
    lineHeight: 20,
    color: '#ffffff',
  },
});