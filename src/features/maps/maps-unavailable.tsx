import { router, type Href } from 'expo-router';

import { useAuth } from '@/context/AuthContext';
import { PraktikanEmptyState } from '@/features/praktikan/components/praktikan-state-view';
import { PillButton, Screen, ScreenTitle } from '@/features/praktikan/ui/praktikan-ui';
import { isAssistantRole } from '@/types/user';

/**
 * Pengganti tab Peta saat peta tidak bisa dimuat (web, atau build Android tanpa API key
 * Google Maps). Asisten tetap bisa mengatur koordinat & radius lokasi lab dari sini.
 */
export default function MapsUnavailable({ title, message }: { title: string; message: string }) {
  const { role } = useAuth();

  return (
    <Screen>
      <ScreenTitle title="Peta Laboratorium" subtitle="4 titik lokasi praktikum" />
      <PraktikanEmptyState title={title} message={message} />
      {isAssistantRole(role) ? (
        <PillButton
          label="Atur Lokasi Laboratorium"
          variant="outline"
          onPress={() => router.push('/assistant/laboratories' as Href)}
        />
      ) : null}
    </Screen>
  );
}
