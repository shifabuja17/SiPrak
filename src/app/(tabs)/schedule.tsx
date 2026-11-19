import { router, type Href } from 'expo-router';
import { useMemo } from 'react';
import {
  FlatList,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import HeaderProfileBar from '@/components/common/HeaderProfileBar';
import StatusBadge, {
  type StatusBadgeStatus,
} from '@/components/common/StatusBadge';
import { useAuth } from '@/context/AuthContext';
import { usePracticum } from '@/context/PracticumContext';
import {
  PraktikanEmptyState,
  PraktikanErrorState,
  PraktikanInlineErrorBanner,
  PraktikanLoadingState,
  PraktikanProfileErrorScreen,
} from '@/features/praktikan/components/praktikan-state-view';
import { usePraktikanSessions } from '@/features/praktikan/hooks/use-praktikan-sessions';
import { useMyAttendanceMap } from '@/features/praktikan/hooks/use-session-attendance';
import type {
  PraktikanSession,
  SessionAttendanceDoc,
} from '@/features/praktikan/types';
import {
  formatAttendanceTimeWIB,
  formatMeetingTitle,
} from '@/features/praktikan/utils/format';

function getPersonalAttendanceSummary(
  session: PraktikanSession,
  attendance: SessionAttendanceDoc | null | undefined,
  attendanceLoading: boolean,
  attendanceError: string | null,
): { text: string; tone: 'present' | 'open' | 'absent' | 'neutral' } {
  if (attendance) {
    const timeLabel = formatAttendanceTimeWIB(attendance.waktu);
    return {
      text: timeLabel ? `Sudah presensi · ${timeLabel}` : 'Sudah presensi',
      tone: 'present',
    };
  }

  if (attendanceLoading) {
    return { text: 'Memeriksa presensi...', tone: 'neutral' };
  }

  if (attendanceError) {
    return { text: 'Status presensi gagal dimuat', tone: 'neutral' };
  }

  if (session.status === 'dibuka') {
    return { text: 'Belum presensi · Sesi dibuka', tone: 'open' };
  }

  if (session.status === 'ditutup') {
    return { text: 'Tidak hadir', tone: 'absent' };
  }

  return { text: 'Sesi belum dibuka', tone: 'neutral' };
}

export default function ScheduleScreen() {
  const {
    user,
    profile,
    role: authRole,
    status: authStatus,
    loading: authLoading,
    profileError,
  } = useAuth();

  if (authLoading || authStatus === 'loading') {
    return <PraktikanLoadingState fullScreen message="Memeriksa sesi akun..." />;
  }

  if (user && (profileError || !profile)) {
    return (
      <PraktikanProfileErrorScreen
        title="Jadwal Praktikum"
        subtitle="Pantau jadwal sesi dan lakukan presensi saat sesi dibuka Asisten."
      />
    );
  }

  if (authRole === 'praktikan') {
    return <PraktikanScheduleList />;
  }

  return <LegacyScheduleList />;
}

function PraktikanScheduleList() {
  const {
    classes,
    sessions,
    totalClassCount,
    loading: sessionsLoading,
    error: sessionsError,
    retry: retrySessions,
  } = usePraktikanSessions();

  const sessionIds = useMemo(
    () => sessions.map((item) => item.id),
    [sessions],
  );

  const {
    attendanceBySessionId,
    loading: attendanceLoading,
    error: attendanceError,
    retry: retryAttendance,
  } = useMyAttendanceMap(sessionIds);

  const showInitialLoading = sessionsLoading && sessions.length === 0;
  const showFatalError =
    Boolean(sessionsError) && sessions.length === 0 && !sessionsLoading;

  function renderEmptyState() {
    if (showInitialLoading) {
      return (
        <PraktikanLoadingState
          title="Memuat Jadwal"
          message="Mengambil data kelas dan sesi praktikum kamu..."
        />
      );
    }

    if (showFatalError && sessionsError) {
      return (
        <PraktikanErrorState
          title="Gagal Memuat Jadwal"
          message={sessionsError}
          onRetry={retrySessions}
        />
      );
    }

    if (totalClassCount === 0) {
      return (
        <PraktikanEmptyState
          title="Belum Ada Kelas"
          message="Belum ada kelas praktikum yang tersedia saat ini."
        />
      );
    }

    if (classes.length === 0) {
      return (
        <PraktikanEmptyState
          title="Belum Terdaftar di Kelas"
          message="Akunmu belum terdaftar sebagai peserta di kelas praktikum mana pun. Hubungi Asisten untuk ditambahkan ke daftar peserta."
        />
      );
    }

    return (
      <PraktikanEmptyState
        title="Belum Ada Sesi"
        message="Jadwal sesi praktikum untuk kelas kamu belum tersedia."
      />
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />

      <FlatList
        contentContainerStyle={styles.content}
        data={showInitialLoading || showFatalError ? [] : sessions}
        keyExtractor={(item) => item.id}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.title}>Jadwal Praktikum</Text>

            <Text style={styles.subtitle}>
              Pantau jadwal sesi dan lakukan presensi saat sesi dibuka Asisten.
            </Text>

            <HeaderProfileBar />

            <MapShortcutCard />

            {!showFatalError && sessions.length > 0 && (sessionsError || attendanceError) ? (
              <View style={styles.bannerStack}>
                {sessionsError ? (
                  <PraktikanInlineErrorBanner
                    title="Gagal Memperbarui Jadwal"
                    message={sessionsError}
                    onRetry={retrySessions}
                  />
                ) : null}

                {attendanceError ? (
                  <PraktikanInlineErrorBanner
                    title="Gagal Memuat Status Presensi"
                    message={attendanceError}
                    onRetry={retryAttendance}
                  />
                ) : null}
              </View>
            ) : null}

            <Text style={styles.sectionTitle}>Sesi Praktikum</Text>
          </View>
        }
        renderItem={({ item }) => {
          const summary = getPersonalAttendanceSummary(
            item,
            attendanceBySessionId[item.id],
            attendanceLoading,
            attendanceError,
          );

          return (
            <ScheduleSessionCard
              id={item.id}
              practicumName={item.practicumName}
              status={item.status}
              moduleTitle={item.moduleTitle}
              classRoom={item.classRoom}
              scheduleTime={item.scheduleTime}
              footerText={summary.text}
              footerTone={summary.tone}
            />
          );
        }}
        ListEmptyComponent={renderEmptyState}
      />
    </SafeAreaView>
  );
}

