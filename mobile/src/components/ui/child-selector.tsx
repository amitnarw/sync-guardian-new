import React, { useCallback, useRef, useState } from 'react';
import { Dimensions, Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AuthColors, AuthFonts, AuthRadius, AuthShadows } from '@/constants/auth-theme';

export interface ChildOption {
  pairId: string;
  childDeviceId: string;
  displayName: string | null;
  isOnline?: boolean;
}

export interface ChildSelectorProps {
  options: ChildOption[];
  selectedPairId: string | null;
  onSelect: (pairId: string | null) => void;
  showAllOption?: boolean;
  allLabel?: string;
  variant?: 'pill' | 'inline';
  disabled?: boolean;
}

const SCREEN_WIDTH = Dimensions.get('window').width;
const MIN_DROPDOWN_WIDTH = 200;

export function ChildSelector({
  options,
  selectedPairId,
  onSelect,
  showAllOption = true,
  allLabel = 'All children',
  variant = 'pill',
  disabled = false,
}: ChildSelectorProps) {
  const triggerRef = useRef<View>(null);
  const [open, setOpen] = useState(false);
  const [dropdownTop, setDropdownTop] = useState(0);
  const [dropdownLeft, setDropdownLeft] = useState(0);

  const openDropdown = useCallback(() => {
    triggerRef.current?.measureInWindow((x: number, y: number, width: number, height: number) => {
      setDropdownTop(y + height + 6);
      const dropW = Math.max(MIN_DROPDOWN_WIDTH, width + 40);
      const clamped = Math.min(dropW, SCREEN_WIDTH - 32);
      let left = x;
      if (left + clamped > SCREEN_WIDTH - 16) {
        left = SCREEN_WIDTH - 16 - clamped;
      }
      if (left < 16) left = 16;
      setDropdownLeft(left);
      setOpen(true);
    });
  }, []);

  const closeDropdown = useCallback(() => setOpen(false), []);

  const handleSelect = useCallback(
    (id: string | null) => {
      onSelect(id);
      setOpen(false);
    },
    [onSelect],
  );

  if (options.length === 0) return null;

  const selected = options.find((c) => c.pairId === selectedPairId);
  const isAll = !selected && showAllOption;
  const triggerLabel = isAll ? allLabel : (selected?.displayName || 'Child');
  const triggerActive = !isAll;

  return (
    <>
      <TouchableOpacity
        ref={triggerRef}
        onPress={openDropdown}
        activeOpacity={0.7}
        disabled={disabled}
        style={[
          s.trigger,
          variant === 'pill' ? s.triggerPill : s.triggerInline,
          triggerActive && s.triggerActive,
          disabled && s.triggerDisabled,
        ]}
        accessibilityRole="button"
        accessibilityLabel={triggerLabel}
      >
        <Ionicons
          name={isAll ? 'people-outline' : 'person-outline'}
          size={14}
          color={triggerActive ? AuthColors.onPrimary : AuthColors.onSurface}
        />
        <Text
          numberOfLines={1}
          style={[s.triggerText, triggerActive && s.triggerTextActive]}
        >
          {triggerLabel}
        </Text>
        <Ionicons
          name="chevron-down"
          size={14}
          color={triggerActive ? AuthColors.onPrimary : AuthColors.onSurfaceVariant}
        />
      </TouchableOpacity>

      {open && (
        <Modal visible transparent animationType="fade" onRequestClose={closeDropdown}>
          <Pressable style={s.overlay} onPress={closeDropdown}>
            <Pressable
              style={[s.menu, { top: dropdownTop, left: dropdownLeft }]}
              onPress={() => undefined}
            >
              <ScrollView style={s.menuScroll} nestedScrollEnabled showsVerticalScrollIndicator>
                {showAllOption && (
                  <TouchableOpacity
                    style={[s.menuItem, isAll && s.menuItemActive]}
                    onPress={() => handleSelect(null)}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name="people-outline"
                      size={16}
                      color={isAll ? AuthColors.primary : AuthColors.onSurface}
                    />
                    <Text numberOfLines={1} style={[s.menuText, isAll && s.menuTextActive]}>
                      {allLabel}
                    </Text>
                  </TouchableOpacity>
                )}
                {options.map((child) => {
                  const active = selectedPairId === child.pairId;
                  return (
                    <TouchableOpacity
                      key={child.pairId}
                      style={[s.menuItem, active && s.menuItemActive]}
                      onPress={() => handleSelect(child.pairId)}
                      activeOpacity={0.7}
                    >
                      <View style={s.menuAvatar}>
                        <Ionicons
                          name="person-outline"
                          size={14}
                          color={active ? AuthColors.primary : AuthColors.onSurfaceVariant}
                        />
                        {child.isOnline && <View style={s.menuOnlineDot} />}
                      </View>
                      <Text numberOfLines={1} style={[s.menuText, active && s.menuTextActive]}>
                        {child.displayName || 'Child Device'}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </Pressable>
          </Pressable>
        </Modal>
      )}
    </>
  );
}

const s = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: AuthColors.surfaceContainerLowest,
  },
  triggerPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: AuthRadius.full,
    ...AuthShadows.ambient,
  },
  triggerInline: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: AuthRadius.xl,
    ...AuthShadows.ambient,
  },
  triggerActive: {
    backgroundColor: AuthColors.primary,
  },
  triggerDisabled: {
    opacity: 0.5,
  },
  triggerText: {
    ...AuthFonts.labelLarge,
    color: AuthColors.onSurface,
    maxWidth: 140,
  },
  triggerTextActive: {
    color: AuthColors.onPrimary,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(27, 29, 14, 0.12)',
  },
  menu: {
    position: 'absolute',
    minWidth: 200,
    backgroundColor: AuthColors.surfaceContainerLowest,
    borderRadius: AuthRadius.lg,
    padding: 6,
    ...AuthShadows.float,
  },
  menuScroll: {
    maxHeight: 260,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: AuthRadius.md,
  },
  menuItemActive: {
    backgroundColor: AuthColors.primaryContainer,
  },
  menuAvatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: AuthColors.surfaceContainer,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  menuOnlineDot: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#31A24C',
    borderWidth: 2,
    borderColor: AuthColors.surfaceContainerLowest,
  },
  menuText: {
    ...AuthFonts.bodyMedium,
    color: AuthColors.onSurface,
    flex: 1,
    fontWeight: '500',
  },
  menuTextActive: {
    color: AuthColors.onPrimaryContainer,
    fontWeight: '700',
  },
});
