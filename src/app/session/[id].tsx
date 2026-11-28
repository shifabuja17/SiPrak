import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import BackButton from '@/components/common/BackButton';
import StatusBadge, {
  type StatusBadgeStatus,
} from '@/components/common/StatusBadge';
import { useAuth } from '@/context/AuthContext';
import { usePracticum } from '@/context/PracticumContext';
import { AttendanceSummary } from '@/features/assistant/components/attendance-summary';
import { LeaveRequestSheet } from '@/features/praktikan/components/leave-request-sheet';
import PraktikanAttendanceSection from '@/features/praktikan/components/praktikan-attendance-section';
import {
  PraktikanEmptyState,
  PraktikanErrorState,
  PraktikanInlineErrorBanner,
  PraktikanLoadingState,
  PraktikanProfileErrorScreen,
} from '@/features/praktikan/components/praktikan-state-view';
import { usePraktikanLeaveRequests } from '@/features/praktikan/hooks/use-praktikan-leave-requests';
import { useSessionAttendance } from '@/features/praktikan/hooks/use-session-attendance';
import { subscribeSessionById } from '@/features/praktikan/services/praktikan-sessions';
import type { PraktikanSession } from '@/features/praktikan/types';
import { formatMeetingTitle } from '@/features/praktikan/utils/format';
import { showLeaveSubmitSuccessAlert } from '@/features/praktikan/utils/leave-feedback';
import { BackLink, Chip, classColor, MetaLine, Tile, UI } from '@/features/praktikan/ui/praktikan-ui';
import { formatClock, formatSessionDate } from '@/utils/session-time';
import { FONT } from '@/constants/fonts';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { BORDER_COLOR, PAGE_BG } from '@/constants/colors';

export default function SessionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const sessionIdParam = Array.isArray(id) ? id[0] : id;

  const {
    user,
    profile,
    role: authRole,
    status: authStatus,
    loading: authLoading,
    profileError,
  } = useAuth();
  const { currentUser } = usePracticum();

  if (authLoading || authStatus === 'loading') {
    return <PraktikanLoadingState fullScreen message="Memeriksa sesi akun..." />;
  }

  if (user && (profileError || !profile)) {
    return (
      <PraktikanProfileErrorScreen
        title="Detail Sesi"
        subtitle="Lihat informasi pertemuan, presensi, dan status pengajuan izin Anda."
      />
    );
  }

  if (authRole === 'praktikan') {
    return <PraktikanSessionDetail sessionId={sessionIdParam} />;
  }

  if (
    authRole === 'asisten' ||
    (authRole === null && currentUser.role === 'asisten')
  ) {
    return <AssistantSessionDetail sessionId={sessionIdParam} />;
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.stateScreenPadding}>
        <PraktikanEmptyState
          title="Autentikasi Diperlukan"
          message="Silakan login menggunakan akun Firebase Praktikan untuk mengakses detail sesi dan presensi."
          actionLabel="Kembali"
          onAction={() => router.back()}
        />
      </View>
    </SafeAreaView>
  );
}

