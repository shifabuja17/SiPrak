import { StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/context/AuthContext';
import {
  PraktikanErrorState,
  PraktikanLoadingState,
} from '@/features/praktikan/components/praktikan-state-view';
import { usePraktikanSessions } from '@/features/praktikan/hooks/use-praktikan-sessions';
import {
  Chip,
  PillButton,
  Screen,
  ScreenTitle,
  SectionTitle,
  SoftCard,
  UI,
  useConfirmLogout,
} from '@/features/praktikan/ui/praktikan-ui';
import { FONT } from '@/constants/fonts';

/** Profil Praktikan: identitas akun, kelas yang diikuti, dan tombol keluar. */
export default function ProfileScreen() {
  const { user, profile, status } = useAuth();
  const confirmLogout = useConfirmLogout();
  const { classes, loading, error, retry } = usePraktikanSessions();

  if (status === 'loading') {
    return <PraktikanLoadingState fullScreen message="Memuat profil..." />;
  }

  const nama = profile?.nama ?? 'Praktikan';
  const initial = nama.charAt(0).toUpperCase() || '?';
  const email = profile?.email ?? user?.email ?? '-';

  return (
    <Screen>
      <ScreenTitle title="Profil" />

      <View style={styles.identity}>
        <View style={styles.avatar} accessibilityElementsHidden importantForAccessibility="no">
          <Text style={styles.avatarText}>{initial}</Text>
        </View>
        <Text style={styles.name}>{nama}</Text>
        <View>
          <Chip label={profile?.role === 'asisten' ? 'Asisten' : 'Praktikan'} tone="accent" />
        </View>
      </View>

      <SoftCard>
        <InfoRow label="NIM" value={profile?.nim ?? '-'} />
        <View style={styles.divider} />
        <InfoRow label="Email" value={email} />
      </SoftCard>

      <SectionTitle>Kelas yang Diikuti</SectionTitle>

      {loading && classes.length === 0 ? (
        <PraktikanLoadingState title="Memuat kelas" message="Mengambil kelas praktikum kamu..." />
      ) : error && classes.length === 0 ? (
        <PraktikanErrorState title="Gagal Memuat Kelas" message={error} onRetry={retry} />
      ) : classes.length === 0 ? (
        <SoftCard>
          <Text style={styles.emptyText}>
            Kamu belum terdaftar di kelas praktikum mana pun. Hubungi Asisten untuk ditambahkan.
          </Text>
        </SoftCard>
      ) : (
        <View style={styles.classList}>
          {classes.map((item) => (
            <SoftCard key={item.id} style={styles.classCard}>
              <Text style={styles.className}>
                {item.name ?? item.className ?? item.practicumName ?? 'Kelas Praktikum'}
              </Text>
              {item.code ? <Text style={styles.classMeta}>{item.code}</Text> : null}
            </SoftCard>
          ))}
        </View>
      )}

      <PillButton label="Keluar dari Akun" variant="danger" onPress={confirmLogout} />
    </Screen>
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
  identity: {
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  avatar: {
    alignItems: 'center',
    backgroundColor: UI.ink,
    borderRadius: 40,
    height: 80,
    justifyContent: 'center',
    width: 80,
  },
  avatarText: {
    fontFamily: FONT.extrabold,
    color: '#FFFFFF',
    fontSize: 32,
  },
  name: {
    fontFamily: FONT.extrabold,
    color: UI.ink,
    fontSize: 22,
    letterSpacing: -0.3,
    textAlign: 'center',
  },
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
  classList: {
    gap: 10,
  },
  classCard: {
    gap: 2,
    paddingVertical: 16,
  },
  className: {
    fontFamily: FONT.extrabold,
    color: UI.ink,
    fontSize: 16,
  },
  classMeta: {
    fontFamily: FONT.regular,
    color: UI.ink,
    fontSize: 13,
  },
  emptyText: {
    fontFamily: FONT.regular,
    color: UI.muted,
    fontSize: 14,
    lineHeight: 20,
  },
});
