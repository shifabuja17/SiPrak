// TODO: FR-02 s.d. FR-12
import { ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import AslabRoleGuard from '@/components/auth/aslab-role-guard';
import { FONT } from '@/constants/fonts';
import { Chip, ScreenTitle, SoftCard, TAB_BAR_SPACE, Tile, UI } from '@/features/praktikan/ui/praktikan-ui';

const PLANNED_CAPABILITIES = [
  {
    title: 'CRUD Data Laboratorium',
    description: 'Tambah, ubah, dan kelola informasi laboratorium beserta mata kuliah terkait.',
  },
  {
    title: 'Geofencing & Radius Presensi',
    description: 'Atur titik koordinat (lat/lng) dan batas radius area presensi per laboratorium.',
  },
  {
    title: 'Grace Period & Nominal Denda',
    description: 'Konfigurasi toleransi keterlambatan (menit) dan aturan nominal denda.',
  },
  {
    title: 'Kelola Anggota Laboratorium',
    description: 'Atur penugasan Aslab, Asprak, dan peserta aktif pada koleksi labMembers.',
  },
];

export default function AslabLaboratoriesScreen() {
  return (
    <AslabRoleGuard featureName="Manajemen Laboratorium">
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <StatusBar barStyle="dark-content" />
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <ScreenTitle
            title="Manajemen Laboratorium"
            subtitle="Pengaturan master laboratorium, geofencing, denda, dan keanggotaan khusus Aslab."
          />

          <Tile color="#F47321">
            <Chip label="Khusus Aslab" tone="solid" />
            <Text style={styles.heroTitle}>Konfigurasi Lab Terpusat</Text>
            <Text style={styles.heroDescription}>
              Layar ini menjadi pusat kendali laboratorium yang dipisahkan dari wewenang Asprak.
              Implementasi CRUD lengkap akan dibangun pada tahap FR-02 s.d. FR-12.
            </Text>
          </Tile>

          <Text style={styles.sectionTitle}>Ruang Lingkup Pengelolaan</Text>

          <View style={styles.cardList}>
            {PLANNED_CAPABILITIES.map((item) => (
              <SoftCard key={item.title} style={styles.card}>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.cardDescription}>{item.description}</Text>
              </SoftCard>
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
    </AslabRoleGuard>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: '#FFFFFF',
    flex: 1,
  },
  content: {
    gap: 18,
    paddingBottom: TAB_BAR_SPACE,
    paddingHorizontal: UI.padding,
    paddingTop: 16,
  },
  heroTitle: {
    fontFamily: FONT.extrabold,
    color: '#FFFFFF',
    fontSize: 22,
    letterSpacing: -0.3,
  },
  heroDescription: {
    fontFamily: FONT.regular,
    color: '#FFFFFF',
    fontSize: 13,
    lineHeight: 20,
  },
  sectionTitle: {
    fontFamily: FONT.extrabold,
    color: '#111014',
    fontSize: 16,
  },
  cardList: {
    gap: 12,
  },
  card: {
    gap: 4,
    paddingVertical: 16,
  },
  cardTitle: {
    fontFamily: FONT.extrabold,
    color: '#111014',
    fontSize: 15,
  },
  cardDescription: {
    fontFamily: FONT.regular,
    color: '#5F5F66',
    fontSize: 13,
    lineHeight: 19,
  },
});
