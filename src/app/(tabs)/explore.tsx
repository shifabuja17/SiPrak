import { useMemo } from 'react';
import {
  FlatList,
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
import {
  PraktikanEmptyState,
  PraktikanErrorState,
  PraktikanInlineErrorBanner,
  PraktikanLoadingState,
  PraktikanProfileErrorScreen,
} from '@/features/praktikan/components/praktikan-state-view';
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
  attendanceLoading?: boolean;
  attendanceError?: string | null;
}

function AttendanceBadge({
  sessionStatus,
  isPresent,
  attendanceLoading = false,
  attendanceError = null,
}: AttendanceBadgeProps) {
  let label = 'BELUM DIBUKA';
  let background = '#F2F2F2';
  let color = '#404040';

  if (isPresent) {
    label = 'HADIR';
    background = '#DCFCE7';
    color = '#15803D';
  } else if (attendanceLoading) {
    label = 'MEMERIKSA PRESENSI';
    background = '#F2F2F2';
    color = '#525252';
  } else if (attendanceError) {
    label = 'PRESENSI GAGAL DIMUAT';
    background = '#FEE2E2';
    color = '#991B1B';
  } else if (sessionStatus === 'dibuka') {
    label = 'BELUM PRESENSI';
    background = '#FEF3C7';
    color = '#B45309';
  } else if (sessionStatus === 'ditutup') {
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
        title="Riwayat Kehadiran"
        subtitle="Pantau status kehadiran pribadi pada setiap sesi praktikum."
      />
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
          <PraktikanEmptyState
            title="Akun Asisten Aktif"
            message="Halaman ini menampilkan riwayat presensi pribadi untuk akun Praktikan."
          />
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
    listError: leaveError,
    retry: retryLeaves,
  } = usePraktikanLeaveRequests();

  const showInitialLoading = sessionsLoading && sessions.length === 0;
  const showFatalError =
    Boolean(sessionsError) && sessions.length === 0 && !sessionsLoading;
  const areAttendanceStatsUnavailable =
    showInitialLoading ||
    showFatalError ||
    (sessions.length > 0 && (attendanceLoading || Boolean(attendanceError)));

  const presentCount = areAttendanceStatsUnavailable
    ? 0
    : sessions.filter((session) => Boolean(attendanceBySessionId[session.id]))
        .length;

  const absentCount = areAttendanceStatsUnavailable
    ? 0
    : sessions.filter(
        (session) =>
          session.status === 'ditutup' && !attendanceBySessionId[session.id],
      ).length;

  const pendingCount = areAttendanceStatsUnavailable
    ? 0
    : sessions.length - presentCount - absentCount;

  const hasPartialErrors =
    !showInitialLoading &&
    !showFatalError &&
    ((sessions.length > 0 && Boolean(sessionsError)) ||
      (sessions.length > 0 && Boolean(attendanceError)) ||
      Boolean(leaveError));

  function renderEmptyState() {
    if (showInitialLoading) {
      return (
        <PraktikanLoadingState
          title="Memuat Riwayat"
          message="Mengambil riwayat kehadiran praktikum kamu..."
        />
      );
    }

    if (showFatalError && sessionsError) {
      return (
        <PraktikanErrorState
          title="Gagal Memuat Riwayat"
          message={sessionsError}
          onRetry={retrySessions}
        />
      );
    }

    if (totalClassCount === 0 || classes.length === 0) {
      return (
        <PraktikanEmptyState
          title="Belum Terdaftar di Kelas"
          message="Riwayat kehadiran akan muncul setelah kamu terdaftar di kelas praktikum."
        />
      );
    }

    return (
      <PraktikanEmptyState
        title="Belum Ada Sesi"
        message="Riwayat sesi praktikum belum tersedia."
      />
    );
  }

  const listData = showInitialLoading || showFatalError ? [] : sessions;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />

      <FlatList
        contentContainerStyle={styles.content}
        data={listData}
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
                {showInitialLoading || showFatalError ? '-' : sessions.length}
              </Text>

              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>
                    {areAttendanceStatsUnavailable ? '-' : presentCount}
                  </Text>
                  <Text style={styles.statLabel}>Hadir</Text>
                </View>

                <View style={styles.statItem}>
                  <Text style={styles.statValue}>
                    {areAttendanceStatsUnavailable ? '-' : absentCount}
                  </Text>
                  <Text style={styles.statLabel}>Tidak Hadir</Text>
                </View>

                <View style={styles.statItem}>
                  <Text style={styles.statValue}>
                    {areAttendanceStatsUnavailable ? '-' : pendingCount}
                  </Text>
                  <Text style={styles.statLabel}>Belum</Text>
                </View>
              </View>
            </View>

            {hasPartialErrors ? (
              <View style={styles.bannerStack}>
                {sessions.length > 0 && sessionsError ? (
                  <PraktikanInlineErrorBanner
                    title="Gagal Memperbarui Sesi"
                    message={sessionsError}
                    onRetry={retrySessions}
                  />
                ) : null}

                {sessions.length > 0 && attendanceError ? (
                  <PraktikanInlineErrorBanner
                    title="Gagal Memuat Data Presensi"
                    message={attendanceError}
                    onRetry={retryAttendance}
                  />
                ) : null}

                {leaveError ? (
                  <PraktikanInlineErrorBanner
                    title="Gagal Memuat Status Izin"
                    message={leaveError}
                    onRetry={retryLeaves}
                  />
                ) : null}
              </View>
            ) : null}

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
              attendanceLoading={attendanceLoading}
              attendanceError={attendanceError}
              leaveStatus={leaveRequest?.status ?? null}
              leaveLoading={leaveLoading}
              leaveError={leaveError}
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

  const isPraktikan = currentUser.role === 'praktikan';

  const presentCount = sessions.filter((session) =>
    session.attendances.some((record) => record.uid === currentUser.uid),
  ).length;

  const absentCount = sessions.filter(
    (session) =>
      session.status === 'ditutup' &&
      !session.attendances.some((record) => record.uid === currentUser.uid),
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
            (record) => record.uid === currentUser.uid,
          );

          return (
            <HistoryCard
              practicumName={item.practicumName}
              moduleTitle={item.moduleTitle}
              classRoom={item.classRoom}
              scheduleTime={item.scheduleTime}
              sessionStatus={item.status}
              isPresent={Boolean(attendance)}
              timeLabel={attendance?.waktu ?? null}
            />
          );
        }}
        ListEmptyComponent={
          <PraktikanEmptyState
            title={isPraktikan ? 'Belum Ada Sesi' : 'Pilih Akun Praktikan'}
            message={
              isPraktikan
                ? 'Riwayat sesi praktikum belum tersedia.'
                : 'Ganti akun ke Praktikan untuk melihat riwayat kehadiran pribadi.'
            }
          />
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
  attendanceLoading = false,
  attendanceError = null,
  leaveStatus = null,
  leaveLoading = false,
  leaveError = null,
  timeLabel,
  note,
}: {
  practicumName: string;
  moduleTitle: string;
  classRoom: string;
  scheduleTime: string;
  sessionStatus: FirestoreSessionStatus | SessionStatus;
  isPresent: boolean;
  attendanceLoading?: boolean;
  attendanceError?: string | null;
  leaveStatus?: LeaveRequestStatus | null;
  leaveLoading?: boolean;
  leaveError?: string | null;
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
            attendanceLoading={attendanceLoading}
            attendanceError={attendanceError}
          />

          {!isPresent && leaveStatus ? (
            <LeaveIndicatorBadge status={leaveStatus} />
          ) : !isPresent && leaveLoading ? (
            <View style={[styles.badge, styles.statusChipNeutral]}>
              <Text style={[styles.badgeText, styles.statusChipNeutralText]}>
                MEMERIKSA IZIN
              </Text>
            </View>
          ) : !isPresent && leaveError ? (
            <View style={[styles.badge, styles.statusChipError]}>
              <Text style={[styles.badgeText, styles.statusChipErrorText]}>
                IZIN GAGAL DIMUAT
              </Text>
            </View>
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
  bannerStack: {
    gap: 8,
    marginTop: 6,
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
  statusChipNeutral: {
    backgroundColor: '#F2F2F2',
  },
  statusChipNeutralText: {
    color: '#525252',
  },
  statusChipError: {
    backgroundColor: '#FEE2E2',
  },
  statusChipErrorText: {
    color: '#991B1B',
  },
});
