import { useMemo } from 'react';

import { useAuth } from '@/context/AuthContext';
import AttendanceHistory, { buildHistoryEntries } from '@/features/praktikan/components/attendance-history';
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
import { Screen, ScreenTitle } from '@/features/praktikan/ui/praktikan-ui';

/**
 * Tab Riwayat Kehadiran Praktikan. Tampilan ada di `AttendanceHistory`; layar ini
 * mengambil data sesi, presensi, dan izin.
 */
export default function AttendanceHistoryScreen() {
  const { user, profile, role, status, loading, profileError } = useAuth();

  if (loading || status === 'loading') {
    return <PraktikanLoadingState fullScreen message="Memeriksa sesi akun..." />;
  }

  if (user && (profileError || !profile)) {
    return (
      <PraktikanProfileErrorScreen
        title="Riwayat Kehadiran"
        subtitle="Praktikum yang sudah kamu hadiri, izin, atau lewatkan."
      />
    );
  }

  if (role !== 'praktikan') {
    return (
      <Screen>
        <ScreenTitle title="Riwayat Kehadiran" />
        <PraktikanEmptyState
          title="Khusus Praktikan"
          message="Halaman ini menampilkan riwayat kehadiran pribadi akun Praktikan."
        />
      </Screen>
    );
  }

  return <PraktikanHistory />;
}

function PraktikanHistory() {
  const {
    sessions,
    loading: sessionsLoading,
    error: sessionsError,
    retry: retrySessions,
  } = usePraktikanSessions();

  const sessionIds = useMemo(() => sessions.map((item) => item.id), [sessions]);

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

  const entries = useMemo(
    () => buildHistoryEntries(sessions, attendanceBySessionId, leaveBySessionId),
    [sessions, attendanceBySessionId, leaveBySessionId],
  );

  const loading =
    (sessionsLoading && sessions.length === 0) ||
    (sessions.length > 0 && (attendanceLoading || leaveLoading) && entries.length === 0);
  const fatalError = Boolean(sessionsError) && sessions.length === 0 && !sessionsLoading;
  const hasBanner =
    !fatalError && Boolean(attendanceError || leaveError || (sessionsError && sessions.length > 0));

  const banners = hasBanner ? (
    <>
      {sessionsError && sessions.length > 0 ? (
        <PraktikanInlineErrorBanner
          title="Gagal Memperbarui Sesi"
          message={sessionsError}
          onRetry={retrySessions}
        />
      ) : null}
      {attendanceError ? (
        <PraktikanInlineErrorBanner
          title="Gagal Memuat Presensi"
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
    </>
  ) : null;

  const placeholder = loading ? (
    <PraktikanLoadingState title="Memuat Riwayat" message="Mengambil riwayat kehadiran kamu..." />
  ) : fatalError && sessionsError ? (
    <PraktikanErrorState title="Gagal Memuat Riwayat" message={sessionsError} onRetry={retrySessions} />
  ) : null;

  return <AttendanceHistory entries={entries} banners={banners} placeholder={placeholder} />;
}
