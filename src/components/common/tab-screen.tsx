import { createContext, useContext, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** true bila halaman sedang tampil sebagai tab (di atas navbar melayang). */
const InTabContext = createContext(false);

export function useInTab(): boolean {
  return useContext(InTabContext);
}

/**
 * Membungkus halaman biasa agar bisa dipakai sebagai tab: tombol kembali disembunyikan
 * (lihat AssistantHeader) dan bagian bawah diberi ruang setinggi navbar melayang supaya
 * isi terakhir tidak tertutup.
 */
export default function TabScreen({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  // Tinggi pill 72 + jarak bawah navbar + sedikit napas.
  const navbarSpace = 72 + Math.max(insets.bottom, 12) + 8;

  return (
    <InTabContext.Provider value>
      <View style={[styles.root, { paddingBottom: navbarSpace }]}>{children}</View>
    </InTabContext.Provider>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: '#FFFFFF',
    flex: 1,
  },
});
