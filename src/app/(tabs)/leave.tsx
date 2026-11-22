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
import type {
  LeaveRequestDoc,
  LeaveRequestStatus,
  PraktikanSession,
} from '@/features/praktikan/types';
import { formatDateTimeWIB, formatMeetingTitle } from '@/features/praktikan/utils/format';
import {
  Chip,
  type ChipTone,
  classColor,
  MetaLine,
  Screen,
  ScreenTitle,
  Tile,
  UI,
} from '@/features/praktikan/ui/praktikan-ui';
import { formatClock, formatSessionDate } from '@/utils/session-time';
import { FONT } from '@/constants/fonts';

const STATUS_CHIP: Record<LeaveRequestStatus, { label: string; tone: ChipTone }> = {
  menunggu: { label: 'Menunggu keputusan', tone: 'neutral' },
  diterima: { label: 'Izin diterima', tone: 'solid' },
  ditolak: { label: 'Izin ditolak', tone: 'solid' },
};

/**
 * Pengajuan Izin Praktikan: hanya kartu praktikum yang sedang/pernah diajukan izinnya.
 * Pengajuan baru dilakukan dari halaman Detail Sesi.
 */
export default function LeaveScreen() {
  const { user, profile, role, status, loading, profileError } = useAuth();

  if (loading || status === 'loading') {
    return <PraktikanLoadingState fullScreen message="Memeriksa sesi akun..." />;
  }

  if (user && (profileError || !profile)) {
    return (
      <PraktikanProfileErrorScreen
        title="Pengajuan Izin"
        subtitle="Praktikum yang kamu ajukan izin beserta keputusan Asisten."
      />
    );
  }

  if (role !== 'praktikan') {
    return (
      <Screen>
        <ScreenTitle title="Pengajuan Izin" />
        <PraktikanEmptyState
          title="Khusus Praktikan"
          message="Halaman ini menampilkan pengajuan izin pribadi akun Praktikan."
        />
      </Screen>
    );
  }

  return <PraktikanLeaveList />;
}

function PraktikanLeaveList() {
  const { sessions, error: sessionsError, retry: retrySessions } = usePraktikanSessions();
  const {
    leaveRequests,
    loading,
    listError,
    retry: retryLeaves,
  } = usePraktikanLeaveRequests();

  const sessionById = useMemo(() => {
    const map: Record<string, PraktikanSession> = {};
    for (const session of sessions) map[session.id] = session;
    return map;
  }, [sessions]);

  const sorted = useMemo(
    () =>
      [...leaveRequests].sort(
        (a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0),
      ),
    [leaveRequests],
  );

  const initialLoading = loading && leaveRequests.length === 0;
  const fatalError = Boolean(listError) && leaveRequests.length === 0 && !loading;

  return (
    <Screen>
      <ScreenTitle
        title="Pengajuan Izin"
        subtitle="Praktikum yang kamu ajukan izin beserta keputusan Asisten."
      />

      {(listError && !fatalError) || sessionsError ? (
        <View style={styles.banners}>
          {listError && !fatalError ? (
            <PraktikanInlineErrorBanner
              title="Gagal Memperbarui Izin"
              message={listError}
              onRetry={retryLeaves}
            />
          ) : null}
          {sessionsError ? (
            <PraktikanInlineErrorBanner
              title="Detail Sesi Belum Termuat"
              message={sessionsError}
              onRetry={retrySessions}
            />
          ) : null}
        </View>
      ) : null}

      {initialLoading ? (
        <PraktikanLoadingState title="Memuat Pengajuan" message="Mengambil pengajuan izin kamu..." />
      ) : fatalError && listError ? (
        <PraktikanErrorState title="Gagal Memuat Izin" message={listError} onRetry={retryLeaves} />
      ) : sorted.length === 0 ? (
        <PraktikanEmptyState
          title="Belum Ada Pengajuan Izin"
          message="Jika berhalangan hadir, buka sesi di Beranda lalu pilih Ajukan Izin untuk Sesi Ini."
        />
      ) : (
        <View style={styles.list}>
          {sorted.map((leave) => (
            <LeaveTile key={leave.id} leave={leave} session={sessionById[leave.sessionId] ?? null} />
          ))}
        </View>
      )}
    </Screen>
  );
}

function LeaveTile({
  leave,
  session,
}: {
  leave: LeaveRequestDoc;
  session: PraktikanSession | null;
}) {
  const chip = STATUS_CHIP[leave.status];
  const range =
    session?.waktuMulai && session.waktuSelesai
      ? `${formatClock(session.waktuMulai)} - ${formatClock(session.waktuSelesai)} WIB`
      : null;
  const submittedAt = formatDateTimeWIB(leave.createdAt);
  const note = leave.catatanAsisten?.trim();

  return (
    <Tile
      color={classColor(session?.classId ?? session?.practicumName ?? leave.sessionId)}
      onPress={
        session
          ? () => router.push({ pathname: '/session/[id]', params: { id: session.id } })
          : undefined
      }
      accessibilityLabel={`${session?.practicumName ?? 'Sesi praktikum'}, ${chip.label}`}
    >
      <Chip label={chip.label} tone={chip.tone} />
      <Text style={styles.title}>{session?.practicumName ?? 'Sesi Praktikum'}</Text>
      {session ? (
        <Text style={styles.module}>{formatMeetingTitle(session.moduleTitle)}</Text>
      ) : null}

      {session ? (
        <View style={styles.meta}>
          {session.waktuMulai ? (
            <>
              <MetaLine icon="date" textStyle={styles.metaText}>{formatSessionDate(session.waktuMulai)}</MetaLine>
              {range ? <MetaLine icon="time" textStyle={styles.metaText}>{range}</MetaLine> : null}
            </>
          ) : (
            <MetaLine icon="time" textStyle={styles.metaText}>{session.scheduleTime}</MetaLine>
          )}
          <MetaLine icon="place" textStyle={styles.metaText}>{session.classRoom}</MetaLine>
        </View>
      ) : null}

      <View style={styles.reasonBox}>
        <Text style={styles.reasonLabel}>Alasan</Text>
        <Text style={styles.reasonText}>{leave.alasan}</Text>
        <Text style={styles.reasonFoot}>
          Kategori AI: {leave.kategoriAI ?? 'tidak tersedia'}
          {submittedAt ? ` · Diajukan ${submittedAt}` : ''}
        </Text>
      </View>

      {note ? (
        <View style={styles.reasonBox}>
          <Text style={styles.reasonLabel}>Catatan Asisten</Text>
          <Text style={styles.reasonText}>{note}</Text>
        </View>
      ) : null}
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
  title: {
    fontFamily: FONT.extrabold,
    color: UI.onColor,
    fontSize: 19,
    letterSpacing: -0.3,
  },
  module: {
    fontFamily: FONT.semibold,
    color: UI.onColor,
    fontSize: 14,
  },
  meta: {
    gap: 1,
  },
  metaText: {
    fontFamily: FONT.regular,
    color: UI.onColor,
    fontSize: 13,
  },
  reasonBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    gap: 3,
    marginTop: 4,
    padding: 12,
  },
  reasonLabel: {
    fontFamily: FONT.bold,
    color: UI.muted,
    fontSize: 11,
  },
  reasonText: {
    fontFamily: FONT.regular,
    color: UI.ink,
    fontSize: 14,
    lineHeight: 20,
  },
  reasonFoot: {
    fontFamily: FONT.regular,
    color: UI.muted,
    fontSize: 12,
    marginTop: 2,
  },
});
