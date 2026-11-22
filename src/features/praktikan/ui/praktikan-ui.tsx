/**
 * Komponen & token tampilan bersama untuk semua halaman Praktikan, mengikuti gaya Beranda.
 * Palet dibatasi putih, hitam, dan oranye. Teks di atas oranye atau hitam selalu putih
 * Oranye #F47321 (kontras dengan teks putih 2.87:1).
 */
import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import BackButton from '@/components/common/BackButton';
import { FONT } from '@/constants/fonts';

export const UI = {
  page: '#FFFFFF',
  ink: '#111014',
  /** Teks di atas oranye atau hitam. */
  onColor: '#FFFFFF',
  /** Teks sekunder di atas oranye atau hitam. */
  onColorMuted: 'rgba(255,255,255,0.82)',
  muted: '#5F5F66',
  line: '#E4E4E7',
  soft: '#F4F4F5',
  /** Garis kartu netral (kartu berlatar putih). */
  border: '#8E8E93',
  danger: '#E00000',
  accent: '#F47321',
  radiusCard: 26,
  padding: 20,
};

/**
 * Ruang kosong di bawah konten halaman tab supaya item terakhir bisa digulir ke atas
 * navbar melayang (tinggi pill 72 + jarak bawah + napas).
 */
export const TAB_BAR_SPACE = 120;

/** Warna kartu kelas: semua oranye (palet putih-hitam-oranye). */
export const CLASS_PALETTE = [UI.accent];

export function classColor(key: string | undefined | null): string {
  const text = key ?? '';
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  }
  return CLASS_PALETTE[hash % CLASS_PALETTE.length];
}

// ==========================================
// LAYOUT
// ==========================================

