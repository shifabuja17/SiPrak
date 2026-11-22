import { StyleSheet, Text, View } from 'react-native';

import { FONT } from '@/constants/fonts';
import { SoftCard, UI } from '@/features/praktikan/ui/praktikan-ui';

/** Kartu info akun (NIM & email) yang dipakai profil Praktikan dan Asisten. */
export default function AccountInfoCard({ nim, email }: { nim: string; email: string }) {
  return (
    <SoftCard>
      <InfoRow label="NIM" value={nim} />
      <View style={styles.divider} />
      <InfoRow label="Email" value={email} />
    </SoftCard>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue} selectable>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  infoRow: {
    gap: 3,
  },
  infoLabel: {
    fontFamily: FONT.semibold,
    color: UI.muted,
    fontSize: 12,
  },
  infoValue: {
    fontFamily: FONT.semibold,
    color: UI.ink,
    fontSize: 15,
  },
  divider: {
    backgroundColor: UI.line,
    height: 1,
    marginVertical: 8,
  },
});
