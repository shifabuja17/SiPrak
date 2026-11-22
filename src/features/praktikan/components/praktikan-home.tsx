import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
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
import type {
  PraktikanSession,
  SessionAttendanceDoc,
} from '@/features/praktikan/types';
import { classColor, TAB_BAR_SPACE } from '@/features/praktikan/ui/praktikan-ui';
import { NotificationStatusBanner } from '@/features/notifications/components/notification-status-banner';

// ==========================================
// STATUS
// ==========================================

type Tone = 'live' | 'done' | 'missed' | 'waiting';

function sessionChip(
  session: PraktikanSession,
  attendance: SessionAttendanceDoc | null | undefined,
): { label: string; tone: Tone } {
  if (attendance) return { label: 'Sudah presensi', tone: 'done' };
  if (session.status === 'dibuka') return { label: 'Berlangsung', tone: 'live' };
  if (session.status === 'ditutup') return { label: 'Tidak hadir', tone: 'missed' };
  return { label: 'Belum dibuka', tone: 'waiting' };
}

// ==========================================
// HALAMAN
// ==========================================

export interface PraktikanHomeProps {
  sessions: PraktikanSession[];
  attendanceBySessionId: Record<string, SessionAttendanceDoc | null>;
  /** Banner error / info yang ditampilkan di atas daftar. */
  banners?: ReactNode;
  /** Ditampilkan bila belum ada sesi sama sekali (loading, error, kosong). */
  emptyState?: ReactNode;
}

/**
 * Beranda Praktikan: sapaan, sorotan sesi terdekat, strip minggu ini, dan
 * kartu sesi berwarna per kelas.
 */
export default function PraktikanHome({
  sessions,
  attendanceBySessionId,
  banners,
  emptyState,
}: PraktikanHomeProps) {
  const { profile } = useAuth();
  // Hanya jadwal di tanggal yang dipilih yang ditampilkan; awalnya hari ini.
  const [selectedDay, setSelectedDay] = useState<string>(() => wibDayKey(new Date()));

  const featured = pickFeatured(sessions);
  const attendance = featured ? attendanceBySessionId[featured.id] : null;
  const canAttend = featured?.status === 'dibuka' && !attendance;

  const firstName = (profile?.nama ?? 'Praktikan').split(' ')[0];

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar barStyle="dark-content" />
      <ScrollView contentContainerStyle={styles.content}>
        {/* HEADER */}
        <View style={styles.header}>
          <View style={styles.avatar} accessibilityElementsHidden importantForAccessibility="no">
            <PersonIcon size={22} color="#FFFFFF" />
          </View>

          <View style={styles.greeting}>
            <Text style={styles.greetingTitle} numberOfLines={1}>
              Halo, {firstName}
            </Text>
            <Text style={styles.greetingDate}>{todayLabel()}</Text>
          </View>
        </View>

        {banners}

        {/* SOROTAN */}
        <FeaturedSessionCard
          session={featured}
          emptyEyebrow="Praktikum terdekat"
          emptyTitle="Tidak ada praktikum mendatang"
          upcomingEyebrow="Praktikum terdekat"
          buttonLabel={
            canAttend ? 'Presensi sekarang' : attendance ? 'Sudah presensi · Lihat detail' : 'Lihat detail'
          }
          onPress={() => {
            if (!featured) return;
            if (canAttend) {
              router.push({ pathname: '/attendance/[sessionId]', params: { sessionId: featured.id } });
            } else {
              router.push({ pathname: '/session/[id]', params: { id: featured.id } });
            }
          }}
        />

        {/* STRIP TANGGAL (bisa digeser, hari ini di tengah) */}
        <DateStrip sessions={sessions} selectedDay={selectedDay} onSelect={setSelectedDay} />

        {/* STATUS IZIN NOTIFIKASI (hanya tampil jika notifikasi tidak aktif) */}
        <NotificationStatusBanner />

        {/* DAFTAR SESI */}
        <Text style={scheduleStyles.sectionTitle}>Jadwal Kamu</Text>

        {sessions.length === 0 ? (
          emptyState
        ) : (
          <DaySessionList
            sessions={sessions}
            dayKey={selectedDay}
            renderSession={(session) => {
              const chip = sessionChip(session, attendanceBySessionId[session.id]);
              return (
                <SessionTile
                  key={session.id}
                  session={session}
                  chipLabel={chip.label}
                  live={chip.tone === 'live'}
                  color={classColor(session.classId ?? session.practicumName)}
                  onPress={() => router.push({ pathname: '/session/[id]', params: { id: session.id } })}
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
    backgroundColor: '#FFFFFF',
    flex: 1,
  },
  content: {
    gap: 22,
    // Ruang untuk navbar melayang supaya konten terakhir tidak tertutup.
    paddingBottom: TAB_BAR_SPACE,
    paddingHorizontal: PAGE_PADDING,
    paddingTop: 16,
  },

  // Header
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
});
