import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import BackButton from '@/components/common/BackButton';
import { useInTab } from '@/components/common/tab-screen';
import { PAGE_BG } from '@/constants/colors';

/**
 * Bar atas halaman Asisten: hanya panah kembali (tanpa header hitam "SiPrak"),
 * mengikuti gaya halaman Praktikan. Tidak tampil bila halaman dibuka sebagai tab.
 */
export default function AssistantHeader() {
  const inTab = useInTab();
  if (inTab) return null;

  return (
    <View style={styles.bar}>
      <BackButton onPress={() => router.back()} />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: PAGE_BG,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
});
