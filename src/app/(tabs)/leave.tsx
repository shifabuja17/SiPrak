import { useMemo, useState } from 'react';
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
import { LeaveRequestCard } from '@/features/praktikan/components/leave-request-card';
import { LeaveRequestSheet } from '@/features/praktikan/components/leave-request-sheet';
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
  PraktikanSession,
  SubmitLeaveRequestOutcome,
} from '@/features/praktikan/types';
import { showLeaveSubmitSuccessAlert } from '@/features/praktikan/utils/leave-feedback';

export default function LeaveScreen() {
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
        title="Pengajuan Izin"
        subtitle="Ajukan izin ketidakhadiran dan pantau status persetujuan secara real-time."
      />
    );
  }

  if (authRole === 'praktikan') {
    return <PraktikanLeaveList />;
  }

  if (authRole === 'asisten') {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.staticContent}>
          <View style={styles.header}>
            <Text style={styles.title}>Pengajuan Izin</Text>
            <Text style={styles.subtitle}>
              Ajukan izin ketidakhadiran dan pantau status persetujuan secara real-time.
            </Text>
            <HeaderProfileBar />
            <Text style={styles.sectionTitle}>Daftar Pengajuan Izin</Text>
          </View>

          <PraktikanEmptyState
            title="Akun Asisten Aktif"
            message="Halaman ini menampilkan pengajuan dan status izin pribadi khusus untuk akun Praktikan."
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.staticContent}>
        <View style={styles.header}>
          <Text style={styles.title}>Pengajuan Izin</Text>
          <Text style={styles.subtitle}>
            Ajukan izin ketidakhadiran dan pantau status persetujuan secara real-time.
          </Text>
          <HeaderProfileBar />
        </View>

        <PraktikanEmptyState
          title="Autentikasi Diperlukan"
          message="Silakan login dengan akun Praktikan untuk mengajukan izin dan memantau keputusan Asisten."
        />
      </View>
    </SafeAreaView>
  );
}