function PraktikanSessionDetail({
  sessionId,
}: {
  sessionId: string | undefined;
}) {
  const [session, setSession] = useState<PraktikanSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);
  const [leaveSheetVisible, setLeaveSheetVisible] = useState(false);

  const trimmedId = sessionId?.trim() ?? '';

  const {
    attendance,
    loading: attendanceLoading,
    error: attendanceError,
    retry: retryAttendance,
  } = useSessionAttendance(trimmedId);

  const {
    leaveBySessionId,
    loading: leaveLoading,
    submitting: leaveSubmitting,
    submittingStep: leaveSubmittingStep,
    listError: leaveListError,
    submitError: leaveSubmitError,
    submitLeaveRequest,
    clearSubmitError: clearLeaveSubmitError,
    retry: retryLeave,
  } = usePraktikanLeaveRequests();

  useEffect(() => {
    if (!trimmedId) {
      setSession(null);
      setLoading(false);
      setError('ID sesi tidak valid.');
      return;
    }

    setLoading(true);
    setError(null);

    const unsubscribe = subscribeSessionById(
      trimmedId,
      (nextSession) => {
        setSession(nextSession);
        setError(null);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
    );

    return () => {
      unsubscribe();
    };
  }, [trimmedId, retryNonce]);

  if (loading && !session) {
    return <PraktikanLoadingState fullScreen message="Memuat detail sesi..." />;
  }

  if (error && !session) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.stateScreenPadding}>
          <PraktikanErrorState
            title="Gagal Memuat Sesi"
            message={error}
            onRetry={() => setRetryNonce((prev) => prev + 1)}
            secondaryActionLabel="Kembali ke Jadwal"
            onSecondaryAction={() => router.back()}
          />
        </View>
      </SafeAreaView>
    );
  }

  if (!session) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.stateScreenPadding}>
          <PraktikanEmptyState
            title="Sesi Tidak Ditemukan"
            message="Data sesi praktikum tidak tersedia atau mungkin telah dihapus oleh Asisten."
            actionLabel="Kembali ke Jadwal"
            onAction={() => router.back()}
          />
        </View>
      </SafeAreaView>
    );
  }

  const sessionLeave = leaveBySessionId[session.id] ?? null;
  const isLeaveCheckLoading = attendanceLoading || leaveLoading;
  const leaveSectionError = leaveListError;
  const assistantNote =
    sessionLeave &&
    (sessionLeave.status === 'diterima' || sessionLeave.status === 'ditolak') &&
    typeof sessionLeave.catatanAsisten === 'string' &&
    sessionLeave.catatanAsisten.trim().length > 0
      ? sessionLeave.catatanAsisten.trim()
      : null;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />

      <ScrollView contentContainerStyle={styles.content}>
        {error ? (
          <PraktikanInlineErrorBanner
            title="Sinkronisasi Sesi Terganggu"
            message={error}
            onRetry={() => setRetryNonce((prev) => prev + 1)}
          />
        ) : null}

        <SessionHero session={session} />

        {/* Sesi dengan pengajuan izin tidak perlu tombol presensi. */}
        {sessionLeave ? null : <PraktikanAttendanceSection session={session} />}

        {sessionLeave ? (
          <View style={styles.leaveSectionStack}>
            {leaveSectionError ? (
              <PraktikanInlineErrorBanner
                title="Sinkronisasi Status Izin Terganggu"
                message={leaveSectionError}
                onRetry={retryLeave}
              />
            ) : null}

            <View style={styles.divider} />

            <View style={styles.leaveDetail}>
              <Text style={styles.leaveDetailTitle}>Detail Pengajuan Izin</Text>

              <LeaveDetailRow icon="reason" label="Alasan Izin" value={sessionLeave.alasan} />
              <LeaveDetailRow
                icon="date"
                label="Diajukan"
                value={formatSubmittedFull(sessionLeave.createdAt)}
              />
              <LeaveDetailRow
                icon="ai"
                label="Kategori AI"
                value={sessionLeave.kategoriAI ?? 'Tidak tersedia'}
              />
              <LeaveDetailRow
                icon="status"
                label="Status"
                value={LEAVE_STATUS_LABEL[sessionLeave.status]}
                valueColor={LEAVE_STATUS_COLOR[sessionLeave.status]}
              />
              {assistantNote ? (
                <LeaveDetailRow icon="note" label="Catatan Asisten" value={assistantNote} />
              ) : null}
            </View>
          </View>
        ) : isLeaveCheckLoading ? (
          <PraktikanLoadingState message="Memeriksa status presensi dan pengajuan izin..." />
        ) : leaveSectionError && !attendance && attendanceError ? (
          <PraktikanInlineErrorBanner
            title="Status Presensi & Izin Belum Dapat Diperiksa"
            message={`${attendanceError} ${leaveSectionError}`}
            onRetry={() => {
              retryAttendance();
              retryLeave();
            }}
          />
        ) : leaveSectionError ? (
          <PraktikanInlineErrorBanner
            title="Gagal Memuat Status Izin"
            message={leaveSectionError}
            onRetry={retryLeave}
          />
        ) : !attendance && attendanceError ? (
          <PraktikanInlineErrorBanner
            title="Kelayakan Izin Menunggu Verifikasi Presensi"
            message={`Status presensi sesi ini gagal diperiksa (${attendanceError}). Muat ulang status presensi sebelum mengajukan izin.`}
            onRetry={retryAttendance}
          />
        ) : !attendance ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              clearLeaveSubmitError();
              setLeaveSheetVisible(true);
            }}
            style={({ pressed }) => [
              styles.secondaryButton,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.secondaryButtonText}>Ajukan Izin untuk Sesi Ini</Text>
          </Pressable>
        ) : null}
      </ScrollView>

      <LeaveRequestSheet
        visible={leaveSheetVisible}
        sessions={[session]}
        preselectedSession={session}
        attendanceBySessionId={attendance ? { [session.id]: attendance } : {}}
        leaveBySessionId={leaveBySessionId}
        submitting={leaveSubmitting}
        submittingStep={leaveSubmittingStep}
        error={leaveSubmitError}
        attendanceError={attendanceError}
        onRetryData={retryAttendance}
        onClearError={clearLeaveSubmitError}
        onCancel={() => {
          if (!leaveSubmitting) {
            clearLeaveSubmitError();
            setLeaveSheetVisible(false);
          }
        }}
        onSubmit={async (targetSessionId, alasan) => {
          const outcome = await submitLeaveRequest({
            sessionId: targetSessionId,
            alasan,
          });
          if (outcome.ok) {
            setLeaveSheetVisible(false);
            showLeaveSubmitSuccessAlert(outcome);
          }
          return outcome;
        }}
      />
    </SafeAreaView>
  );
}

