import { createContext, useContext, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { TAB_BAR_SPACE } from '@/features/praktikan/ui/praktikan-ui';

/** true bila halaman sedang tampil sebagai tab (di atas navbar melayang). */
const InTabContext = createContext(false);

export function useInTab(): boolean {
  return useContext(InTabContext);
}

/**
 * Ruang bawah konten yang bisa digulir. Saat tampil sebagai tab, konten mengalir di
 * belakang navbar melayang (seperti Beranda), jadi diberi ruang setinggi navbar supaya
 * item terakhir tetap bisa digulir ke atasnya.
 */
export function useTabBottomSpace(fallback: number): number {
  return useInTab() ? TAB_BAR_SPACE : fallback;
}

/**
 * Membungkus halaman biasa agar bisa dipakai sebagai tab: tombol kembali disembunyikan
 * (lihat AssistantHeader) dan konten bergulir di belakang navbar melayang.
 */
export default function TabScreen({ children }: { children: ReactNode }) {
  return (
    <InTabContext.Provider value>
      <View style={styles.root}>{children}</View>
    </InTabContext.Provider>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: '#FFFFFF',
    flex: 1,
  },
});
