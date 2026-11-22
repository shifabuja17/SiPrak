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
import { LeaveAiInfoBox } from '@/features/praktikan/components/leave-ai-info-box';
import { LeaveRequestSheet } from '@/features/praktikan/components/leave-request-sheet';
import { LeaveStatusBadge } from '@/features/praktikan/components/leave-status-badge';
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
import {
  formatDateTimeWIB,
  formatMeetingTitle,
} from '@/features/praktikan/utils/format';
import { showLeaveSubmitSuccessAlert } from '@/features/praktikan/utils/leave-feedback';
import { BackLink, Chip, classColor, MetaLine, Tile, UI } from '@/features/praktikan/ui/praktikan-ui';
import { formatClock, formatSessionDate } from '@/utils/session-time';
import { FONT } from '@/constants/fonts';

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
  const sessionLeaveDateLabel = sessionLeave
    ? (formatDateTimeWIB(sessionLeave.createdAt) ?? 'Menunggu sinkronisasi waktu...')
    : null;
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

        <PraktikanAttendanceSection session={session} />

        {sessionLeave ? (
          <View style={styles.leaveSectionStack}>
            {leaveSectionError ? (
              <PraktikanInlineErrorBanner
                title="Sinkronisasi Status Izin Terganggu"
                message={leaveSectionError}
                onRetry={retryLeave}
              />
            ) : null}

            <View style={styles.leaveSummaryCard}>
              <View style={styles.leaveSummaryHeader}>
                <Text style={styles.leaveSummaryTitle}>Status Pengajuan Izin</Text>
                <LeaveStatusBadge status={sessionLeave.status} />
              </View>

              {sessionLeaveDateLabel ? (
                <Text style={styles.leaveMetaText}>Diajukan: {sessionLeaveDateLabel}</Text>
              ) : null}

              <View style={styles.leaveReasonBox}>
                <Text style={styles.leaveReasonLabel}>Alasan Izin</Text>
                <Text style={styles.leaveReasonText}>{sessionLeave.alasan}</Text>
              </View>

              <LeaveAiInfoBox kategoriAI={sessionLeave.kategoriAI} />

              {assistantNote ? (
                <View
                  style={[
                    styles.leaveNoteBox,
                    sessionLeave.status === 'diterima'
                      ? styles.leaveNoteAccepted
                      : styles.leaveNoteRejected,
                  ]}
                >
                  <Text
                    style={[
                      styles.leaveNoteLabel,
                      sessionLeave.status === 'diterima'
                        ? styles.leaveNoteTextAccepted
                        : styles.leaveNoteTextRejected,
                    ]}
                  >
                    Catatan Asisten
                  </Text>
                  <Text
                    style={[
                      styles.leaveNoteText,
                      sessionLeave.status === 'diterima'
                        ? styles.leaveNoteTextAccepted
                        : styles.leaveNoteTextRejected,
                    ]}
                  >
                    {assistantNote}
                  </Text>
                </View>
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
        <Chip label={statusLabel} tone={session.status === 'dibuka' ? 'solid' : 'neutral'} />
        <Text style={styles.heroTitle}>{session.practicumName}</Text>
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

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: '#FFFFFF',
    flex: 1,
  },
  content: {
    gap: 20,
    padding: UI.padding,
    paddingTop: 16,
    paddingBottom: 40,
  },
  heroTitle: {
    fontFamily: FONT.extrabold,
    color: UI.onColor,
    fontSize: 26,
    letterSpacing: -0.5,
    lineHeight: 30,
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
    borderColor: '#D9D9D9',
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 16,
  },
  infoRow: {
    borderBottomColor: '#E5E5E5',
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
    borderColor: '#8E8E93',
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
    borderColor: '#BFBFBF',
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
    alignItems: 'center',
    borderColor: '#BFBFBF',
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
  leaveSummaryCard: {
    backgroundColor: UI.page,
    borderColor: UI.border,
    borderWidth: 1,
    borderRadius: UI.radiusCard,
    gap: 10,
    padding: 18,
  },
  leaveSummaryHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  leaveSummaryTitle: {
    fontFamily: FONT.bold,
    color: '#000000',
    flex: 1,
    fontSize: 15,
  },
  leaveMetaText: {
    fontFamily: FONT.semibold,
    color: '#666666',
    fontSize: 12,
  },
  leaveReasonBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    gap: 4,
    padding: 12,
  },
  leaveReasonLabel: {
    fontFamily: FONT.bold,
    color: '#525252',
    fontSize: 12,
  },
  leaveReasonText: {
    fontFamily: FONT.regular,
    color: '#171717',
    fontSize: 13,
    lineHeight: 19,
  },
  leaveNoteBox: {
    borderRadius: 18,
    borderWidth: 1,
    gap: 4,
    padding: 12,
  },
  leaveNoteAccepted: {
    backgroundColor: '#F47321',
    borderColor: '#F47321',
  },
  leaveNoteRejected: {
    backgroundColor: '#E00000',
    borderColor: '#E00000',
  },
  leaveNoteLabel: {
    fontFamily: FONT.bold,
    fontSize: 12,
  },
  leaveNoteText: {
    fontFamily: FONT.regular,
    fontSize: 13,
    lineHeight: 19,
  },
  leaveNoteTextAccepted: {
    color: '#FFFFFF',
  },
  leaveNoteTextRejected: {
    color: '#FFFFFF',
  },
  pressed: {
    opacity: 0.65,
  },
});
