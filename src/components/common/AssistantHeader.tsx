import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import BackButton from '@/components/common/BackButton';

/**
 * Bar atas halaman Asisten: hanya panah kembali (tanpa header hitam "SiPrak"),
 * mengikuti gaya halaman Praktikan.
 */
export default function AssistantHeader() {
  return (
    <View style={styles.bar}>
      <BackButton onPress={() => router.back()} />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingTop: 8,
  },
});
