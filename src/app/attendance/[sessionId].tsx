import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FONT } from '@/constants/fonts';
import { useAuth } from '@/context/AuthContext';
import {
  subscribeLaboratoryById,
  type LaboratoryLocation,
} from '@/features/assistant/services/laboratory-service';
import { useDeviceLocation } from '@/features/location/hooks/use-device-location';
import type { DeviceCoordinates } from '@/features/location/types';
import {
  checkWithinRadius,
  formatDistance,
  type RadiusCheckResult,
} from '@/features/location/utils/geo';
import { LeaveRequestSheet } from '@/features/praktikan/components/leave-request-sheet';
import {
  PraktikanEmptyState,
  PraktikanErrorState,
  PraktikanInlineErrorBanner,
  PraktikanLoadingState,
} from '@/features/praktikan/components/praktikan-state-view';
import { usePraktikanLeaveRequests } from '@/features/praktikan/hooks/use-praktikan-leave-requests';
import { useSessionAttendance } from '@/features/praktikan/hooks/use-session-attendance';
import { subscribeSessionById } from '@/features/praktikan/services/praktikan-sessions';
import type { PraktikanSession } from '@/features/praktikan/types';
import { BackLink, Chip, classColor, MetaLine, Tile, UI } from '@/features/praktikan/ui/praktikan-ui';
import {
  formatAttendanceTimeWIB,
  formatMeetingTitle,
} from '@/features/praktikan/utils/format';
import { showLeaveSubmitSuccessAlert } from '@/features/praktikan/utils/leave-feedback';
import { formatClock, formatSessionDate } from '@/utils/session-time';
import { BORDER_COLOR, PAGE_BG } from '@/constants/colors';

/** Lokasi yang lebih tua dari ini diambil ulang sebelum presensi dikirim. */
const LOCATION_MAX_AGE_MS = 60_000;

/**
 * Halaman presensi berbasis lokasi, terpisah dari Detail Sesi (FR-01 s.d. FR-08).
 */
const LEAVE_STATUS_TEXT: Record<'menunggu' | 'diterima' | 'ditolak', string> = {
  menunggu: 'menunggu keputusan',
  diterima: 'diterima',
  ditolak: 'ditolak',
};

export default function AttendanceScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const trimmedId = (Array.isArray(sessionId) ? sessionId[0] : sessionId)?.trim() ?? '';
  const { role, status: authStatus } = useAuth();

  if (authStatus === 'loading') {
    return <PraktikanLoadingState fullScreen message="Memeriksa akun..." />;
  }

  if (role !== 'praktikan') {
    return (
      <ScreenShell>
        <PraktikanEmptyState
          title="Khusus Praktikan"
          message="Halaman presensi hanya dapat digunakan oleh akun Praktikan."
          actionLabel="Kembali"
          onAction={() => router.back()}
        />
      </ScreenShell>
    );
  }

  return <AttendanceContent sessionId={trimmedId} />;
}

