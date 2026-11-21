import { router } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/context/AuthContext';
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
import type { PraktikanSession } from '@/features/praktikan/types';
import {
  formatAttendanceTimeWIB,
  formatMeetingTitle,
} from '@/features/praktikan/utils/format';
import {
  Chip,
  Screen,
  ScreenTitle,
  Tile,
  UI,
  classColor,
} from '@/features/praktikan/ui/praktikan-ui';
import { formatClock, formatSessionDate } from '@/utils/session-time';
import { FONT } from '@/constants/fonts';

/**
 * Riwayat Kehadiran Praktikan: hanya sesi yang sudah dihadiri atau izinnya diterima.
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
        subtitle="Praktikum yang sudah kamu hadiri atau izinnya diterima."
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

type HistoryEntry =
  | { kind: 'hadir'; session: PraktikanSession; timeLabel: string | null }
  | { kind: 'izin'; session: PraktikanSession };

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

  // Hanya sesi yang dihadiri atau izinnya diterima; terbaru di atas.
  const entries = useMemo<HistoryEntry[]>(() => {
    const list: HistoryEntry[] = [];
    for (const session of sessions) {
      const attendance = attendanceBySessionId[session.id];
      if (attendance) {
        list.push({ kind: 'hadir', session, timeLabel: formatAttendanceTimeWIB(attendance.waktu) });
      } else if (leaveBySessionId[session.id]?.status === 'diterima') {
        list.push({ kind: 'izin', session });
      }
    }
    return list.sort(
      (a, b) => (b.session.waktuMulai?.getTime() ?? 0) - (a.session.waktuMulai?.getTime() ?? 0),
    );
  }, [sessions, attendanceBySessionId, leaveBySessionId]);

  const loading =
    (sessionsLoading && sessions.length === 0) ||
    (sessions.length > 0 && (attendanceLoading || leaveLoading) && entries.length === 0);
  const fatalError = Boolean(sessionsError) && sessions.length === 0 && !sessionsLoading;

  return (
    <Screen>
      <ScreenTitle
        title="Riwayat Kehadiran"
        subtitle="Praktikum yang sudah kamu hadiri atau izinnya diterima."
      />

      {!fatalError && (attendanceError || leaveError || (sessionsError && sessions.length > 0)) ? (
        <View style={styles.banners}>
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
        </View>
      ) : null}

      {loading ? (
        <PraktikanLoadingState title="Memuat Riwayat" message="Mengambil riwayat kehadiran kamu..." />
      ) : fatalError && sessionsError ? (
        <PraktikanErrorState title="Gagal Memuat Riwayat" message={sessionsError} onRetry={retrySessions} />
      ) : entries.length === 0 ? (
        <PraktikanEmptyState
          title="Belum Ada Riwayat"
          message="Praktikum yang sudah kamu hadiri atau izinnya diterima Asisten akan muncul di sini."
        />
      ) : (
        <View style={styles.list}>
          {entries.map((entry) => (
            <HistoryTile key={entry.session.id} entry={entry} />
          ))}
        </View>
      )}
    </Screen>
  );
}

function HistoryTile({ entry }: { entry: HistoryEntry }) {
  const { session } = entry;
  const range =
    session.waktuMulai && session.waktuSelesai
      ? `${formatClock(session.waktuMulai)} - ${formatClock(session.waktuSelesai)} WIB`
      : null;

  return (
    <Tile
      color={classColor(session.classId ?? session.practicumName)}
      onPress={() => router.push({ pathname: '/session/[id]', params: { id: session.id } })}
      accessibilityLabel={`${session.practicumName}, ${entry.kind === 'hadir' ? 'hadir' : 'izin diterima'}`}
    >
      <Chip
        label={
          entry.kind === 'hadir'
            ? entry.timeLabel
              ? `Hadir · ${entry.timeLabel}`
              : 'Hadir'
            : 'Izin diterima'
        }
        tone={entry.kind === 'hadir' ? 'solid' : 'neutral'}
      />
      <Text style={styles.tileTitle}>{session.practicumName}</Text>
      <Text style={styles.tileModule}>{formatMeetingTitle(session.moduleTitle)}</Text>
      <View style={styles.tileMeta}>
        {session.waktuMulai ? (
          <>
            <Text style={styles.tileMetaText}>{formatSessionDate(session.waktuMulai)}</Text>
            {range ? <Text style={styles.tileMetaText}>{range}</Text> : null}
          </>
        ) : (
          <Text style={styles.tileMetaText}>{session.scheduleTime}</Text>
        )}
        <Text style={styles.tileMetaText}>{session.classRoom}</Text>
      </View>
    </Tile>
  );
}

const styles = StyleSheet.create({
  banners: {
    gap: 8,
  },
  list: {
    gap: 12,
  },
  tileTitle: {
    fontFamily: FONT.extrabold,
    color: UI.onColor,
    fontSize: 19,
    letterSpacing: -0.3,
  },
  tileModule: {
    fontFamily: FONT.regular,
    color: UI.onColor,
    fontSize: 14,
  },
  tileMeta: {
    gap: 1,
    marginTop: 4,
  },
  tileMetaText: {
    fontFamily: FONT.regular,
    color: UI.onColor,
    fontSize: 13,
  },
});
