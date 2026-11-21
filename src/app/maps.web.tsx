import { router } from 'expo-router';
import { StatusBar, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PraktikanEmptyState } from '@/features/praktikan/components/praktikan-state-view';

/**
 * Versi web halaman Maps. `react-native-maps` hanya tersedia di Android/iOS dan
 * membuat seluruh bundle web gagal bila ikut dimuat, jadi web memakai layar ini.
 */
export default function MapsWebScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.content}>
        <PraktikanEmptyState
          title="Peta Tersedia di Aplikasi"
          message="Peta laboratorium hanya dapat dibuka melalui aplikasi SiPrak di Android atau iOS."
          actionLabel="Kembali"
          onAction={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: '#FFFFFF',
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
});