function AttendanceContent({ sessionId }: { sessionId: string }) {
  const [session, setSession] = useState<PraktikanSession | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);

  const [lab, setLab] = useState<LaboratoryLocation | null>(null);
  const [labLoading, setLabLoading] = useState(false);
  const [labError, setLabError] = useState<string | null>(null);

  const {
    attendance,
    loading: attendanceLoading,
    submitting,
    error: submitError,
    submitAttendance,
    clearError,
    retry: retryAttendance,
  } = useSessionAttendance(sessionId);

  const {
    coords,
    loading: locating,
    error: locationError,
    refresh: refreshLocation,
  } = useDeviceLocation();

  // Pengajuan izin langsung dari halaman presensi.
  const [leaveSheetVisible, setLeaveSheetVisible] = useState(false);
  const {
    leaveBySessionId,
    submitting: leaveSubmitting,
    submittingStep: leaveSubmittingStep,
    submitError: leaveSubmitError,
    submitLeaveRequest,
    clearSubmitError: clearLeaveSubmitError,
  } = usePraktikanLeaveRequests();

  // Pemeriksaan lokasi berjalan otomatis sekali setiap halaman dibuka.
  const autoLocated = useRef(false);

  useEffect(() => {
    if (!sessionId) {
      setSession(null);
      setSessionLoading(false);
      setSessionError('ID sesi tidak valid.');
      return;
    }

    setSessionLoading(true);
    setSessionError(null);
    const unsubscribe = subscribeSessionById(
      sessionId,
      (next) => {
        setSession(next);
        setSessionError(null);
        setSessionLoading(false);
      },
      (err) => {
        setSessionError(err.message);
        setSessionLoading(false);
      },
    );
    return () => unsubscribe();
  }, [sessionId, retryNonce]);

  const labId = session?.labId ?? null;

  useEffect(() => {
    if (!labId) {
      setLab(null);
      setLabLoading(false);
      setLabError(null);
      return;
    }

    setLabLoading(true);
    setLabError(null);
    let unsubscribe: () => void;
    try {
      unsubscribe = subscribeLaboratoryById(
        labId,
        (next) => {
          setLab(next);
          setLabError(null);
          setLabLoading(false);
        },
        (err) => {
          setLabError(err.message);
          setLabLoading(false);
        },
      );
    } catch (err) {
      // labId sesi tidak termasuk 4 titik lokasi yang dikenal.
      setLab(null);
      setLabError(err instanceof Error ? err.message : 'Titik lokasi sesi tidak valid.');
      setLabLoading(false);
      return;
    }
    return () => unsubscribe();
  }, [labId, retryNonce]);

  const sessionOpen = session?.status === 'dibuka';
  const attended = attendance !== null;

  useEffect(() => {
    if (autoLocated.current) return;
    if (!sessionOpen || attended || attendanceLoading || !lab) return;
    autoLocated.current = true;
    void refreshLocation();
  }, [sessionOpen, attended, attendanceLoading, lab, refreshLocation]);

  if (sessionLoading && !session) {
    return <PraktikanLoadingState fullScreen message="Memuat informasi sesi..." />;
  }

  if (!session) {
    return (
      <ScreenShell>
        {sessionError ? (
          <PraktikanErrorState
            title="Gagal Memuat Sesi"
            message={sessionError}
            onRetry={() => setRetryNonce((n) => n + 1)}
            secondaryActionLabel="Kembali"
            onSecondaryAction={() => router.back()}
          />
        ) : (
          <PraktikanEmptyState
            title="Sesi Tidak Ditemukan"
            message="Data sesi praktikum tidak tersedia atau sudah dihapus."
            actionLabel="Kembali"
            onAction={() => router.back()}
          />
        )}
      </ScreenShell>
    );
  }

  const radiusCheck: RadiusCheckResult | null =
    coords && lab ? checkWithinRadius(coords, lab, lab.radius) : null;

  const isOpen = session.status === 'dibuka';
  const alreadyAttended = attendance !== null;
  const labReady = lab !== null;
  const canSubmit =
    isOpen &&
    !alreadyAttended &&
    !attendanceLoading &&
    labReady &&
    radiusCheck?.withinRadius === true &&
    !submitting &&
    !locating;

  // Izin yang sudah diajukan untuk sesi ini (satu pengajuan per sesi).
  const sessionLeave = leaveBySessionId[session.id] ?? null;
  const leaveInfo = sessionLeave ? (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push({ pathname: '/session/[id]', params: { id: session.id } })}
      style={({ pressed }) => [styles.leaveInfo, pressed && styles.pressed]}
    >
      <Text style={styles.leaveInfoText}>
        Izin sudah diajukan ({LEAVE_STATUS_TEXT[sessionLeave.status]}). Lihat detail
      </Text>
    </Pressable>
  ) : null;

  const leaveButton = sessionLeave ? null : (
    <Pressable
      accessibilityRole="button"
      disabled={submitting || leaveSubmitting}
      onPress={() => {
        clearLeaveSubmitError();
        setLeaveSheetVisible(true);
      }}
      style={({ pressed }) => [
        styles.secondaryButton,
        styles.flexButton,
        pressed && styles.pressed,
      ]}
    >
      <Text style={styles.secondaryButtonText}>Ajukan Izin</Text>
    </Pressable>
  );

  async function handleSubmit() {
    if (!canSubmit || !coords) return;
    clearError();

    let location: DeviceCoordinates | null = coords;
    if (Date.now() - coords.timestamp > LOCATION_MAX_AGE_MS) {
      location = await refreshLocation();
      if (!location) return;
    }

    await submitAttendance(location);
  }

  return (
    <ScreenShell scroll>
      <BackLink label="Kembali" onPress={() => router.back()} />

      <Tile color={classColor(session.classId ?? session.practicumName)}>
        <View style={styles.cardHeader}>
          <Text style={styles.title}>{session.practicumName}</Text>
          <Chip
            label={isOpen ? 'Berlangsung' : session.status === 'ditutup' ? 'Sesi Selesai' : 'Belum Dibuka'}
            tone={isOpen ? 'solid' : 'neutral'}
          />
        </View>
        <Text style={styles.heroModule}>{formatMeetingTitle(session.moduleTitle)}</Text>
        <View style={styles.heroMeta}>
          {session.waktuMulai ? (
            <>
              <MetaLine icon="date" textStyle={styles.heroMetaText}>{formatSessionDate(session.waktuMulai)}</MetaLine>
              {session.waktuSelesai ? (
                <MetaLine icon="time" textStyle={styles.heroMetaText}>
                  {formatClock(session.waktuMulai)} - {formatClock(session.waktuSelesai)} WIB
                </MetaLine>
              ) : null}
            </>
          ) : (
            <MetaLine icon="time" textStyle={styles.heroMetaText}>{session.scheduleTime}</MetaLine>
          )}
          <MetaLine icon="place" textStyle={styles.heroMetaText}>{session.classRoom}</MetaLine>
        </View>
      </Tile>

      {sessionError ? (
        <PraktikanInlineErrorBanner
          title="Sinkronisasi Sesi Terganggu"
          message={sessionError}
          onRetry={() => setRetryNonce((n) => n + 1)}
        />
      ) : null}

      <StatusNotice
        isOpen={isOpen}
        status={session.status}
        alreadyAttended={alreadyAttended}
        attendanceTime={formatAttendanceTimeWIB(attendance?.waktu ?? null)}
        labMissing={!labId || (!labLoading && !lab)}
        labError={labError}
      />

      {isOpen && !alreadyAttended && labReady ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Pemeriksaan Lokasi</Text>

          <LocationResult
            locating={locating}
            errorMessage={locationError?.message ?? null}
            coords={coords}
            check={radiusCheck}
            lab={lab}
          />

          <Pressable
            accessibilityRole="button"
            disabled={locating || submitting}
            onPress={() => void refreshLocation()}
            style={({ pressed }) => [
              styles.secondaryButton,
              (locating || submitting) && styles.disabled,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.secondaryButtonText}>
              {coords || locationError ? 'Periksa Ulang Lokasi' : 'Periksa Lokasi Saya'}
            </Text>
          </Pressable>

          <View style={styles.actionRow}>
            {leaveButton}

          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: !canSubmit }}
            disabled={!canSubmit}
            onPress={() => void handleSubmit()}
            style={({ pressed }) => [
              styles.primaryButton,
              styles.flexButton,
              !canSubmit && styles.primaryButtonDisabled,
              pressed && canSubmit && styles.pressed,
            ]}
          >
            {submitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text
                style={[
                  styles.primaryButtonText,
                  !canSubmit && styles.primaryButtonTextDisabled,
                ]}
              >
                Kirim Presensi
              </Text>
            )}
          </Pressable>
          </View>

          {submitError ? (
            <PraktikanInlineErrorBanner
              title="Presensi Gagal"
              message={submitError}
              onRetry={retryAttendance}
              retryLabel="Muat Ulang Status"
              onDismiss={clearError}
            />
          ) : null}
        </View>
      ) : !alreadyAttended ? (
        leaveInfo ?? <View style={styles.actionRow}>{leaveButton}</View>
      ) : null}

      {isOpen && !alreadyAttended && labReady && leaveInfo ? leaveInfo : null}

      <LeaveRequestSheet
        visible={leaveSheetVisible}
        sessions={[session]}
        preselectedSession={session}
        attendanceBySessionId={attendance ? { [session.id]: attendance } : {}}
        leaveBySessionId={leaveBySessionId}
        submitting={leaveSubmitting}
        submittingStep={leaveSubmittingStep}
        error={leaveSubmitError}
        attendanceError={null}
        onRetryData={retryAttendance}
        onClearError={clearLeaveSubmitError}
        onCancel={() => {
          if (!leaveSubmitting) {
            clearLeaveSubmitError();
            setLeaveSheetVisible(false);
          }
        }}
        onSubmit={async (targetSessionId, alasan) => {
          const outcome = await submitLeaveRequest({ sessionId: targetSessionId, alasan });
          if (outcome.ok) {
            setLeaveSheetVisible(false);
            showLeaveSubmitSuccessAlert(outcome);
          }
          return outcome;
        }}
      />
    </ScreenShell>
  );
}

