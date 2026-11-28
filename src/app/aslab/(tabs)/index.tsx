// TODO: FR-27 s.d. FR-30 oleh P3
import { ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import PersonIcon from '@/components/common/person-icon';
import { todayLabel } from '@/components/common/session-schedule';
import { FONT } from '@/constants/fonts';
import { useAuth } from '@/context/AuthContext';
import { Chip, SoftCard, TAB_BAR_SPACE, Tile, UI } from '@/features/praktikan/ui/praktikan-ui';

const UPCOMING_MODULES = [
  {
    title: 'Statistik Kehadiran Praktikum',
    description: 'Rekap tingkat kehadiran praktikan per laboratorium dan pertemuan.',
  },
  {
    title: 'Pemantauan Keterlambatan & Denda',
    description: 'Ringkasan pelanggaran grace period beserta akumulasi nominal denda.',
  },
  {
    title: 'Ringkasan Status Laboratorium',
    description: 'Ikhtisar laboratorium aktif, asisten terdaftar, dan jadwal berlangsung.',
  },
];

export default function AslabDashboardScreen() {
  const { user, profile, loading } = useAuth();

  const displayName =
    profile?.nama?.trim() ||
    user?.displayName?.trim() ||
    user?.email?.split('@')[0]?.trim() ||
    '';
  const firstName = displayName.split(/\s+/)[0] || 'Aslab';

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar barStyle="dark-content" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.avatar} accessibilityElementsHidden importantForAccessibility="no">
            <PersonIcon size={22} color="#FFFFFF" />
          </View>

          <View style={styles.greeting}>
            <Text style={styles.greetingTitle} numberOfLines={1}>
              Halo, {loading ? '…' : firstName}
            </Text>
            <Text style={styles.greetingDate}>{todayLabel()}</Text>
          </View>

          <View style={styles.rolePill}>
            <Text style={styles.rolePillText}>Asisten Lab</Text>
          </View>
        </View>

        <Tile color="#111014">
          <Chip label="Sprint 4 · Segera Hadir" tone="neutral" />
          <Text style={styles.heroTitle}>Dashboard Aslab</Text>
          <Text style={styles.heroDescription}>
            Pusat ringkasan analitik kehadiran, monitoring keterlambatan, dan rekap denda
            laboratorium sedang disiapkan untuk tahap berikutnya.
          </Text>
        </Tile>

        <Text style={styles.sectionTitle}>Modul yang Akan Tersedia</Text>

        <View style={styles.cardList}>
          {UPCOMING_MODULES.map((item) => (
            <SoftCard key={item.title} style={styles.moduleCard}>
              <Text style={styles.moduleTitle}>{item.title}</Text>
              <Text style={styles.moduleDescription}>{item.description}</Text>
            </SoftCard>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: '#FFFFFF',
    flex: 1,
  },
  content: {
    gap: 20,
    paddingBottom: TAB_BAR_SPACE,
    paddingHorizontal: UI.padding,
    paddingTop: 16,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  avatar: {
    alignItems: 'center',
    backgroundColor: '#111014',
    borderRadius: 24,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  greeting: {
    flex: 1,
    gap: 2,
  },
  greetingTitle: {
    fontFamily: FONT.extrabold,
    color: '#111014',
    fontSize: 19,
  },
  greetingDate: {
    fontFamily: FONT.regular,
    color: '#5F5F66',
    fontSize: 13,
  },
  rolePill: {
    backgroundColor: '#F47321',
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  rolePillText: {
    fontFamily: FONT.bold,
    color: '#FFFFFF',
    fontSize: 11,
  },
  heroTitle: {
    fontFamily: FONT.extrabold,
    color: '#FFFFFF',
    fontSize: 24,
    letterSpacing: -0.4,
  },
  heroDescription: {
    fontFamily: FONT.regular,
    color: '#E4E4E7',
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
  moduleCard: {
    gap: 4,
    paddingVertical: 16,
  },
  moduleTitle: {
    fontFamily: FONT.extrabold,
    color: '#111014',
    fontSize: 15,
  },
  moduleDescription: {
    fontFamily: FONT.regular,
    color: '#5F5F66',
    fontSize: 13,
    lineHeight: 19,
  },
});
