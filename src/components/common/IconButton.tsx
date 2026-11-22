import { Pressable, StyleSheet, View, type ViewStyle, type StyleProp } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

export type ActionIconName = 'edit' | 'trash' | 'play' | 'stop' | 'attendance' | 'people';

const INK = '#111014';
const DANGER = '#E00000';
const ACCENT = '#F47321';

function ActionIcon({ name, color }: { name: ActionIconName; color: string }) {
  const stroke = { stroke: color, strokeWidth: 1.9, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      {name === 'edit' && (
        <>
          <Path d="M4 20H8L18.5 9.5A2.12 2.12 0 0 0 15.5 6.5L5 17V20Z" {...stroke} />
          <Path d="M13.5 8.5L16.5 11.5" {...stroke} />
        </>
      )}

      {name === 'trash' && (
        <>
          <Path d="M4 7H20" {...stroke} />
          <Path d="M9 7V4.5H15V7" {...stroke} />
          <Path d="M6.5 7L7.5 20H16.5L17.5 7" {...stroke} />
          <Path d="M10 11V16M14 11V16" {...stroke} />
        </>
      )}

      {name === 'play' && (
        <>
          <Circle cx={12} cy={12} r={9} {...stroke} />
          <Path d="M10 8.5L15.5 12L10 15.5Z" fill={color} {...stroke} />
        </>
      )}

      {name === 'stop' && (
        <>
          <Circle cx={12} cy={12} r={9} {...stroke} />
          <Rect x={9} y={9} width={6} height={6} rx={1} fill={color} />
        </>
      )}

      {name === 'attendance' && (
        <>
          <Rect x={5} y={4.5} width={14} height={16} rx={2} {...stroke} />
          <Path d="M9 3V6M15 3V6" {...stroke} />
          <Path d="M8.5 13L11 15.5L15.5 10.5" {...stroke} />
        </>
      )}

      {name === 'people' && (
        <>
          <Circle cx={9} cy={8} r={3.2} {...stroke} />
          <Path d="M3.5 19C3.5 15.7 5.9 13.5 9 13.5C12.1 13.5 14.5 15.7 14.5 19" {...stroke} />
          <Path d="M15.5 5.2A3 3 0 0 1 15.5 10.8M17 13.8C19 14.4 20.5 16.3 20.5 19" {...stroke} />
        </>
      )}
    </Svg>
  );
}

/**
 * Tombol aksi persegi berikon untuk di dalam kartu oranye (Edit, Hapus, Buka Sesi, dst).
 * Tanpa teks, jadi `label` wajib diisi untuk pembaca layar.
 */
export function IconButton({
  icon,
  label,
  onPress,
  tone = 'light',
  disabled = false,
}: {
  icon: ActionIconName;
  label: string;
  onPress: () => void;
  /** light: ikon hitam; accent: ikon oranye; danger: ikon merah; dark: kotak hitam ikon putih. */
  tone?: 'light' | 'accent' | 'danger' | 'dark';
  disabled?: boolean;
}) {
  const color =
    tone === 'dark' ? '#FFFFFF' : tone === 'danger' ? DANGER : tone === 'accent' ? ACCENT : INK;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      hitSlop={4}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        tone === 'dark' && styles.dark,
        (pressed || disabled) && styles.pressed,
      ]}
    >
      <ActionIcon name={icon} color={color} />
    </Pressable>
  );
}

/** Deretan tombol aksi, rata kanan bawah kartu. */
export function IconButtonRow({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[styles.row, style]}>{children}</View>;
}

/** Radius tombol di dalam kartu: radius kartu (26) dikurangi padding-nya (16). */
const INNER_RADIUS = 10;

const styles = StyleSheet.create({
  row: {
    alignSelf: 'flex-end',
    flexDirection: 'row',
    gap: 8,
    marginTop: 2,
  },
  button: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: INNER_RADIUS,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  dark: {
    backgroundColor: INK,
  },
  pressed: {
    opacity: 0.65,
  },
});