/**
 * Tampilan detail sesi untuk Asisten (dipertahankan agar alur P2 tidak terganggu).
 */
function AssistantSessionDetail({
  sessionId,
}: {
  sessionId: string | undefined;
}) {
  const { sessions, openSession, closeSession } = usePracticum();

  const [modalVisible, setModalVisible] = useState(false);
  const [sessionNote, setSessionNote] = useState('');

  const session = sessions.find((item) => item.id === sessionId);

  if (!session) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.missingContainer}>
          <Text style={styles.title}>Sesi tidak ditemukan</Text>

          <Pressable
            onPress={() => router.back()}
            style={styles.primaryButton}
          >
            <Text style={styles.primaryButtonText}>Kembali ke Jadwal</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const resolvedSessionId = session.id;
  const currentSessionStatus = session.status;

  function handleConfirmAction() {
    const actionLabel =
      currentSessionStatus === 'dijadwalkan' ? 'dibuka' : 'ditutup';

    try {
      if (currentSessionStatus === 'dijadwalkan') {
        openSession(resolvedSessionId, sessionNote);
      } else if (currentSessionStatus === 'dibuka') {
        closeSession(resolvedSessionId);
      } else {
        throw new Error('Sesi yang sudah selesai tidak dapat diubah.');
      }

      setSessionNote('');
      setModalVisible(false);

      Alert.alert('Berhasil', `Sesi berhasil ${actionLabel}.`);
    } catch (error) {
      Alert.alert(
        'Gagal',
        error instanceof Error ? error.message : 'Terjadi kesalahan.',
      );
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />

      <ScrollView contentContainerStyle={styles.content}>
        <SessionOverview
          practicumName={session.practicumName}
          status={session.status}
          moduleTitle={session.moduleTitle}
          classRoom={session.classRoom}
          scheduleTime={session.scheduleTime}
          sessionNote={session.sessionNote}
        />

        {session.status === 'dijadwalkan' && (
          <Pressable
            style={({ pressed }) => [
              styles.primaryButton,
              pressed && styles.pressed,
            ]}
            onPress={() => setModalVisible(true)}
          >
            <Text style={styles.primaryButtonText}>Buka Sesi</Text>
          </Pressable>
        )}

        {session.status === 'dibuka' && (
          <Pressable
            style={({ pressed }) => [
              styles.secondaryButton,
              pressed && styles.pressed,
            ]}
            onPress={() => setModalVisible(true)}
          >
            <Text style={styles.secondaryButtonText}>Tutup Sesi</Text>
          </Pressable>
        )}

        {session.status === 'ditutup' && (
          <View style={styles.notice}>
            <Text style={styles.noticeText}>Sesi ini sudah selesai.</Text>
          </View>
        )}

        <AttendanceSummary records={session.attendances} />
      </ScrollView>

      <Modal
        animationType="slide"
        transparent
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        {/* Kartu ikut naik di atas keyboard saat kolom catatan diisi. */}
        <KeyboardAvoidingView behavior="padding" style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {session.status === 'dijadwalkan'
                ? 'Buka sesi praktikum?'
                : 'Tutup sesi praktikum?'}
            </Text>

            <Text style={styles.modalDescription}>
              {session.status === 'dijadwalkan'
                ? 'Sesi akan berubah menjadi berlangsung sehingga praktikan dapat melakukan presensi.'
                : 'Sesi akan ditandai selesai dan tidak dapat menerima presensi baru.'}
            </Text>

            {session.status === 'dijadwalkan' && (
              <>
                <Text style={styles.inputLabel}>
                  Catatan / materi sesi (opsional)
                </Text>

                <TextInput
                  value={sessionNote}
                  onChangeText={setSessionNote}
                  placeholder="Contoh: bahas latihan bagian 1–3"
                  placeholderTextColor="#777777"
                  multiline
                  textAlignVertical="top"
                  style={styles.noteInput}
                />
              </>
            )}

            <View style={styles.modalActions}>
              <Pressable
                style={({ pressed }) => [
                  styles.cancelButton,
                  pressed && styles.pressed,
                ]}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Batal</Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  styles.confirmButton,
                  pressed && styles.pressed,
                ]}
                onPress={handleConfirmAction}
              >
                <Text style={styles.confirmButtonText}>Konfirmasi</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

