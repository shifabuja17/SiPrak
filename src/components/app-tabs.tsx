import { router, usePathname, type Href } from 'expo-router';
import { TabList, TabSlot, TabTrigger, Tabs, type TabTriggerSlotProps } from 'expo-router/ui';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

const INK = '#111014';
const ON_INK = '#FFFFFF';

type IconName = 'home' | 'history' | 'leave' | 'map' | 'profile';

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
      <TabIcon name={icon} color={isFocused ? INK : ON_INK} />
    </Pressable>
  );
}

function Pill({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    // Melayang di atas konten: area di sekitar pill transparan dan tidak menangkap sentuhan.
    <View
      pointerEvents="box-none"
      style={[styles.barArea, { paddingBottom: Math.max(insets.bottom, 12) }]}
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
    backgroundColor: '#FFFFFF',
    flex: 1,
  },
  slot: {
    flex: 1,
  },
  barArea: {
    bottom: 0,
    left: 0,
    paddingHorizontal: 20,
    position: 'absolute',
    right: 0,
  },
  pill: {
    alignItems: 'center',
    backgroundColor: INK,
    borderRadius: 40,
    flexDirection: 'row',
    padding: 6,
  },
  // space-between + padding pill 6 -> jarak lingkaran ke tepi kiri/kanan sama dengan ke atas/bawah.
  tabList: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  item: {
    alignItems: 'center',
    borderRadius: 30,
    height: 60,
    justifyContent: 'center',
    width: 60,
  },
  itemActive: {
    backgroundColor: ON_INK,
  },
  pressed: {
    opacity: 0.7,
  },
});
