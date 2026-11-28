import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import PersonIcon from '@/components/common/person-icon';
import {
  DateStrip,
  DaySessionList,
  FeaturedSessionCard,
  PAGE_PADDING,
  pickFeatured,
  scheduleStyles,
  SessionTile,
  todayLabel,
  wibDayKey,
} from '@/components/common/session-schedule';
import { FONT } from '@/constants/fonts';
import { useAuth } from '@/context/AuthContext';
import { useAssistantSessions } from '@/features/assistant/state/assistant-sessions-context';
import type { PracticumSession } from '@/features/assistant/types';
import { TAB_BAR_SPACE } from '@/features/praktikan/ui/praktikan-ui';
import { BORDER_COLOR, PAGE_BG } from '@/constants/colors';

function statusChip(session: PracticumSession): { label: string; live: boolean } {
  if (session.status === 'dibuka') return { label: 'Berlangsung', live: true };
  if (session.status === 'ditutup') return { label: 'Selesai', live: false };
  return { label: 'Belum dibuka', live: false };
}

/** Halaman rekap kehadiran sesi. */
function openRecap(sessionId: string) {
  router.push({ pathname: '/assistant/session/[sessionId]', params: { sessionId } });
}

// ==========================================
// BERANDA ASISTEN (tata letak sama dengan beranda Praktikan)
// ==========================================

export default function AssistantScheduleScreen() {
  const { sessions } = useAssistantSessions();
  const { user, profile, loading } = useAuth();
  const [selectedDay, setSelectedDay] = useState<string>(() => wibDayKey(new Date()));

  // Nama: Firestore → display name Auth → bagian depan email → "Asisten".
  const displayName =
    profile?.nama?.trim() ||
    user?.displayName?.trim() ||
    user?.email?.split('@')[0]?.trim() ||
    '';
  const firstName = displayName.split(/\s+/)[0] || 'Asisten';

  const featured = pickFeatured(sessions);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar barStyle="dark-content" />
      <ScrollView contentContainerStyle={styles.content}>
        {/* SAPAAN */}
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

          {/* Penyeimbang selebar avatar supaya teks tepat di tengah layar. */}
          <View style={styles.avatarSpacer} />
        </View>

        {/* SOROTAN: sesi berlangsung, atau sesi terdekat */}
        <FeaturedSessionCard
          session={featured}
          emptyEyebrow="Sesi terdekat"
          emptyTitle="Tidak ada sesi mendatang"
          upcomingEyebrow="Sesi terdekat"
          buttonLabel={featured?.status === 'dibuka' ? 'Cek presensi' : 'Kelola sesi'}
          onPress={() => {
            if (!featured) return;
            if (featured.status === 'dibuka') openRecap(featured.id);
            else router.navigate('/assistant/sesi');
          }}
        />

        {/* STRIP TANGGAL */}
        <DateStrip sessions={sessions} selectedDay={selectedDay} onSelect={setSelectedDay} />

        {/* DAFTAR SESI */}
        <Text style={scheduleStyles.sectionTitle}>Sesi Praktikum</Text>

        {sessions.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Belum Ada Sesi</Text>
            <Text style={styles.emptyText}>
              Sesi praktikum yang sudah dibuat akan muncul di sini.
            </Text>
          </View>
        ) : (
          <DaySessionList
            sessions={sessions}
            dayKey={selectedDay}
            renderSession={(session) => {
              const chip = statusChip(session);
              return (
                <SessionTile
                  key={session.id}
                  session={session}
                  chipLabel={chip.label}
                  live={chip.live}
                  footer={`${session.attendances.length} praktikan hadir`}
                  onPress={() => openRecap(session.id)}
                />
              );
            }}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: PAGE_BG,
    flex: 1,
  },
  content: {
    gap: 22,
    // Ruang untuk navbar melayang.
    paddingBottom: TAB_BAR_SPACE,
    paddingHorizontal: PAGE_PADDING,
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
    alignItems: 'center',
    flex: 1,
    gap: 2,
    justifyContent: 'center',
  },
  avatarSpacer: {
    width: 48,
  },
  greetingTitle: {
    textAlign: 'center',
    fontFamily: FONT.extrabold,
    color: '#111014',
    fontSize: 19,
    lineHeight: 24,
    // Android menambah ruang di atas huruf; dimatikan supaya teks pas di tengah avatar.
    includeFontPadding: false,
  },
  greetingDate: {
    textAlign: 'center',
    fontFamily: FONT.regular,
    color: '#5F5F66',
    fontSize: 13,
    lineHeight: 18,
    includeFontPadding: false,
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    borderColor: BORDER_COLOR,
    borderRadius: 20,
    borderWidth: 1,
    gap: 8,
    padding: 20,
  },
  emptyTitle: {
    fontFamily: FONT.extrabold,
    color: '#111014',
    fontSize: 16,
  },
  emptyText: {
    fontFamily: FONT.regular,
    color: '#5F5F66',
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
});
