import { StyleSheet, Text, View } from 'react-native';

import AccountInfoCard from '@/components/common/account-info-card';
import LogoutAction from '@/components/common/logout-action';
import PersonIcon from '@/components/common/person-icon';
import { useAuth } from '@/context/AuthContext';
import {
  PraktikanErrorState,
  PraktikanLoadingState,
} from '@/features/praktikan/components/praktikan-state-view';
import { usePraktikanSessions } from '@/features/praktikan/hooks/use-praktikan-sessions';
import {
  Chip,
  Screen,
  ScreenTitle,
  SectionTitle,
  SoftCard,
  UI,
} from '@/features/praktikan/ui/praktikan-ui';
import { FONT } from '@/constants/fonts';

/** Profil Praktikan: identitas akun, kelas yang diikuti, dan tombol keluar. */
export default function ProfileScreen() {
  const { user, profile, status } = useAuth();
  const { classes, loading, error, retry } = usePraktikanSessions();

  if (status === 'loading') {
    return <PraktikanLoadingState fullScreen message="Memuat profil..." />;
  }

  const nama = profile?.nama ?? 'Praktikan';
  const email = profile?.email ?? user?.email ?? '-';

  return (
    <Screen>
      <ScreenTitle title="Profil" />

      <View style={styles.identity}>
        <View style={styles.avatar} accessibilityElementsHidden importantForAccessibility="no">
          <PersonIcon size={36} color="#FFFFFF" />
        </View>
        <Text style={styles.name}>{nama}</Text>
        <View>
          <Chip label={profile?.role === 'asisten' ? 'Asisten' : 'Praktikan'} tone="accent" />
        </View>
      </View>

      <AccountInfoCard nim={profile?.nim ?? '-'} email={email} />

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

      <LogoutAction />
    </Screen>
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
  name: {
    fontFamily: FONT.extrabold,
    color: UI.ink,
    fontSize: 22,
    letterSpacing: -0.3,
    textAlign: 'center',
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
