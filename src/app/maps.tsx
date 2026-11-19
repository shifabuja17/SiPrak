import { router } from 'expo-router';
import {
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import MapView, { type Region } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';

const INITIAL_REGION: Region = {
  latitude: -7.04825,
  longitude: 110.4414,
  latitudeDelta: 0.005,
  longitudeDelta: 0.005,
};

export default function MapsScreen() {
  function handleBack() {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/');
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          onPress={handleBack}
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
        >
          <Text style={styles.backText}>‹ Kembali</Text>
        </Pressable>

        <Text style={styles.title}>Peta Lokasi</Text>
      </View>

      <View style={styles.mapContainer}>
        {Platform.OS === 'web' ? (
          <View style={styles.webPlaceholder}>
            <Text style={styles.webPlaceholderTitle}>
              Peta Interaktif Android & iOS
            </Text>
            <Text style={styles.webPlaceholderText}>
              Komponen MapView aktif pada perangkat Android dan iOS.
            </Text>
          </View>
        ) : (
          <MapView style={styles.map} initialRegion={INITIAL_REGION} />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: '#FFFFFF',
    flex: 1,
  },
  header: {
    alignItems: 'center',
    borderBottomColor: '#E5E5E5',
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    paddingVertical: 4,
  },
  backText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '700',
  },
  title: {
    color: '#000000',
    fontSize: 17,
    fontWeight: '800',
  },
  mapContainer: {
    flex: 1,
  },
  map: {
    height: '100%',
    width: '100%',
  },
  webPlaceholder: {
    alignItems: 'center',
    backgroundColor: '#F7F7F9',
    flex: 1,
    gap: 8,
    justifyContent: 'center',
    padding: 24,
  },
  webPlaceholderTitle: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
  },
  webPlaceholderText: {
    color: '#666666',
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.65,
  },
});