function PraktikanLeaveList() {
  const {
    sessions,
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
    leaveRequests,
    leaveBySessionId,
    loading: leaveLoading,
    submitting,
    submittingStep,
    listError: leaveListError,
    submitError: leaveSubmitError,
    submitLeaveRequest,
    clearSubmitError: clearLeaveSubmitError,
    retry: retryLeaves,
  } = usePraktikanLeaveRequests();

  const [sheetVisible, setSheetVisible] = useState(false);

  const sessionById = useMemo<Record<string, PraktikanSession>>(() => {
    const map: Record<string, PraktikanSession> = {};
    for (const session of sessions) {
      map[session.id] = session;
    }
    return map;
  }, [sessions]);

  const stats = useMemo(() => {
    let menunggu = 0;
    let diterima = 0;
    let ditolak = 0;

    for (const item of leaveRequests) {
      if (item.status === 'menunggu') menunggu += 1;
      else if (item.status === 'diterima') diterima += 1;
      else if (item.status === 'ditolak') ditolak += 1;
    }

    return {
      total: leaveRequests.length,
      menunggu,
      diterima,
      ditolak,
    };
  }, [leaveRequests]);

  const hideStats = leaveLoading || Boolean(leaveListError);
  const showInitialLoading = leaveLoading && leaveRequests.length === 0;
  const showFatalLeaveError =
    Boolean(leaveListError) && leaveRequests.length === 0 && !leaveLoading;
  const isFormDataLoading =
    sessionsLoading || (sessions.length > 0 && attendanceLoading);
  const hasFormDependencyError = Boolean(sessionsError || attendanceError);
  const isCreateDisabled =
    isFormDataLoading || submitting || hasFormDependencyError;

  function handleRetryFormDependencies() {
    if (sessionsError) retrySessions();
    if (attendanceError) retryAttendance();
  }

  function handleOpenSheet() {
    if (isCreateDisabled) {
      return;
    }
    clearLeaveSubmitError();
    setSheetVisible(true);
  }

  function handleCloseSheet() {
    if (submitting) {
      return;
    }
    clearLeaveSubmitError();
    setSheetVisible(false);
  }

  async function handleSubmitLeave(
    sessionId: string,
    alasan: string,
  ): Promise<SubmitLeaveRequestOutcome> {
    const outcome = await submitLeaveRequest({ sessionId, alasan });
    if (outcome.ok) {
      setSheetVisible(false);
      showLeaveSubmitSuccessAlert(outcome);
    }
    return outcome;
  }

  function renderEmptyState() {
    if (showInitialLoading) {
      return (
        <PraktikanLoadingState
          title="Memuat Pengajuan Izin"
          message="Mengambil riwayat pengajuan izin dan status peninjauan Asisten..."
        />
      );
    }

    if (showFatalLeaveError && leaveListError) {
      return (
        <PraktikanErrorState
          title="Gagal Memuat Data Izin"
          message={leaveListError}
          onRetry={retryLeaves}
        />
      );
    }

    return (
      <PraktikanEmptyState
        title="Belum ada pengajuan izin"
        message={
          hasFormDependencyError
            ? 'Daftar sesi atau status presensi sedang mengalami gangguan. Tekan Coba Lagi pada pesan gangguan di atas sebelum mengajukan izin baru.'
            : 'Jika Anda berhalangan hadir, tekan tombol "+ Ajukan Izin" di atas untuk memilih sesi dan mengirim alasan.'
        }
      />
    );
  }

  const listData = showInitialLoading || showFatalLeaveError ? [] : leaveRequests;

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
            <Text style={styles.title}>Pengajuan Izin</Text>

            <Text style={styles.subtitle}>
              Ajukan izin ketidakhadiran dan pantau keputusan Asisten secara real-time.
            </Text>

            <HeaderProfileBar />

            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Total Pengajuan Izin</Text>

              <Text style={styles.summaryValue}>
                {hideStats ? '-' : stats.total}
              </Text>

              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <Text style={[styles.statValue, styles.statPending]}>
                    {hideStats ? '-' : stats.menunggu}
                  </Text>
                  <Text style={styles.statLabel}>Menunggu</Text>
                </View>

                <View style={styles.statItem}>
                  <Text style={[styles.statValue, styles.statAccepted]}>
                    {hideStats ? '-' : stats.diterima}
                  </Text>
                  <Text style={styles.statLabel}>Diterima</Text>
                </View>

                <View style={[styles.statItem]}>
                  <Text style={[styles.statValue, styles.statRejected]}>
                    {hideStats ? '-' : stats.ditolak}
                  </Text>
                  <Text style={styles.statLabel}>Ditolak</Text>
                </View>
              </View>
            </View>

            <Pressable
              accessibilityLabel={
                hasFormDependencyError
                  ? 'Daftar sesi belum siap untuk pengajuan izin'
                  : 'Ajukan Izin'
              }
              accessibilityRole="button"
              accessibilityState={{ disabled: isCreateDisabled }}
              disabled={isCreateDisabled}
              onPress={handleOpenSheet}
              style={({ pressed }) => [
                styles.createButton,
                isCreateDisabled && styles.createButtonDisabled,
                pressed && !isCreateDisabled && styles.pressed,
              ]}
            >
              {isFormDataLoading ? (
                <View style={styles.buttonLoadingRow}>
                  <ActivityIndicator size="small" color="#FFFFFF" />
                  <Text style={styles.createButtonText}>Menyiapkan daftar sesi...</Text>
                </View>
              ) : hasFormDependencyError ? (
                <Text style={styles.createButtonText}>Daftar Sesi Belum Siap</Text>
              ) : (
                <Text style={styles.createButtonText}>+ Ajukan Izin</Text>
              )}
            </Pressable>

            {(leaveListError && listData.length > 0) ||
            sessionsError ||
            attendanceError ? (
              <View style={styles.bannerStack}>
                {leaveListError && listData.length > 0 ? (
                  <PraktikanInlineErrorBanner
                    title="Gagal Memuat Daftar Izin"
                    message={leaveListError}
                    onRetry={retryLeaves}
                  />
                ) : null}

                {sessionsError ? (
                  <PraktikanInlineErrorBanner
                    title="Gagal Memuat Daftar Sesi"
                    message={`Daftar sesi belum dapat dimuat untuk pengajuan izin baru: ${sessionsError}`}
                    onRetry={retrySessions}
                  />
                ) : null}

                {attendanceError ? (
                  <PraktikanInlineErrorBanner
                    title="Gagal Memuat Status Presensi"
                    message={`Status presensi belum dapat diperiksa untuk pengajuan izin baru: ${attendanceError}`}
                    onRetry={retryAttendance}
                  />
                ) : null}
              </View>
            ) : null}

            <Text style={styles.sectionTitle}>Daftar Pengajuan Izin</Text>
          </View>
        }
        renderItem={({ item }) => (
          <LeaveRequestCard
            leave={item}
            session={sessionById[item.sessionId] ?? null}
          />
        )}
        ListEmptyComponent={renderEmptyState}
      />

      <LeaveRequestSheet
        visible={sheetVisible}
        sessions={sessions}
        attendanceBySessionId={attendanceBySessionId}
        leaveBySessionId={leaveBySessionId}
        submitting={submitting}
        submittingStep={submittingStep}
        error={leaveSubmitError}
        sessionsError={sessionsError}
        attendanceError={attendanceError}
        onRetryData={handleRetryFormDependencies}
        onClearError={clearLeaveSubmitError}
        onCancel={handleCloseSheet}
        onSubmit={handleSubmitLeave}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: '#FFFFFF',
    flex: 1,
  },
  staticContent: {
    padding: 20,
    paddingTop: 32,
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
  statPending: {
    color: '#B45309',
  },
  statAccepted: {
    color: '#15803D',
  },
  statRejected: {
    color: '#B91C1C',
  },
  statLabel: {
    color: '#666666',
    fontSize: 12,
    fontWeight: '600',
  },
  createButton: {
    alignItems: 'center',
    backgroundColor: '#000000',
    borderRadius: 14,
    justifyContent: 'center',
    marginTop: 8,
    padding: 15,
  },
  createButtonDisabled: {
    backgroundColor: '#737373',
  },
  buttonLoadingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  sectionTitle: {
    color: '#000000',
    fontSize: 18,
    fontWeight: '700',
    marginTop: 14,
  },
  bannerStack: {
    gap: 8,
    marginTop: 4,
  },
  separator: {
    height: 12,
  },
  pressed: {
    opacity: 0.78,
  },
});