function ScreenShell({
  children,
  scroll = false,
}: {
  children: React.ReactNode;
  scroll?: boolean;
}) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      {scroll ? (
        <ScrollView contentContainerStyle={styles.content}>{children}</ScrollView>
      ) : (
        <View style={styles.stateScreenPadding}>{children}</View>
      )}
    </SafeAreaView>
  );
}

function StatusNotice({
  isOpen,
  status,
  alreadyAttended,
  attendanceTime,
  labMissing,
  labError,
}: {
  isOpen: boolean;
  status: PraktikanSession['status'];
  alreadyAttended: boolean;
  attendanceTime: string | null;
  labMissing: boolean;
  labError: string | null;
}) {
  if (alreadyAttended) {
    return (
      <Notice tone="success" title="Presensi Tercatat">
        {attendanceTime ? `Kamu sudah presensi pada ${attendanceTime}.` : 'Kamu sudah presensi pada sesi ini.'}
      </Notice>
    );
  }

  if (!isOpen) {
    return (
      <Notice tone="neutral" title={status === 'ditutup' ? 'Sesi Sudah Ditutup' : 'Sesi Belum Dibuka'}>
        {status === 'ditutup'
          ? 'Presensi tidak dapat dilakukan karena sesi sudah ditutup Asisten.'
          : 'Presensi dapat dilakukan setelah Asisten membuka sesi.'}
      </Notice>
    );
  }

  if (labError) {
    return (
      <Notice tone="danger" title="Titik Lokasi Gagal Dimuat">
        {labError}
      </Notice>
    );
  }

  if (labMissing) {
    return (
      <Notice tone="warning" title="Lokasi Sesi Belum Diatur">
        Asisten belum mengatur titik lokasi atau koordinatnya untuk sesi ini, sehingga presensi
        belum dapat dilakukan.
      </Notice>
    );
  }

  return null;
}