/**
 * Tampilan fallback Sprint 1 saat belum menggunakan Firebase Auth Praktikan
 * agar alur demo/P2 yang belum bermigrasi tetap berjalan.
 */
function LegacyScheduleList() {
  const { sessions } = usePracticum();

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />

      <FlatList
        contentContainerStyle={styles.content}
        data={sessions}
        keyExtractor={(item) => item.id}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.title}>Jadwal Praktikum</Text>

            <Text style={styles.subtitle}>
              Kelola sesi dan pantau kehadiran praktikan.
            </Text>

            <HeaderProfileBar />

            <MapShortcutCard />

            <Text style={styles.sectionTitle}>Sesi Praktikum</Text>
          </View>
        }
        renderItem={({ item }) => (
          <ScheduleSessionCard
            id={item.id}
            practicumName={item.practicumName}
            status={item.status}
            moduleTitle={item.moduleTitle}
            classRoom={item.classRoom}
            scheduleTime={item.scheduleTime}
            footerText={`${item.attendances.length} praktikan hadir`}
            footerTone="neutral"
          />
        )}
        ListEmptyComponent={
          <PraktikanEmptyState
            title="Belum Ada Sesi"
            message="Jadwal praktikum belum tersedia."
          />
        }
      />
    </SafeAreaView>
  );
}

function MapShortcutCard() {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push('/maps' as Href)}
      style={({ pressed }) => [styles.mapShortcutCard, pressed && styles.pressed]}
    >
      <View style={styles.mapShortcutTextGroup}>
        <Text style={styles.mapShortcutTitle}>Peta Lokasi Laboratorium</Text>
        <Text style={styles.mapShortcutSubtitle}>
          Lihat posisi marker & radius area presensi 4 lab praktikum
        </Text>
      </View>

      <Text style={styles.mapShortcutArrow}>›</Text>
    </Pressable>
  );
}