/** Ringkasan sesi untuk Praktikan dengan gaya kartu Beranda (warna per kelas). */
function SessionHero({ session }: { session: PraktikanSession }) {
  const statusLabel =
    session.status === 'dibuka'
      ? 'Berlangsung'
      : session.status === 'ditutup'
        ? 'Selesai'
        : 'Belum dibuka';
  const range =
    session.waktuMulai && session.waktuSelesai
      ? `${formatClock(session.waktuMulai)} - ${formatClock(session.waktuSelesai)} WIB`
      : null;

  return (
    <>
      <BackLink label="Kembali" onPress={() => router.back()} />
      <Tile color={classColor(session.classId ?? session.practicumName)}>
        <View style={styles.cardHeader}>
          <Text style={styles.heroTitle}>{session.practicumName}</Text>
          <Chip label={statusLabel} tone={session.status === 'dibuka' ? 'solid' : 'neutral'} />
        </View>
        <Text style={styles.heroModule}>{formatMeetingTitle(session.moduleTitle)}</Text>
        <View style={styles.heroMeta}>
          {session.waktuMulai ? (
            <>
              <MetaLine icon="date" textStyle={styles.heroMetaText}>{formatSessionDate(session.waktuMulai)}</MetaLine>
              {range ? <MetaLine icon="time" textStyle={styles.heroMetaText}>{range}</MetaLine> : null}
            </>
          ) : (
            <MetaLine icon="time" textStyle={styles.heroMetaText}>{session.scheduleTime}</MetaLine>
          )}
          <MetaLine icon="place" textStyle={styles.heroMetaText}>{session.classRoom}</MetaLine>
        </View>
        {session.sessionNote ? (
          <View style={styles.heroNote}>
            <Text style={styles.heroNoteLabel}>Catatan Sesi</Text>
            <Text style={styles.heroNoteText}>{session.sessionNote}</Text>
          </View>
        ) : null}
      </Tile>
    </>
  );
}

function SessionOverview({
  practicumName,
  status,
  moduleTitle,
  classRoom,
  scheduleTime,
  sessionNote,
}: {
  practicumName: string;
  status: StatusBadgeStatus;
  moduleTitle: string;
  classRoom: string;
  scheduleTime: string;
  sessionNote: string;
}) {
  return (
    <>
      <BackButton label="Kembali ke jadwal" onPress={() => router.back()} />

      <View style={styles.titleBlock}>
        <Text style={styles.title}>{practicumName}</Text>

        <StatusBadge status={status} />
      </View>

      <View style={styles.infoCard}>
        <Info
          label="Pertemuan dan Materi"
          value={formatMeetingTitle(moduleTitle)}
        />

        <Info label="Lokasi" value={classRoom} />

        <Info label="Jadwal" value={scheduleTime} />

        <Info label="Catatan Sesi" value={sessionNote || '-'} last />
      </View>
    </>
  );
}