function LocationResult({
  locating,
  errorMessage,
  coords,
  check,
  lab,
}: {
  locating: boolean;
  errorMessage: string | null;
  coords: DeviceCoordinates | null;
  check: RadiusCheckResult | null;
  lab: LaboratoryLocation | null;
}) {
  if (locating) {
    return (
      <View style={[styles.notice, styles.noticeNeutral, styles.row]}>
        <ActivityIndicator color="#404040" />
        <Text style={styles.noticeText}>Mengambil lokasi perangkat...</Text>
      </View>
    );
  }

  if (errorMessage) {
    return (
      <Notice tone="danger" title="Lokasi Tidak Dapat Diperoleh">
        {errorMessage}
      </Notice>
    );
  }

  if (!coords || !check || !lab) {
    return (
      <Notice tone="neutral" title="Lokasi Belum Diperiksa">
        Tekan &quot;Periksa Lokasi Saya&quot; untuk memastikan kamu berada di {lab?.name ?? 'lokasi sesi'}.
      </Notice>
    );
  }

  const accuracyText =
    coords.accuracy !== null ? ` Akurasi GPS ±${formatDistance(coords.accuracy)}.` : '';
  const mockedText = coords.mocked
    ? ' Perangkat terdeteksi memakai lokasi simulasi.'
    : '';

  return check.withinRadius ? (
    <Notice tone="success" title="Di Dalam Radius">
      Kamu berada {formatDistance(check.distance)} dari {lab.name} (batas{' '}
      {formatDistance(check.radius)}). Presensi dapat dikirim.{accuracyText}
      {mockedText}
    </Notice>
  ) : (
    <Notice tone="danger" title="Di Luar Radius">
      Kamu berada {formatDistance(check.distance)} dari {lab.name}, melebihi batas{' '}
      {formatDistance(check.radius)}. Mendekatlah ke lokasi lalu periksa ulang.{accuracyText}
      {mockedText}
    </Notice>
  );
}