export function Screen({
  children,
  scroll = true,
  contentStyle,
}: {
  children: ReactNode;
  scroll?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
}) {
  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar barStyle="dark-content" />
      {scroll ? (
        <ScrollView contentContainerStyle={[styles.content, contentStyle]}>{children}</ScrollView>
      ) : (
        <View style={[styles.content, styles.flex, contentStyle]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

export function ScreenTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={styles.titleBlock}>
      <Text style={styles.title} accessibilityRole="header">
        {title}
      </Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

/** Tombol kembali (panah kiri); `label` dibacakan pembaca layar. */
export function BackLink({ label, onPress }: { label: string; onPress: () => void }) {
  return <BackButton label={label} onPress={onPress} />;
}

// ==========================================
// KARTU & CHIP
// ==========================================

/** Kartu berwarna (warna kelas) dengan sudut besar. */
export function Tile({
  color,
  children,
  onPress,
  accessibilityLabel,
  style,
}: {
  color: string;
  children: ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}) {
  if (!onPress) {
    return <View style={[styles.tile, { backgroundColor: color }, style]}>{children}</View>;
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [styles.tile, { backgroundColor: color }, style, pressed && styles.pressed]}
    >
      {children}
    </Pressable>
  );
}

/** Kartu netral: latar putih dengan garis abu-abu gelap. */
export function SoftCard({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.softCard, style]}>{children}</View>;
}

/**
 * neutral: garis putih untuk di atas kartu berwarna; solid: putih dengan teks hitam;
 * dark: hitam; accent: oranye; soft: abu-abu muda untuk di atas latar putih.
 */
export type ChipTone = 'neutral' | 'solid' | 'dark' | 'accent' | 'soft';

export function Chip({ label, tone = 'neutral' }: { label: string; tone?: ChipTone }) {
  return (
    <View style={[styles.chip, chipBg[tone]]}>
      <Text style={[styles.chipText, chipFg[tone]]}>{label}</Text>
    </View>
  );
}

const chipBg = StyleSheet.create({
  neutral: { borderColor: '#FFFFFF', borderWidth: 1 },
  solid: { backgroundColor: '#FFFFFF' },
  dark: { backgroundColor: '#111014' },
  accent: { backgroundColor: '#F47321' },
  soft: { backgroundColor: '#F4F4F5' },
});

const chipFg = StyleSheet.create({
  neutral: { color: '#FFFFFF' },
  solid: { color: '#111014' },
  dark: { color: '#FFFFFF' },
  accent: { color: '#FFFFFF' },
  soft: { color: '#111014' },
});

// ==========================================
// BARIS INFO BERIKON (tanggal, jam, lokasi)
// ==========================================

export type MetaIcon = 'date' | 'time' | 'place';

function MetaIconSvg({ name, color }: { name: MetaIcon; color: string }) {
  const stroke = {
    stroke: color,
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      {name === 'date' ? (
        <>
          <Rect x={3.5} y={5} width={17} height={15.5} rx={2.5} {...stroke} />
          <Path d="M3.5 10h17M8 3v4M16 3v4" {...stroke} />
        </>
      ) : null}
      {name === 'time' ? (
        <>
          <Circle cx={12} cy={12} r={8.5} {...stroke} />
          <Path d="M12 7.5V12l3 2" {...stroke} />
        </>
      ) : null}
      {name === 'place' ? (
        <>
          <Path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z" {...stroke} />
          <Circle cx={12} cy={10} r={2.4} {...stroke} />
        </>
      ) : null}
    </Svg>
  );
}

/**
 * Satu baris info sesi dengan ikon di kiri: `date` (kalender) untuk hari & tanggal,
 * `time` (jam) untuk waktu, `place` (pin) untuk lokasi lab. Ikon putih karena kartu
 * sesi berwarna oranye; ganti lewat `color` bila dipakai di latar terang.
 */
export function MetaLine({
  icon,
  children,
  textStyle,
  color = UI.onColor,
  numberOfLines,
}: {
  icon: MetaIcon;
  children: ReactNode;
  textStyle?: StyleProp<TextStyle>;
  color?: string;
  numberOfLines?: number;
}) {
  return (
    <View style={styles.metaLine}>
      <View style={styles.metaIcon} accessibilityElementsHidden importantForAccessibility="no">
        <MetaIconSvg name={icon} color={color} />
      </View>
      <Text style={[textStyle, styles.metaText]} numberOfLines={numberOfLines}>
        {children}
      </Text>
    </View>
  );
}

// ==========================================
// TOMBOL
// ==========================================

export function PillButton({
  label,
  onPress,
  variant = 'dark',
  disabled = false,
  loading = false,
  accessibilityLabel,
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: 'dark' | 'outline' | 'accent' | 'danger';
  disabled?: boolean;
  loading?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.pill,
        variant === 'dark' && styles.pillDark,
        variant === 'outline' && styles.pillOutline,
        variant === 'accent' && styles.pillAccent,
        variant === 'danger' && styles.pillDanger,
        inactive && styles.pillDisabled,
        pressed && !inactive && styles.pressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'outline' ? UI.ink : '#FFFFFF'} />
      ) : (
        <Text
          style={[
            styles.pillText,
            variant === 'dark' && styles.pillTextDark,
            variant === 'accent' && styles.pillTextDark,
            variant === 'danger' && styles.pillTextDark,
          ]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

// ==========================================
// LOGOUT
// ==========================================

const styles = StyleSheet.create({
  metaLine: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 7,
  },
  metaIcon: {
    opacity: 0.95,
  },
  metaText: {
    flexShrink: 1,
  },
  safeArea: {
    backgroundColor: UI.page,
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  content: {
    gap: 20,
    // Ruang untuk navbar melayang supaya konten terakhir tidak tertutup.
    paddingBottom: TAB_BAR_SPACE,
    paddingHorizontal: UI.padding,
    paddingTop: 16,
  },
  pressed: {
    opacity: 0.7,
  },
  titleBlock: {
    gap: 4,
  },
  title: {
    fontFamily: FONT.extrabold,
    color: UI.ink,
    fontSize: 28,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontFamily: FONT.regular,
    color: UI.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  sectionTitle: {
    fontFamily: FONT.extrabold,
    color: UI.ink,
    fontSize: 20,
    letterSpacing: -0.3,
  },
  tile: {
    borderRadius: UI.radiusCard,
    gap: 8,
    padding: 18,
  },
  softCard: {
    backgroundColor: UI.page,
    borderColor: UI.border,
    borderWidth: 1,
    borderRadius: UI.radiusCard,
    gap: 6,
    padding: 18,
  },
  chip: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  chipText: {
    fontFamily: FONT.bold,
    fontSize: 11,
  },
  pill: {
    alignItems: 'center',
    borderRadius: 999,
    justifyContent: 'center',
    minHeight: 50,
    paddingHorizontal: 22,
  },
  pillDark: {
    backgroundColor: UI.ink,
  },
  pillOutline: {
    backgroundColor: '#FFFFFF',
    borderColor: UI.ink,
    borderWidth: 1.5,
  },
  pillAccent: {
    backgroundColor: UI.accent,
  },
  pillDanger: {
    backgroundColor: UI.danger,
  },
  pillDisabled: {
    opacity: 0.45,
  },
  pillText: {
    fontFamily: FONT.bold,
    color: UI.ink,
    fontSize: 15,
  },
  pillTextDark: {
    color: '#FFFFFF',
  },
});
