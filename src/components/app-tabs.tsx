import { router, usePathname, type Href } from 'expo-router';
import { TabList, TabSlot, TabTrigger, Tabs, type TabTriggerSlotProps } from 'expo-router/ui';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { FigmaIcon, type FigmaIconName } from '@/components/common/FigmaIcon';
import { PAGE_BG } from '@/constants/colors';

// Warna navbar sesuai desain Figma: pil hitam, tab aktif lingkaran putih + ikon oranye.
const INK = '#000000';
const ON_INK = '#FFFFFF';
const ACTIVE_ICON = '#F47321';

/** Tinggi pil navbar (desain 350 x 75). */
export const TAB_BAR_HEIGHT = 75;

/** Jarak bawah navbar melayang dari tepi layar (safe area, minimal 12). */
function useTabBarBottom(): number {
  return Math.max(useSafeAreaInsets().bottom, 12);
}

/**
 * Tinggi total area yang ditutupi navbar melayang, diukur dari tepi bawah layar.
 * Dipakai halaman yang tidak digulir agar kontennya berhenti di atas navbar.
 */
export function useTabBarOverlap(): number {
  return TAB_BAR_HEIGHT + useTabBarBottom();
}

/** Ikon Iconly dari Figma: versi Bold saat tab aktif, versi garis saat tidak aktif. */
const FIGMA_TAB_ICON: Partial<Record<IconName, { line: FigmaIconName; bold: FigmaIconName }>> = {
  home: { line: 'home', bold: 'homeBold' },
  history: { line: 'time', bold: 'timeBold' },
  leave: { line: 'permit', bold: 'permitBold' },
  map: { line: 'location', bold: 'locationBold' },
  profile: { line: 'profile', bold: 'profileBold' },
};

type IconName = 'home' | 'history' | 'leave' | 'map' | 'profile' | 'class' | 'session';

function TabIcon({ name, color }: { name: IconName; color: string }) {
  const stroke = { stroke: color, strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      {name === 'home' ? (
        <Path d="M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5.5h-5V20H5a1 1 0 0 1-1-1v-8.5Z" {...stroke} />
      ) : null}
      {name === 'history' ? (
        <>
          <Circle cx={12} cy={12} r={8} {...stroke} />
          <Path d="M12 7.5V12l3 2" {...stroke} />
        </>
      ) : null}
      {name === 'leave' ? (
        <>
          <Rect x={5} y={3.5} width={14} height={17} rx={2.5} {...stroke} />
          <Path d="M8.5 9h7M8.5 12.5h7M8.5 16h4" {...stroke} />
        </>
      ) : null}
      {name === 'map' ? (
        <>
          <Path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z" {...stroke} />
          <Circle cx={12} cy={10} r={2.4} {...stroke} />
        </>
      ) : null}
      {name === 'class' ? (
        <>
          <Circle cx={9} cy={8.5} r={3} {...stroke} />
          <Path d="M3.5 19c.6-3 2.8-4.8 5.5-4.8s4.9 1.8 5.5 4.8" {...stroke} />
          <Circle cx={16.5} cy={9.5} r={2.5} {...stroke} />
          <Path d="M15.5 14.4c2.4-.3 4.4 1.2 5 4.1" {...stroke} />
        </>
      ) : null}
      {name === 'session' ? (
        <>
          <Rect x={5} y={4.5} width={14} height={16} rx={2.5} {...stroke} />
          <Path d="M9 3.5h6v3H9zM8.8 13.2l2.2 2.2 4.2-4.4" {...stroke} />
        </>
      ) : null}
      {name === 'profile' ? (
        <>
          <Circle cx={12} cy={8.5} r={3.5} {...stroke} />
          <Path d="M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5" {...stroke} />
        </>
      ) : null}
    </Svg>
  );
}

type TabButtonProps = TabTriggerSlotProps & { icon: IconName; label: string; path: string };

