import { router, type Href } from 'expo-router';
import { Text } from 'react-native';

import {
  PillButton,
  Screen,
  ScreenTitle,
  SoftCard,
  UI,
} from '@/features/praktikan/ui/praktikan-ui';
import { FONT } from '@/constants/fonts';

export default function AslabDashboardScreen() {
  return (
    <Screen>
      <ScreenTitle
        title="Dashboard Aslab"
        subtitle="Kelola data laboratorium, konfigurasi lokasi, dan import massal."
      />

      <SoftCard style={{ gap: 10 }}>
        <Text
          style={{
            color: UI.ink,
            fontFamily: FONT.extrabold,
            fontSize: 17,
          }}
        >
          Akses Cepat Laboratorium
        </Text>
        <Text
          style={{
            color: UI.muted,
            fontFamily: FONT.regular,
            fontSize: 13,
            lineHeight: 19,
          }}
        >
          Buka Manajemen Laboratorium untuk menambah satu lab atau gunakan Bulk
          Insert untuk mengimpor file CSV/XLSX hingga 500 baris sekaligus.
        </Text>
        <PillButton
          label="Buka Manajemen Laboratorium"
          variant="dark"
          onPress={() => router.push('/aslab/laboratories' as Href)}
        />
        <PillButton
          label="Bulk Insert Laboratorium"
          variant="accent"
          onPress={() => router.push('/aslab/bulk-laboratories' as Href)}
        />
      </SoftCard>
    </Screen>
  );
}