type NoticeTone = 'success' | 'danger' | 'warning' | 'neutral';

function Notice({
  tone,
  title,
  children,
}: {
  tone: NoticeTone;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View
      style={[
        styles.notice,
        tone === 'success' && styles.noticeSuccess,
        tone === 'danger' && styles.noticeDanger,
        tone === 'warning' && styles.noticeWarning,
        tone === 'neutral' && styles.noticeNeutral,
      ]}
    >
      <Text
        style={[
          styles.noticeTitle,
          tone === 'success' && styles.noticeTitleSuccess,
          tone === 'danger' && styles.noticeTitleDanger,
          tone === 'warning' && styles.noticeTitleWarning,
        ]}
      >
        {title}
      </Text>
      <Text
        style={[
          styles.noticeText,
          tone !== 'neutral' && styles.noticeTextOnColor,
        ]}
      >
        {children}
      </Text>
    </View>
  );
}


const styles = StyleSheet.create({
  cardHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  flexButton: {
    flex: 1,
  },
  leaveInfo: {
    backgroundColor: '#FFFFFF',
    borderColor: BORDER_COLOR,
    borderRadius: 20,
    borderWidth: 1,
    padding: 14,
  },
  leaveInfoText: {
    fontFamily: FONT.semibold,
    color: '#111014',
    fontSize: 13,
    textAlign: 'center',
  },
  safeArea: {
    backgroundColor: PAGE_BG,
    flex: 1,
  },
  content: {
    gap: 18,
    padding: UI.padding,
    paddingTop: 16,
    paddingBottom: 40,
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
  stateScreenPadding: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    flex: 1,
    fontFamily: FONT.extrabold,
    color: UI.onColor,
    fontSize: 22,
    letterSpacing: -0.5,
      lineHeight: 27,
  },
  section: {
    gap: 12,
  },
  sectionTitle: {
    fontFamily: FONT.extrabold,
    color: '#000000',
    fontSize: 16,
  },
  notice: {
    borderRadius: 20,
    borderWidth: 1,
    gap: 4,
    padding: 14,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  // Sukses = oranye; gagal & peringatan = merah (teks putih); netral = putih bergaris.
  noticeSuccess: {
    backgroundColor: UI.accent,
    borderColor: UI.accent,
  },
  noticeDanger: {
    backgroundColor: UI.danger,
    borderColor: UI.danger,
  },
  noticeWarning: {
    backgroundColor: UI.danger,
    borderColor: UI.danger,
  },
  noticeNeutral: {
    backgroundColor: UI.card,
    borderColor: BORDER_COLOR,
  },
  noticeTitle: {
    fontFamily: FONT.extrabold,
    color: '#000000',
    fontSize: 14,
  },
  noticeTitleSuccess: {
    color: UI.onColor,
  },
  noticeTitleDanger: {
    color: UI.onColor,
  },
  noticeTitleWarning: {
    color: UI.onColor,
  },
  noticeTextOnColor: {
    color: UI.onColor,
  },
  noticeText: {
    fontFamily: FONT.regular,
    color: '#404040',
    fontSize: 13,
    lineHeight: 20,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: UI.ink,
    borderRadius: 999,
    minHeight: 52,
    justifyContent: 'center',
    padding: 16,
  },
  primaryButtonDisabled: {
    backgroundColor: '#E5E5E5',
  },
  primaryButtonText: {
    fontFamily: FONT.bold,
    color: '#FFFFFF',
    fontSize: 15,
  },
  primaryButtonTextDisabled: {
    color: '#737373',
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: UI.ink,
    borderRadius: 999,
    borderWidth: 1.5,
    minHeight: 48,
    justifyContent: 'center',
    padding: 14,
  },
  secondaryButtonText: {
    fontFamily: FONT.bold,
    color: '#000000',
    fontSize: 15,
  },
  disabled: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.65,
  },
});
