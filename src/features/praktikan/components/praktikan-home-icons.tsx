import Svg, { Path } from 'react-native-svg';

/**
 * Ikon yang belum ada di ekspor Figma (assets/icons/figma). Ikon lain memakai `FigmaIcon`.
 * Digambar dengan gaya garis Iconly yang sama (viewBox 24, garis 1.5).
 */

/** Centang di tombol "Sudah Presensi". */
export function CheckIcon({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M5 12.5L10 17.5L19 7"
        stroke={color}
        strokeWidth={2.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** Buku terbuka, filter kelas di Riwayat Kehadiran. */
export function BookIcon({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 6.6C10.4 5.3 8 4.6 4.4 4.6H3V17.8H4.4C8 17.8 10.4 18.5 12 19.8C13.6 18.5 16 17.8 19.6 17.8H21V4.6H19.6C16 4.6 13.6 5.3 12 6.6Z"
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
      <Path d="M12 6.6V19.8" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
    </Svg>
  );
}

/** Corong, urutan Terbaru/Terlama di Riwayat Kehadiran. */
export function FunnelIcon({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4.2 3.8H19.8C20.6 3.8 21 4.7 20.5 5.3L14.3 12.6V18.3C14.3 18.7 14.1 19 13.8 19.2L10.9 20.9C10.4 21.2 9.7 20.8 9.7 20.2V12.6L3.5 5.3C3 4.7 3.4 3.8 4.2 3.8Z"
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
    </Svg>
  );
}
