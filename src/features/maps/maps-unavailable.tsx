import { router, type Href } from 'expo-router';

import { useAuth } from '@/context/AuthContext';
import { PraktikanEmptyState } from '@/features/praktikan/components/praktikan-state-view';
import { PillButton, Screen, ScreenTitle } from '@/features/praktikan/ui/praktikan-ui';

/**
 * Pengganti tab Peta saat peta tidak bisa dimuat (web, atau build Android tanpa API key
 * Google Maps). Aslab tetap bisa mengatur koordinat & radius lokasi lab dari sini.
 */
export default function MapsUnavailable({ title, message }: { title: string; message: string }) {
  const { role } = useAuth();
  const isAslab = typeof role === 'string' && role.trim().toUpperCase() === 'ASLAB';

  return (
    <Screen>
      <ScreenTitle title="Peta Laboratorium" subtitle="Titik lokasi praktikum" />
      <PraktikanEmptyState title={title} message={message} />
      {isAslab ? (
        <PillButton
          label="Atur Lokasi Laboratorium"
          variant="outline"
          onPress={() => router.push('/aslab/laboratories' as Href)}
        />
      ) : null}
    </Screen>
  );
}
