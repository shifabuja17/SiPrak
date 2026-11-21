import { Pressable, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';

interface BackButtonProps {
  onPress: () => void;
  /** Dibacakan pembaca layar; tidak ditampilkan. */
  label?: string;
  color?: string;
}

/** Tombol kembali berupa panah kiri, dengan area sentuh 44x44. */
export default function BackButton({ onPress, label = 'Kembali', color = '#111014' }: BackButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <Svg width={28} height={28} viewBox="0 0 24 24" fill="none">
        <Path
          d="M15 18L9 12L15 6"
          stroke={color}
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    height: 44,
    justifyContent: 'center',
    marginLeft: -10,
    width: 44,
  },
  pressed: {
    opacity: 0.6,
  },
});
