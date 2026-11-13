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
import { useAuth } from '@/context/AuthContext';
import {
  usePracticum,
  type SessionStatus,
} from '@/context/PracticumContext';
import { usePraktikanLeaveRequests } from '@/features/praktikan/hooks/use-praktikan-leave-requests';
import { usePraktikanSessions } from '@/features/praktikan/hooks/use-praktikan-sessions';
import { useMyAttendanceMap } from '@/features/praktikan/hooks/use-session-attendance';
import type {
  FirestoreSessionStatus,
  LeaveRequestStatus,
} from '@/features/praktikan/types';
import {
  formatAttendanceTimeWIB,
  formatMeetingTitle,
} from '@/features/praktikan/utils/format';

interface AttendanceBadgeProps {
  sessionStatus: FirestoreSessionStatus | SessionStatus;
  isPresent: boolean;
}

function AttendanceBadge({
  sessionStatus,
  isPresent,
}: AttendanceBadgeProps) {
  let label = 'BELUM DIBUKA';
  let background = '#F2F2F2';
  let color = '#404040';

  if (isPresent) {
    label = 'HADIR';
    background = '#DCFCE7';
    color = '#15803D';
  } else if (sessionStatus === 'dibuka' || sessionStatus === 'OPEN') {
    label = 'BELUM PRESENSI';
    background = '#FEF3C7';
    color = '#B45309';
  } else if (sessionStatus === 'ditutup' || sessionStatus === 'CLOSED') {
    label = 'TIDAK HADIR';
    background = '#FEE2E2';
    color = '#B91C1C';
  }

  return (
    <View style={[styles.badge, { backgroundColor: background }]}>
      <Text style={[styles.badgeText, { color }]}>{label}</Text>
    </View>
  );
}

const LEAVE_INDICATOR_CONFIG: Record<
  LeaveRequestStatus,
  { label: string; background: string; color: string }
> = {
  menunggu: {
    label: 'Menunggu Izin',
    background: '#FEF3C7',
    color: '#B45309',
  },
  diterima: {
    label: 'Izin Diterima',
    background: '#DCFCE7',
    color: '#15803D',
  },
  ditolak: {
    label: 'Izin Ditolak',
    background: '#FEE2E2',
    color: '#B91C1C',
  },
};

function LeaveIndicatorBadge({ status }: { status: LeaveRequestStatus }) {
  const config = LEAVE_INDICATOR_CONFIG[status];

  return (
    <View style={[styles.badge, { backgroundColor: config.background }]}>
      <Text style={[styles.badgeText, { color: config.color }]}>
        {config.label}
      </Text>
    </View>
  );
}

export default function AttendanceHistoryScreen() {
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
    return <PraktikanAttendanceHistory />;
  }

  if (authRole === 'asisten') {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.title}>Riwayat Kehadiran</Text>
            <Text style={styles.subtitle}>
              Pantau status kehadiran setiap sesi praktikum.
            </Text>
            <HeaderProfileBar />
            <Text style={styles.sectionTitle}>Riwayat Praktikan</Text>
          </View>
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Akun Asisten Aktif</Text>
            <Text style={styles.emptyText}>
              Halaman ini menampilkan riwayat presensi pribadi untuk akun
              Praktikan.
            </Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return <LegacyAttendanceHistory />;
}

