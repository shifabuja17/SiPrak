import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
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

import { useAuth } from '@/context/AuthContext';
import { useDeviceLocation } from '@/features/location/hooks/use-device-location';
import {
  subscribeLaboratoryById,
  type LaboratoryLocation,
} from '@/features/assistant/services/laboratory-service';
import type { DeviceCoordinates } from '@/features/location/types';
import {
  checkWithinRadius,
  formatDistance,
  type RadiusCheckResult,
} from '@/features/location/utils/geo';
import {
  PraktikanEmptyState,
  PraktikanErrorState,
  PraktikanInlineErrorBanner,
  PraktikanLoadingState,
} from '@/features/praktikan/components/praktikan-state-view';
import { useSessionAttendance } from '@/features/praktikan/hooks/use-session-attendance';
import { BackLink, Chip, classColor, MetaLine, Tile, UI } from '@/features/praktikan/ui/praktikan-ui';
import { subscribeSessionById } from '@/features/praktikan/services/praktikan-sessions';
import type { PraktikanSession } from '@/features/praktikan/types';
import {
  formatAttendanceTimeWIB,
  formatMeetingTitle,
} from '@/features/praktikan/utils/format';
import { formatClock, formatSessionDate } from '@/utils/session-time';
import { FONT } from '@/constants/fonts';
import { isPraktikanRole } from '@/types/user';

/** Lokasi yang lebih tua dari ini diambil ulang sebelum presensi dikirim. */
const LOCATION_MAX_AGE_MS = 60_000;

/**
 * Halaman presensi berbasis lokasi, terpisah dari Detail Sesi (FR-01 s.d. FR-08).
 */
export default function AttendanceScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const trimmedId = (Array.isArray(sessionId) ? sessionId[0] : sessionId)?.trim() ?? '';
  const { role, status: authStatus } = useAuth();

  if (authStatus === 'loading') {
    return <PraktikanLoadingState fullScreen message="Memeriksa akun..." />;
  }

  if (!isPraktikanRole(role)) {
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

  const [successInfo, setSuccessInfo] = useState<RadiusCheckResult | null>(null);

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

  async function handleSubmit() {
    if (!canSubmit || !coords) return;
    clearError();

    let location: DeviceCoordinates | null = coords;
    if (Date.now() - coords.timestamp > LOCATION_MAX_AGE_MS) {
      location = await refreshLocation();
      if (!location) return;
    }

    const result = await submitAttendance(location);
    if (result) {
      setSuccessInfo(result.check);
    }
  }

  return (
    <ScreenShell scroll>
      <BackLink label="Kembali" onPress={() => router.back()} />

      <Tile color={classColor(session.classId ?? session.practicumName)}>
        <Chip
          label={isOpen ? 'Presensi dibuka' : session.status === 'ditutup' ? 'Sesi selesai' : 'Belum dibuka'}
          tone={isOpen ? 'solid' : 'neutral'}
        />
        <Text style={styles.title}>{session.practicumName}</Text>
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

      <View style={styles.card}>
        <Info
          label="Titik Lokasi Presensi"
          value={
            !labId
              ? 'Belum diatur Asisten'
              : labLoading
                ? 'Memuat...'
                : lab
                  ? `${lab.name} · radius ${formatDistance(lab.radius)}`
                  : 'Koordinat belum diatur Asisten'
          }
          last
        />
      </View>

      <StatusNotice
        isOpen={isOpen}
        status={session.status}
        alreadyAttended={alreadyAttended}
        attendanceTime={formatAttendanceTimeWIB(attendance?.waktu ?? null)}
        attendanceDistance={successInfo?.distance ?? attendance?.jarak ?? null}
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

          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: !canSubmit }}
            disabled={!canSubmit}
            onPress={() => void handleSubmit()}
            style={({ pressed }) => [
              styles.primaryButton,
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
      ) : null}
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
  attendanceDistance,
  labMissing,
  labError,
}: {
  isOpen: boolean;
  status: PraktikanSession['status'];
  alreadyAttended: boolean;
  attendanceTime: string | null;
  attendanceDistance: number | null;
  labMissing: boolean;
  labError: string | null;
}) {
  if (alreadyAttended) {
    return (
      <Notice tone="success" title="Presensi Tercatat">
        {attendanceTime ? `Kamu sudah presensi pada ${attendanceTime}.` : 'Kamu sudah presensi pada sesi ini.'}
        {attendanceDistance !== null
          ? ` Jarak saat presensi: ${formatDistance(attendanceDistance)}.`
          : ''}
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

function Info({ label, value, last = false }: { label: string; value: string; last?: boolean }) {
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
    fontFamily: FONT.extrabold,
    color: UI.onColor,
    fontSize: 26,
    letterSpacing: -0.5,
    lineHeight: 30,
  },
  card: {
    backgroundColor: UI.page,
    borderColor: UI.border,
    borderWidth: 1,
    borderRadius: UI.radiusCard,
    paddingHorizontal: 18,
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
    backgroundColor: UI.page,
    borderColor: UI.border,
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
