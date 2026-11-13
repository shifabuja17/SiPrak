import { router } from 'expo-router';
import { useMemo } from 'react';
import {
  ActivityIndicator,
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
    role: authRole,
    status: authStatus,
    loading: authLoading,
  } = useAuth();

  if (authLoading || authStatus === 'loading') {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#000000" />
          <Text style={styles.stateText}>Memeriksa sesi akun...</Text>
        </View>
      </SafeAreaView>
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

  const activeError = sessionsError ?? attendanceError;

  function handleRetry() {
    if (sessionsError) retrySessions();
    if (attendanceError) retryAttendance();
  }

  function renderEmptyState() {
    if (sessionsLoading) {
      return (
        <View style={styles.emptyCard}>
          <ActivityIndicator size="small" color="#000000" />
          <Text style={styles.emptyTitle}>Memuat Jadwal</Text>
          <Text style={styles.emptyText}>
            Mengambil data kelas dan sesi praktikum kamu...
          </Text>
        </View>
      );
    }

    if (activeError) {
      return (
        <View style={styles.errorCard}>
          <Text style={styles.errorTitle}>Gagal Memuat Jadwal</Text>
          <Text style={styles.errorText}>{activeError}</Text>
          <Pressable
            onPress={handleRetry}
            style={({ pressed }) => [
              styles.retryButton,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.retryText}>Coba Lagi</Text>
          </Pressable>
        </View>
      );
    }

    if (totalClassCount === 0) {
      return (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>Belum Ada Kelas</Text>
          <Text style={styles.emptyText}>
            Belum ada kelas praktikum yang tersedia saat ini.
          </Text>
        </View>
      );
    }

    if (classes.length === 0) {
      return (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>Belum Terdaftar di Kelas</Text>
          <Text style={styles.emptyText}>
            Akunmu belum terdaftar sebagai peserta di kelas praktikum mana pun.
            Hubungi Asisten untuk ditambahkan ke daftar peserta.
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.emptyCard}>
        <Text style={styles.emptyTitle}>Belum Ada Sesi</Text>
        <Text style={styles.emptyText}>
          Jadwal sesi praktikum untuk kelas kamu belum tersedia.
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />

      <FlatList
        contentContainerStyle={styles.content}
        data={activeError ? [] : sessions}
        keyExtractor={(item) => item.id}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.title}>Jadwal Praktikum</Text>

            <Text style={styles.subtitle}>
              Pantau jadwal sesi dan lakukan presensi saat sesi dibuka Asisten.
            </Text>

            <HeaderProfileBar />

            <Text style={styles.sectionTitle}>Sesi Praktikum</Text>
          </View>
        }
        renderItem={({ item }) => {
          const summary = getPersonalAttendanceSummary(
            item,
            attendanceBySessionId[item.id],
            attendanceLoading,
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
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Belum Ada Sesi</Text>

            <Text style={styles.emptyText}>
              Jadwal praktikum belum tersedia.
            </Text>
          </View>
        }
      />
    </SafeAreaView>
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
  centerContainer: {
    alignItems: 'center',
    flex: 1,
    gap: 12,
    justifyContent: 'center',
    padding: 20,
  },
  stateText: {
    color: '#666666',
    fontSize: 14,
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
  sectionTitle: {
    color: '#000000',
    fontSize: 18,
    fontWeight: '700',
    marginTop: 16,
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
  emptyCard: {
    alignItems: 'center',
    borderColor: '#D9D9D9',
    borderRadius: 18,
    borderWidth: 1,
    gap: 8,
    padding: 24,
  },
  emptyTitle: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptyText: {
    color: '#666666',
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
  errorCard: {
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    borderColor: '#FCA5A5',
    borderRadius: 18,
    borderWidth: 1,
    gap: 10,
    padding: 20,
  },
  errorTitle: {
    color: '#B91C1C',
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
  errorText: {
    color: '#991B1B',
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#B91C1C',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  retryText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
});