/** Tombol di dalam pill; tab aktif tampil sebagai lingkaran putih. */
// `ref` dari TabTrigger tidak diteruskan: tipenya tidak cocok dengan Pressable dan tombol ini tidak membutuhkannya.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function TabButton({ icon, label, path, isFocused: _isFocused, ref: _ref, ...props }: TabButtonProps) {
  // Tab aktif ditentukan dari URL; `isFocused` bawaan TabTrigger tidak selalu akurat.
  const pathname = usePathname();
  // Dicocokkan persis: '/assistant' tidak boleh ikut aktif saat membuka '/assistant/profile'.
  const isFocused = pathname === path;
  return (
    <Pressable
      {...props}
      onPress={() => {
        if (!isFocused) router.navigate(path as Href);
      }}
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected: Boolean(isFocused) }}
      // Style berupa array biasa (bukan fungsi): TabTrigger `asChild` menggabungkan style
      // dan style berbentuk fungsi akan terbuang di proses itu.
      style={[styles.item, isFocused && styles.itemActive]}
    >
      {FIGMA_TAB_ICON[icon] ? (
        <FigmaIcon
          name={isFocused ? FIGMA_TAB_ICON[icon]!.bold : FIGMA_TAB_ICON[icon]!.line}
          size={24}
          color={isFocused ? ACTIVE_ICON : ON_INK}
        />
      ) : (
        <TabIcon name={icon} color={isFocused ? ACTIVE_ICON : ON_INK} />
      )}
    </Pressable>
  );
}

function Pill({ children }: { children: ReactNode }) {
  const bottom = useTabBarBottom();
  return (
    // Melayang di atas konten: area di sekitar pill transparan dan tidak menangkap sentuhan.
    <View
      pointerEvents="box-none"
      style={[styles.barArea, { paddingBottom: bottom }]}
    >
      <View style={styles.pill}>{children}</View>
    </View>
  );
}

export interface PillTab {
  /** Nama route di folder (tabs), mis. 'schedule' atau 'index'. */
  name: string;
  /** URL tab, mis. '/schedule' atau '/assistant'. */
  path: string;
  icon: IconName;
  label: string;
}

/**
 * Tab bar pill gelap melayang (dipakai Praktikan & Asisten). Tab aktif berupa lingkaran putih.
 */
export function PillTabs({ tabs }: { tabs: PillTab[] }) {
  const items = tabs.map((tab) => (
    <TabTrigger key={tab.name} name={tab.name} href={tab.path as Href} asChild>
      <TabButton icon={tab.icon} label={tab.label} path={tab.path} />
    </TabTrigger>
  ));

  return (
    <Tabs style={styles.root}>
      <TabSlot style={styles.slot} />
      <Pill>
        <TabList style={styles.tabList}>{items}</TabList>
      </Pill>
    </Tabs>
  );
}

const PRAKTIKAN_TABS: PillTab[] = [
  { name: 'schedule', path: '/schedule', icon: 'home', label: 'Jadwal' },
  { name: 'explore', path: '/explore', icon: 'history', label: 'Riwayat' },
  { name: 'leave', path: '/leave', icon: 'leave', label: 'Izin' },
  { name: 'maps', path: '/maps', icon: 'map', label: 'Peta' },
  { name: 'profile', path: '/profile', icon: 'profile', label: 'Profil' },
];

/** Tab bar Praktikan: Beranda, Riwayat, Izin, Peta, Profil. */
export default function AppTabs() {
  return <PillTabs tabs={PRAKTIKAN_TABS} />;
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: PAGE_BG,
    flex: 1,
  },
  slot: {
    flex: 1,
  },
  barArea: {
    bottom: 0,
    left: 0,
    paddingHorizontal: 26,
    position: 'absolute',
    right: 0,
  },
  // 350 x 75 pada desain; lingkaran 62.5.
  pill: {
    alignItems: 'center',
    backgroundColor: INK,
    borderRadius: 37.5,
    flexDirection: 'row',
    height: TAB_BAR_HEIGHT,
    paddingHorizontal: 6,
  },
  // space-between + padding pill 6 -> jarak lingkaran ke tepi kiri/kanan sama dengan ke atas/bawah.
  tabList: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  item: {
    alignItems: 'center',
    borderRadius: 31.25,
    height: 62.5,
    justifyContent: 'center',
    width: 62.5,
  },
  itemActive: {
    backgroundColor: ON_INK,
  },
  pressed: {
    opacity: 0.7,
  },
});