function ScheduleSessionCard({
  id,
  practicumName,
  status,
  moduleTitle,
  classRoom,
  scheduleTime,
  footerText,
  footerTone,
}: {
  id: string;
  practicumName: string;
  status: StatusBadgeStatus;
  moduleTitle: string;
  classRoom: string;
  scheduleTime: string;
  footerText: string;
  footerTone: 'present' | 'open' | 'absent' | 'neutral';
}) {
  return (
    <Pressable
      onPress={() =>
        router.push({
          pathname: '/session/[id]',
          params: { id },
        })
      }
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.sessionName}>{practicumName}</Text>

        <StatusBadge status={status} />
      </View>

      <Text style={styles.module}>{formatMeetingTitle(moduleTitle)}</Text>

      <View style={styles.metadata}>
        <View style={styles.metadataRow}>
          <Text style={styles.metadataLabel}>Lokasi</Text>

          <Text style={styles.metadataValue}>{classRoom}</Text>
        </View>

        <View style={styles.metadataRow}>
          <Text style={styles.metadataLabel}>Jadwal</Text>

          <Text style={styles.metadataValue}>{scheduleTime}</Text>
        </View>
      </View>

      <View style={styles.footer}>
        <Text
          style={[
            styles.attendance,
            footerTone === 'present' && styles.attendancePresent,
            footerTone === 'open' && styles.attendanceOpen,
            footerTone === 'absent' && styles.attendanceAbsent,
          ]}
        >
          {footerText}
        </Text>

        <Text style={styles.detailText}>Lihat detail ›</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: '#FFFFFF',
    flex: 1,
  },
  content: {
    padding: 20,
    paddingTop: 32,
    paddingBottom: 40,
  },
  header: {
    gap: 8,
    marginBottom: 20,
  },
  title: {
    color: '#000000',
    fontSize: 28,
    fontWeight: '800',
    marginTop: 5,
  },
  subtitle: {
    color: '#666666',
    fontSize: 14,
    lineHeight: 21,
  },
  bannerStack: {
    gap: 8,
    marginTop: 6,
  },
  sectionTitle: {
    color: '#000000',
    fontSize: 18,
    fontWeight: '700',
    marginTop: 16,
  },
  mapShortcutCard: {
    alignItems: 'center',
    backgroundColor: '#F2F2F5',
    borderColor: '#D9D9D9',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
    marginTop: 4,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  mapShortcutTextGroup: {
    flex: 1,
    gap: 2,
  },
  mapShortcutTitle: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '700',
  },
  mapShortcutSubtitle: {
    color: '#555555',
    fontSize: 12,
    lineHeight: 17,
  },
  mapShortcutArrow: {
    color: '#000000',
    fontSize: 22,
    fontWeight: '700',
  },
  separator: {
    height: 12,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderColor: '#D9D9D9',
    borderRadius: 18,
    borderWidth: 1,
    gap: 12,
    padding: 18,
  },
  pressed: {
    opacity: 0.78,
  },
  cardHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  sessionName: {
    color: '#000000',
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 23,
  },
  module: {
    color: '#404040',
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  metadata: {
    gap: 10,
  },
  metadataRow: {
    gap: 4,
  },
  metadataLabel: {
    color: '#666666',
    fontSize: 12,
  },
  metadataValue: {
    color: '#404040',
    fontSize: 13,
    lineHeight: 19,
  },
  footer: {
    alignItems: 'center',
    borderTopColor: '#E5E5E5',
    borderTopWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    paddingTop: 12,
  },
  attendance: {
    color: '#404040',
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
  },
  attendancePresent: {
    color: '#15803D',
  },
  attendanceOpen: {
    color: '#B45309',
  },
  attendanceAbsent: {
    color: '#B91C1C',
  },
  detailText: {
    color: '#000000',
    fontSize: 12,
    fontWeight: '700',
  },
});