function Info({
  label,
  value,
  last = false,
}: {
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <View style={[styles.infoRow, last && styles.infoRowLast]}>
      <Text style={styles.infoLabel}>{label}</Text>

      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

// ==========================================
// DETAIL PENGAJUAN IZIN
// ==========================================

type LeaveDetailIconName = 'reason' | 'date' | 'ai' | 'status' | 'note';

const LEAVE_STATUS_LABEL: Record<'menunggu' | 'diterima' | 'ditolak', string> = {
  menunggu: 'Menunggu',
  diterima: 'Diterima',
  ditolak: 'Ditolak',
};

const LEAVE_STATUS_COLOR: Record<'menunggu' | 'diterima' | 'ditolak', string> = {
  menunggu: '#8E8E93',
  diterima: '#16A34A',
  ditolak: '#E00000',
};

/** "Minggu, 23 November 2026, 14.13 WIB" */
function formatSubmittedFull(date: Date | null | undefined): string {
  if (!date) return 'Menunggu sinkronisasi waktu...';
  const day = date.toLocaleDateString('id-ID', {
    timeZone: 'Asia/Jakarta',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  return `${day}, ${formatClock(date)} WIB`;
}

function LeaveDetailIcon({ name }: { name: LeaveDetailIconName }) {
  const stroke = {
    stroke: UI.ink,
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      {name === 'reason' && (
        <>
          <Path d="M7 3.5H14L18.5 8V20.5H7Z" {...stroke} />
          <Path d="M14 3.5V8H18.5M9.5 12H16M9.5 15.5H14" {...stroke} />
        </>
      )}
      {name === 'date' && (
        <>
          <Rect x={4} y={5.5} width={16} height={14.5} rx={2} {...stroke} />
          <Path d="M8 3.5V7M16 3.5V7M4 10H20" {...stroke} />
        </>
      )}
      {name === 'ai' && (
        <Path
          d="M12 3.5L13.8 9.2L19.5 11L13.8 12.8L12 18.5L10.2 12.8L4.5 11L10.2 9.2Z"
          {...stroke}
        />
      )}
      {name === 'status' && (
        <>
          <Circle cx={12} cy={12} r={8.5} {...stroke} />
          <Path d="M8.5 12.2L11 14.7L15.5 9.8" {...stroke} />
        </>
      )}
      {name === 'note' && (
        <Path
          d="M5 6.5C5 5.4 5.9 4.5 7 4.5H17C18.1 4.5 19 5.4 19 6.5V14C19 15.1 18.1 16 17 16H11L7 19.5V16C5.9 16 5 15.1 5 14Z"
          {...stroke}
        />
      )}
    </Svg>
  );
}

function LeaveDetailRow({
  icon,
  label,
  value,
  valueColor,
}: {
  icon: LeaveDetailIconName;
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <View style={styles.leaveRow}>
      <View style={styles.leaveRowIcon}>
        <LeaveDetailIcon name={icon} />
      </View>
      <View style={styles.leaveRowText}>
        <Text style={styles.leaveRowLabel}>{label}</Text>
        <Text style={[styles.leaveRowValue, valueColor ? { color: valueColor, fontFamily: FONT.bold } : null]}>
          {value}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cardHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
  },
  divider: {
    backgroundColor: '#E4E4E7',
    height: 1,
  },
  leaveDetail: {
    gap: 14,
  },
  leaveDetailTitle: {
    fontFamily: FONT.extrabold,
    color: UI.ink,
    fontSize: 18,
  },
  leaveRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
  },
  leaveRowIcon: {
    alignItems: 'center',
    height: 22,
    justifyContent: 'center',
    width: 22,
  },
  leaveRowText: {
    flex: 1,
    gap: 2,
  },
  leaveRowLabel: {
    fontFamily: FONT.semibold,
    color: UI.muted,
    fontSize: 12,
  },
  leaveRowValue: {
    fontFamily: FONT.regular,
    color: UI.ink,
    fontSize: 14,
    lineHeight: 20,
  },
  safeArea: {
    backgroundColor: PAGE_BG,
    flex: 1,
  },
  content: {
    gap: 20,
    padding: UI.padding,
    paddingTop: 16,
    paddingBottom: 40,
  },
  heroTitle: {
    flex: 1,
    fontFamily: FONT.extrabold,
    color: UI.onColor,
    fontSize: 22,
    letterSpacing: -0.5,
      lineHeight: 27,
  },
  heroModule: {
    fontFamily: FONT.regular,
    color: UI.onColor,
    fontSize: 15,
  },
  heroMeta: {
    gap: 1,
    marginTop: 4,
  },
  heroMetaText: {
    fontFamily: FONT.regular,
    color: UI.onColor,
    fontSize: 14,
  },
  heroNote: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    gap: 3,
    marginTop: 6,
    padding: 12,
  },
  heroNoteLabel: {
    fontFamily: FONT.bold,
    color: UI.muted,
    fontSize: 11,
  },
  heroNoteText: {
    fontFamily: FONT.regular,
    color: UI.ink,
    fontSize: 14,
    lineHeight: 20,
  },
  stateScreenPadding: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  missingContainer: {
    flex: 1,
    gap: 16,
    justifyContent: 'center',
    padding: 20,
  },
  titleBlock: {
    gap: 10,
  },
  title: {
    fontFamily: FONT.extrabold,
    color: '#000000',
    fontSize: 25,
    lineHeight: 32,
  },
  infoCard: {
    backgroundColor: '#FFFFFF',
    borderColor: BORDER_COLOR,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 16,
  },
  infoRow: {
    borderBottomColor: BORDER_COLOR,
    borderBottomWidth: 1,
    gap: 5,
    paddingVertical: 14,
  },
  infoRowLast: {
    borderBottomWidth: 0,
  },
  infoLabel: {
    fontFamily: FONT.semibold,
    color: '#666666',
    fontSize: 12,
  },
  infoValue: {
    fontFamily: FONT.semibold,
    color: '#000000',
    fontSize: 14,
    lineHeight: 20,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: UI.ink,
    borderRadius: 999,
    justifyContent: 'center',
    minHeight: 50,
    paddingHorizontal: 22,
  },
  primaryButtonText: {
    fontFamily: FONT.bold,
    color: '#FFFFFF',
    fontSize: 15,
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: UI.ink,
    borderRadius: 999,
    borderWidth: 1.5,
    justifyContent: 'center',
    minHeight: 50,
    paddingHorizontal: 22,
  },
  secondaryButtonText: {
    fontFamily: FONT.bold,
    color: '#000000',
    fontSize: 15,
  },
  notice: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: BORDER_COLOR,
    borderWidth: 1,
    borderRadius: 14,
    padding: 15,
  },
  noticeText: {
    fontFamily: FONT.semibold,
    color: '#404040',
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
  modalBackdrop: {
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    gap: 14,
    padding: 22,
    paddingBottom: 32,
  },
  modalTitle: {
    fontFamily: FONT.extrabold,
    color: '#000000',
    fontSize: 20,
  },
  modalDescription: {
    fontFamily: FONT.regular,
    color: '#404040',
    fontSize: 14,
    lineHeight: 21,
  },
  inputLabel: {
    fontFamily: FONT.bold,
    color: '#000000',
    fontSize: 13,
  },
  noteInput: {
    backgroundColor: '#FFFFFF',
    borderColor: BORDER_COLOR,
    borderRadius: 12,
    borderWidth: 1,
    color: '#000000',
    minHeight: 92,
    padding: 12,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  cancelButton: {
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    borderColor: BORDER_COLOR,
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    padding: 14,
  },
  cancelButtonText: {
    fontFamily: FONT.bold,
    color: '#000000',
    fontSize: 14,
  },
  confirmButton: {
    alignItems: 'center',
    backgroundColor: '#000000',
    borderRadius: 12,
    flex: 1,
    padding: 14,
  },
  confirmButtonText: {
    fontFamily: FONT.bold,
    color: '#FFFFFF',
    fontSize: 14,
  },
  leaveSectionStack: {
    gap: 10,
  },
  pressed: {
    opacity: 0.65,
  },
});
