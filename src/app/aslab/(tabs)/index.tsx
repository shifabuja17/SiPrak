import { router, type Href } from 'expo-router';
import { Text } from 'react-native';

import { FONT } from '@/constants/fonts';
import {
  PillButton,
  Screen,
  ScreenTitle,
  SoftCard,
  UI,
} from '@/features/praktikan/ui/praktikan-ui';

export default function AslabDashboardScreen() {
  return (
    <Screen>
      <ScreenTitle
        title="Dashboard Aslab"
        subtitle="Kelola keanggotaan Praktikan dan Asprak per laboratorium secara real-time."
      />

      <SoftCard style={{ gap: 10 }}>
        <Text
          style={{
            color: UI.ink,
            fontFamily: FONT.extrabold,
            fontSize: 17,
          }}
        >
          Manajemen Anggota Laboratorium
        </Text>
        <Text
          style={{
            color: UI.muted,
            fontFamily: FONT.regular,
            fontSize: 13,
            lineHeight: 19,
          }}
        >
          Buka daftar laboratorium untuk memantau anggota aktif secara real-time
          atau langsung tambahkan Praktikan dan Asprak.
        </Text>
        <PillButton
          label="Buka Manajemen Laboratorium"
          variant="dark"
          onPress={() => router.push('/aslab/laboratories' as Href)}
        />
        <PillButton
          label="Tambah Praktikan"
          variant="accent"
          onPress={() => router.push('/aslab/praktikan-insert' as Href)}
        />
        <PillButton
          label="Tambah Asprak"
          variant="outline"
          onPress={() => router.push('/aslab/asprak-insert' as Href)}
        />
      </SoftCard>
    </Screen>
  );
}