function PraktikanAttendanceHistory() {
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

  const {
    leaveBySessionId,
    loading: leaveLoading,
    error: leaveError,
    retry: retryLeaves,
  } = usePraktikanLeaveRequests();

  const isLoading =
    sessionsLoading ||
    (sessions.length > 0 && (attendanceLoading || leaveLoading));
  const activeError = sessionsError ?? attendanceError ?? leaveError;

  const presentCount = isLoading
    ? 0
    : sessions.filter((session) => Boolean(attendanceBySessionId[session.id]))
        .length;

  const absentCount = isLoading
    ? 0
    : sessions.filter(
        (session) =>
          session.status === 'ditutup' && !attendanceBySessionId[session.id],
      ).length;

  const pendingCount = isLoading
    ? 0
    : sessions.length - presentCount - absentCount;

  function handleRetry() {
    if (sessionsError) retrySessions();
    if (attendanceError) retryAttendance();
    if (leaveError) retryLeaves();
  }

  function renderEmptyState() {
    if (isLoading) {
      return (
        <View style={styles.emptyCard}>
          <ActivityIndicator size="small" color="#000000" />
          <Text style={styles.emptyTitle}>Memuat Riwayat</Text>
          <Text style={styles.emptyText}>
            Mengambil riwayat kehadiran praktikum kamu...
          </Text>
        </View>
      );
    }

    if (activeError) {
      return (
        <View style={styles.errorCard}>
          <Text style={styles.errorTitle}>Gagal Memuat Riwayat</Text>
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

    if (totalClassCount === 0 || classes.length === 0) {
      return (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>Belum Terdaftar di Kelas</Text>
          <Text style={styles.emptyText}>
            Riwayat kehadiran akan muncul setelah kamu terdaftar di kelas
            praktikum.
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.emptyCard}>
        <Text style={styles.emptyTitle}>Belum Ada Sesi</Text>
        <Text style={styles.emptyText}>
          Riwayat sesi praktikum belum tersedia.
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />

      <FlatList
        contentContainerStyle={styles.content}
        data={isLoading || activeError ? [] : sessions}
        keyExtractor={(item) => item.id}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.title}>Riwayat Kehadiran</Text>

            <Text style={styles.subtitle}>
              Pantau status kehadiran pribadi pada setiap sesi praktikum.
            </Text>

            <HeaderProfileBar />

            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Total Sesi Praktikum</Text>

              <Text style={styles.summaryValue}>
                {isLoading ? '-' : sessions.length}
              </Text>

              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>
                    {isLoading ? '-' : presentCount}
                  </Text>
                  <Text style={styles.statLabel}>Hadir</Text>
                </View>

                <View style={styles.statItem}>
                  <Text style={styles.statValue}>
                    {isLoading ? '-' : absentCount}
                  </Text>
                  <Text style={styles.statLabel}>Tidak Hadir</Text>
                </View>

                <View style={styles.statItem}>
                  <Text style={styles.statValue}>
                    {isLoading ? '-' : pendingCount}
                  </Text>
                  <Text style={styles.statLabel}>Belum</Text>
                </View>
              </View>
            </View>

            <Text style={styles.sectionTitle}>Riwayat Sesi</Text>
          </View>
        }
        renderItem={({ item }) => {
          const attendance = attendanceBySessionId[item.id] ?? null;
          const leaveRequest = attendance
            ? null
            : (leaveBySessionId[item.id] ?? null);
          const timeLabel = attendance
            ? (formatAttendanceTimeWIB(attendance.waktu) ?? 'Tercatat')
            : null;

          return (
            <HistoryCard
              practicumName={item.practicumName}
              moduleTitle={item.moduleTitle}
              classRoom={item.classRoom}
              scheduleTime={item.scheduleTime}
              sessionStatus={item.status}
              isPresent={Boolean(attendance)}
              leaveStatus={leaveRequest?.status ?? null}
              timeLabel={timeLabel}
            />
          );
        }}
        ListEmptyComponent={renderEmptyState}
      />
    </SafeAreaView>
  );
}

/**
 * Tampilan fallback Sprint 1 saat Firebase Auth belum aktif.
 */
function LegacyAttendanceHistory() {
  const { currentUser, sessions } = usePracticum();

  const isPraktikan = currentUser.role === 'PRAKTIKAN';

  const presentCount = sessions.filter((session) =>
    session.attendances.some((record) => record.userId === currentUser.id),
  ).length;

  const absentCount = sessions.filter(
    (session) =>
      session.status === 'CLOSED' &&
      !session.attendances.some((record) => record.userId === currentUser.id),
  ).length;

  const pendingCount = sessions.length - presentCount - absentCount;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />

      <FlatList
        contentContainerStyle={styles.content}
        data={isPraktikan ? sessions : []}
        keyExtractor={(item) => item.id}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.title}>Riwayat Kehadiran</Text>

            <Text style={styles.subtitle}>
              Pantau status kehadiran setiap sesi praktikum.
            </Text>

            <HeaderProfileBar />

            {isPraktikan && (
              <View style={styles.summaryCard}>
                <Text style={styles.summaryLabel}>Total Sesi Praktikum</Text>

                <Text style={styles.summaryValue}>{sessions.length}</Text>

                <View style={styles.statsRow}>
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>{presentCount}</Text>
                    <Text style={styles.statLabel}>Hadir</Text>
                  </View>

                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>{absentCount}</Text>
                    <Text style={styles.statLabel}>Tidak Hadir</Text>
                  </View>

                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>{pendingCount}</Text>
                    <Text style={styles.statLabel}>Belum</Text>
                  </View>
                </View>
              </View>
            )}

            <Text style={styles.sectionTitle}>
              {isPraktikan ? 'Riwayat Sesi' : 'Riwayat Praktikan'}
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const attendance = item.attendances.find(
            (record) => record.userId === currentUser.id,
          );

          return (
            <HistoryCard
              practicumName={item.practicumName}
              moduleTitle={item.moduleTitle}
              classRoom={item.classRoom}
              scheduleTime={item.scheduleTime}
              sessionStatus={item.status}
              isPresent={Boolean(attendance)}
              timeLabel={attendance?.timestamp ?? null}
              note={attendance?.note}
            />
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>
              {isPraktikan ? 'Belum Ada Sesi' : 'Pilih Akun Praktikan'}
            </Text>

            <Text style={styles.emptyText}>
              {isPraktikan
                ? 'Riwayat sesi praktikum belum tersedia.'
                : 'Ganti akun ke Praktikan untuk melihat riwayat kehadiran pribadi.'}
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

function HistoryCard({
  practicumName,
  moduleTitle,
  classRoom,
  scheduleTime,
  sessionStatus,
  isPresent,
  leaveStatus = null,
  timeLabel,
  note,
}: {
  practicumName: string;
  moduleTitle: string;
  classRoom: string;
  scheduleTime: string;
  sessionStatus: FirestoreSessionStatus | SessionStatus;
  isPresent: boolean;
  leaveStatus?: LeaveRequestStatus | null;
  timeLabel: string | null;
  note?: string;
}) {
  return (
    <View style={styles.card}>
      <Text style={styles.sessionName}>{practicumName}</Text>

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
        <View style={styles.footerBadges}>
          <AttendanceBadge
            sessionStatus={sessionStatus}
            isPresent={isPresent}
          />

          {!isPresent && leaveStatus ? (
            <LeaveIndicatorBadge status={leaveStatus} />
          ) : null}
        </View>

        {timeLabel && <Text style={styles.timestamp}>{timeLabel}</Text>}
      </View>

      {note ? (
        <View style={styles.noteContainer}>
          <Text style={styles.metadataLabel}>Catatan Presensi</Text>

          <Text style={styles.note}>{note}</Text>
        </View>
      ) : null}
    </View>
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
    paddingBottom: 100,
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
  summaryCard: {
    backgroundColor: '#F2F2F2',
    borderRadius: 16,
    gap: 7,
    marginTop: 12,
    padding: 16,
  },
  summaryLabel: {
    color: '#666666',
    fontSize: 12,
    fontWeight: '600',
  },
  summaryValue: {
    color: '#000000',
    fontSize: 28,
    fontWeight: '800',
  },
  statsRow: {
    borderTopColor: '#D9D9D9',
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 8,
    marginTop: 5,
    paddingTop: 12,
  },
  statItem: {
    flex: 1,
    gap: 2,
  },
  statValue: {
    color: '#000000',
    fontSize: 20,
    fontWeight: '800',
  },
  statLabel: {
    color: '#666666',
    fontSize: 12,
    fontWeight: '600',
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
  sessionName: {
    color: '#000000',
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
    fontWeight: '600',
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
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'space-between',
    paddingTop: 12,
  },
  footerBadges: {
    alignItems: 'center',
    flexDirection: 'row',
    flexShrink: 1,
    flexWrap: 'wrap',
    gap: 6,
  },
  badge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  timestamp: {
    color: '#666666',
    fontSize: 12,
    fontWeight: '600',
  },
  noteContainer: {
    backgroundColor: '#F2F2F2',
    borderRadius: 12,
    gap: 5,
    padding: 12,
  },
  note: {
    color: '#404040',
    fontSize: 13,
    lineHeight: 20,
  },
  emptyCard: {
    alignItems: 'center',
    backgroundColor: '#F2F2F2',
    borderRadius: 16,
    gap: 6,
    padding: 24,
  },
  emptyTitle: {
    color: '#000000',
    fontSize: 15,
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
    borderRadius: 16,
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
  pressed: {
    opacity: 0.78,
  },
});
