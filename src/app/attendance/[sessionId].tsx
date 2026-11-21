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

import StatusBadge from '@/components/common/StatusBadge';
import { useAuth } from '@/context/AuthContext';
import { useDeviceLocation } from '@/features/location/hooks/use-device-location';
import { subscribeLaboratory } from '@/features/location/services/laboratory-service';
import type { DeviceCoordinates, Laboratory } from '@/features/location/types';
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
import { subscribeSessionById } from '@/features/praktikan/services/praktikan-sessions';
import type { PraktikanSession } from '@/features/praktikan/types';
import {
  formatAttendanceTimeWIB,
  formatMeetingTitle,
} from '@/features/praktikan/utils/format';

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

  const [lab, setLab] = useState<Laboratory | null>(null);
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
    const unsubscribe = subscribeLaboratory(
      labId,
      (next) => {
        setLab(next);
        setLabLoading(false);
      },
      (err) => {
        setLabError(err.message);
        setLabLoading(false);
      },
    );
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
      <Pressable onPress={() => router.back()} style={styles.backButton}>
        <Text style={styles.backText}>‹ Kembali ke detail sesi</Text>
      </Pressable>

      <View style={styles.titleBlock}>
        <Text style={styles.eyebrow}>Presensi</Text>
        <Text style={styles.title}>{session.practicumName}</Text>
        <StatusBadge status={session.status} />
      </View>

      {sessionError ? (
        <PraktikanInlineErrorBanner
          title="Sinkronisasi Sesi Terganggu"
          message={sessionError}
          onRetry={() => setRetryNonce((n) => n + 1)}
        />
      ) : null}

      <View style={styles.card}>
        <Info label="Pertemuan dan Materi" value={formatMeetingTitle(session.moduleTitle)} />
        <Info label="Ruang" value={session.classRoom} />
        <Info label="Jadwal" value={session.scheduleTime} />
        <Info
          label="Titik Lokasi Presensi"
          value={
            !labId
              ? 'Belum diatur Asisten'
              : labLoading
                ? 'Memuat...'
                : lab
                  ? `${lab.nama} · radius ${formatDistance(lab.radius)}`
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
  lab: Laboratory | null;
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
        Tekan &quot;Periksa Lokasi Saya&quot; untuk memastikan kamu berada di {lab?.nama ?? 'lokasi sesi'}.
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
      Kamu berada {formatDistance(check.distance)} dari {lab.nama} (batas{' '}
      {formatDistance(check.radius)}). Presensi dapat dikirim.{accuracyText}
      {mockedText}
    </Notice>
  ) : (
    <Notice tone="danger" title="Di Luar Radius">
      Kamu berada {formatDistance(check.distance)} dari {lab.nama}, melebihi batas{' '}
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
      <Text style={styles.noticeText}>{children}</Text>
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
    gap: 20,
    padding: 20,
    paddingTop: 32,
    paddingBottom: 40,
  },
  stateScreenPadding: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  backButton: {
    alignSelf: 'flex-start',
    paddingVertical: 5,
  },
  backText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '700',
  },
  titleBlock: {
    gap: 8,
  },
  eyebrow: {
    color: '#666666',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  title: {
    color: '#000000',
    fontSize: 25,
    fontWeight: '800',
    lineHeight: 32,
  },
  card: {
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
    color: '#666666',
    fontSize: 12,
    fontWeight: '600',
  },
  infoValue: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  section: {
    gap: 12,
  },
  sectionTitle: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '800',
  },
  notice: {
    borderRadius: 14,
    borderWidth: 1,
    gap: 4,
    padding: 14,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  noticeSuccess: {
    backgroundColor: '#F0FDF4',
    borderColor: '#86EFAC',
  },
  noticeDanger: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FCA5A5',
  },
  noticeWarning: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FCD34D',
  },
  noticeNeutral: {
    backgroundColor: '#F5F5F5',
    borderColor: '#E5E5E5',
  },
  noticeTitle: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '800',
  },
  noticeTitleSuccess: {
    color: '#15803D',
  },
  noticeTitleDanger: {
    color: '#B91C1C',
  },
  noticeTitleWarning: {
    color: '#B45309',
  },
  noticeText: {
    color: '#404040',
    fontSize: 13,
    lineHeight: 20,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#000000',
    borderRadius: 14,
    minHeight: 52,
    justifyContent: 'center',
    padding: 16,
  },
  primaryButtonDisabled: {
    backgroundColor: '#E5E5E5',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  primaryButtonTextDisabled: {
    color: '#737373',
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#000000',
    borderRadius: 14,
    borderWidth: 1,
    minHeight: 48,
    justifyContent: 'center',
    padding: 14,
  },
  secondaryButtonText: {
    color: '#000000',
    fontSize: 15,
    fontWeight: '700',
  },
  disabled: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.65,
  },
});
