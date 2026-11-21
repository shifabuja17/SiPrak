import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
  Inter_900Black,
} from '@expo-google-fonts/inter';

/**
 * Font Inter (lisensi SIL Open Font License). Tiap ketebalan didaftarkan sebagai family
 * sendiri karena di Android/iOS `fontWeight` tidak memilih file font custom; style memakai
 * `fontFamily: FONT.bold` dst.
 */
export const FONT = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  extrabold: 'Inter_800ExtraBold',
  black: 'Inter_900Black',
} as const;

/** Sumber file untuk `useFonts` di layout utama. */
export const FONT_SOURCES = {
  [FONT.regular]: Inter_400Regular,
  [FONT.medium]: Inter_500Medium,
  [FONT.semibold]: Inter_600SemiBold,
  [FONT.bold]: Inter_700Bold,
  [FONT.extrabold]: Inter_800ExtraBold,
  [FONT.black]: Inter_900Black,
};
