import { PraktikanEmptyState } from '@/features/praktikan/components/praktikan-state-view';
import { Screen, ScreenTitle } from '@/features/praktikan/ui/praktikan-ui';

/**
 * Versi web tab Peta. `react-native-maps` hanya tersedia di Android/iOS dan membuat
 * seluruh bundle web gagal bila ikut dimuat, jadi web menampilkan pesan ini.
 */
export default function MapsWebScreen() {
  return (
    <Screen>
      <ScreenTitle title="Peta Laboratorium" subtitle="4 titik lokasi praktikum" />
      <PraktikanEmptyState
        title="Peta Tersedia di Aplikasi"
        message="Peta laboratorium hanya dapat dibuka melalui aplikasi SiPrak di Android atau iOS."
      />
    </Screen>
  );
}
