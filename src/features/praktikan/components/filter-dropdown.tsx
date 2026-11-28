import { useRef, useState, type ReactNode } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type HostInstance,
} from 'react-native';

import { BORDER_COLOR, CARD_BG } from '@/constants/colors';
import { FONT } from '@/constants/fonts';

import { CheckIcon } from './praktikan-home-icons';

const ACCENT = '#F47321';
const MENU_MIN_WIDTH = 170;
const MENU_MAX_HEIGHT = 320;
const ITEM_HEIGHT = 44;
const SCREEN_MARGIN = 16;
const GAP = 6;

export interface FilterOption {
  value: string;
  label: string;
}

interface Anchor {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Tombol filter berbentuk pil (desain Riwayat Kehadiran). Saat ditekan, pilihan muncul
 * sebagai menu melayang tepat di bawah tombol, menimpa konten tanpa menggeser
 * posisinya. Menu pindah ke atas tombol bila ruang di bawah tidak cukup.
 */
/**
 * Tombol filter berbentuk pil yang sama dengan `FilterDropdown`, tapi tanpa menu:
 * dipakai bila pilihan dibuka di modal sendiri (mis. kalender tanggal).
 */
export function FilterChip({
  icon,
  label,
  active = false,
  onPress,
  accessibilityLabel,
}: {
  icon: ReactNode;
  label: string;
  /** true saat modal pilihannya sedang terbuka. */
  active?: boolean;
  onPress: () => void;
  accessibilityLabel: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${accessibilityLabel}: ${label}`}
      onPress={onPress}
      style={({ pressed }) => [styles.chip, (pressed || active) && styles.chipPressed]}
    >
      {icon}
      <Text style={styles.chipText} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

export default function FilterDropdown({
  icon,
  label,
  options,
  value,
  onChange,
  accessibilityLabel,
  menuMinWidth = MENU_MIN_WIDTH,
}: {
  icon: ReactNode;
  label: string;
  options: readonly FilterOption[];
  value: string;
  onChange: (value: string) => void;
  accessibilityLabel: string;
  /** Lebar minimum menu; perbesar untuk label panjang (mis. tanggal lengkap). */
  menuMinWidth?: number;
}) {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const triggerRef = useRef<HostInstance>(null);
  const [anchor, setAnchor] = useState<Anchor | null>(null);

  const open = () => {
    triggerRef.current?.measureInWindow((x, y, width, height) => {
      setAnchor({ x, y, width, height });
    });
  };
  const close = () => setAnchor(null);

  let menuStyle = null;
  if (anchor) {
    const menuWidth = Math.min(Math.max(anchor.width, menuMinWidth), screenWidth - SCREEN_MARGIN * 2);
    const menuHeight = Math.min(options.length * ITEM_HEIGHT + 12, MENU_MAX_HEIGHT);
    // Rata kanan dengan tombol, tetap di dalam layar.
    const left = Math.min(
      Math.max(anchor.x + anchor.width - menuWidth, SCREEN_MARGIN),
      screenWidth - SCREEN_MARGIN - menuWidth,
    );
    const below = anchor.y + anchor.height + GAP;
    const fitsBelow = below + menuHeight <= screenHeight - SCREEN_MARGIN;
    const top = fitsBelow ? below : Math.max(SCREEN_MARGIN, anchor.y - GAP - menuHeight);
    menuStyle = { left, top, width: menuWidth, maxHeight: MENU_MAX_HEIGHT };
  }

  return (
    <>
      <Pressable
        ref={triggerRef}
        accessibilityRole="button"
        accessibilityLabel={`${accessibilityLabel}: ${label}`}
        accessibilityState={{ expanded: anchor !== null }}
        onPress={open}
        style={({ pressed }) => [styles.chip, (pressed || anchor) && styles.chipPressed]}
      >
        {icon}
        <Text style={styles.chipText} numberOfLines={1}>
          {label}
        </Text>
      </Pressable>

      <Modal visible={anchor !== null} transparent animationType="fade" onRequestClose={close} statusBarTranslucent>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel="Tutup pilihan" />
        {menuStyle ? (
          <View style={[styles.menu, menuStyle]}>
            <ScrollView bounces={false} contentContainerStyle={styles.menuContent}>
              {options.map((option) => {
                const selected = option.value === value;
                return (
                  <Pressable
                    key={option.value}
                    accessibilityRole="menuitem"
                    accessibilityState={{ selected }}
                    onPress={() => {
                      onChange(option.value);
                      close();
                    }}
                    style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
                  >
                    <Text style={[styles.itemText, selected && styles.itemTextSelected]} numberOfLines={1}>
                      {option.label}
                    </Text>
                    {selected ? <CheckIcon size={14} color={ACCENT} /> : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        ) : null}
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignItems: 'center',
    backgroundColor: CARD_BG,
    borderColor: ACCENT,
    borderRadius: 17,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 5,
    height: 34,
    paddingHorizontal: 10,
  },
  chipPressed: {
    backgroundColor: '#FDE3D3',
  },
  chipText: {
    color: ACCENT,
    fontFamily: FONT.semibold,
    fontSize: 12.5,
    letterSpacing: -0.3,
  },
  menu: {
    backgroundColor: CARD_BG,
    borderColor: BORDER_COLOR,
    borderRadius: 15,
    borderWidth: 1,
    boxShadow: '0px 8px 24px rgba(0, 0, 0, 0.12)',
    overflow: 'hidden',
    position: 'absolute',
  },
  menuContent: {
    paddingVertical: 6,
  },
  item: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    height: ITEM_HEIGHT,
    justifyContent: 'space-between',
    paddingHorizontal: 14,
  },
  itemPressed: {
    backgroundColor: '#F2F4F5',
  },
  itemText: {
    color: '#000000',
    flexShrink: 1,
    fontFamily: FONT.medium,
    fontSize: 14,
  },
  itemTextSelected: {
    color: ACCENT,
    fontFamily: FONT.semibold,
  },
});
