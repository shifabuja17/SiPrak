import MapsUnavailable from '@/features/maps/maps-unavailable';

/**
 * Versi web tab Peta. `react-native-maps` hanya tersedia di Android/iOS dan membuat
 * seluruh bundle web gagal bila ikut dimuat, jadi web menampilkan pesan ini. Asisten
 * tetap bisa mengatur koordinat & radius lokasi lab dari sini.
 */
export default function MapsWebScreen() {
  return (
    <MapsUnavailable
      title="Peta Tersedia di Aplikasi"
      message="Peta laboratorium hanya dapat dibuka melalui aplikasi SiPrak di Android atau iOS."
    />
  );
}
