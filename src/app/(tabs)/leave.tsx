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
    role: authRole,
    status: authStatus,
    loading: authLoading,
  } = useAuth();

  if (authLoading || authStatus === 'loading') {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#000000" />
          <Text style={styles.stateText}>Memeriksa sesi akun...</Text>
        </View>
      </SafeAreaView>
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

          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Akun Asisten Aktif</Text>
            <Text style={styles.emptyText}>
              Halaman ini menampilkan pengajuan dan status izin pribadi khusus untuk akun Praktikan.
            </Text>
          </View>
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

        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>Autentikasi Diperlukan</Text>
          <Text style={styles.emptyText}>
            Silakan login dengan akun Praktikan untuk mengajukan izin dan memantau keputusan
            Asisten.
          </Text>
        </View>
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
    error: leaveError,
    submitLeaveRequest,
    clearError: clearLeaveError,
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

  const isListLoading = leaveLoading || sessionsLoading;
  const isFormDataLoading = sessionsLoading || (sessions.length > 0 && attendanceLoading);
  const activeError = leaveError ?? sessionsError ?? attendanceError;

  function handleRetry() {
    if (leaveError) retryLeaves();
    if (sessionsError) retrySessions();
    if (attendanceError) retryAttendance();
  }

  function handleOpenSheet() {
    clearLeaveError();
    setSheetVisible(true);
  }

  function handleCloseSheet() {
    if (submitting) {
      return;
    }
    clearLeaveError();
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
    if (isListLoading) {
      return (
        <View style={styles.emptyCard}>
          <ActivityIndicator size="small" color="#000000" />
          <Text style={styles.emptyTitle}>Memuat Pengajuan Izin</Text>
          <Text style={styles.emptyText}>
            Mengambil riwayat pengajuan izin dan status peninjauan Asisten...
          </Text>
        </View>
      );
    }

    if (activeError) {
      return (
        <View style={styles.errorCard}>
          <Text style={styles.errorTitle}>Gagal Memuat Data Izin</Text>
          <Text style={styles.errorText}>{activeError}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={handleRetry}
            style={({ pressed }) => [
              styles.retryButton,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.retryText}>Coba Lagi</Text>
          </Pressable>
        </View>
      );
    }

    return (
      <View style={styles.emptyCard}>
        <Text style={styles.emptyTitle}>Belum ada pengajuan izin</Text>
        <Text style={styles.emptyText}>
          Jika Anda berhalangan hadir, tekan tombol &quot;+ Ajukan Izin&quot; di atas untuk memilih
          sesi dan mengirim alasan.
        </Text>
      </View>
    );
  }

  const listData = isListLoading ? [] : leaveRequests;

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
                {leaveLoading ? '-' : stats.total}
              </Text>

              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <Text style={[styles.statValue, styles.statPending]}>
                    {leaveLoading ? '-' : stats.menunggu}
                  </Text>
                  <Text style={styles.statLabel}>Menunggu</Text>
                </View>

                <View style={styles.statItem}>
                  <Text style={[styles.statValue, styles.statAccepted]}>
                    {leaveLoading ? '-' : stats.diterima}
                  </Text>
                  <Text style={styles.statLabel}>Diterima</Text>
                </View>

                <View style={styles.statItem}>
                  <Text style={[styles.statValue, styles.statRejected]}>
                    {leaveLoading ? '-' : stats.ditolak}
                  </Text>
                  <Text style={styles.statLabel}>Ditolak</Text>
                </View>
              </View>
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: isFormDataLoading || submitting }}
              disabled={isFormDataLoading || submitting}
              onPress={handleOpenSheet}
              style={({ pressed }) => [
                styles.createButton,
                (isFormDataLoading || submitting) && styles.createButtonDisabled,
                pressed && !isFormDataLoading && !submitting && styles.pressed,
              ]}
            >
              {isFormDataLoading ? (
                <View style={styles.buttonLoadingRow}>
                  <ActivityIndicator size="small" color="#FFFFFF" />
                  <Text style={styles.createButtonText}>Menyiapkan daftar sesi...</Text>
                </View>
              ) : (
                <Text style={styles.createButtonText}>+ Ajukan Izin</Text>
              )}
            </Pressable>

            {activeError && listData.length > 0 ? (
              <View style={styles.inlineErrorCard}>
                <Text style={styles.inlineErrorText}>{activeError}</Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={handleRetry}
                  style={({ pressed }) => [
                    styles.retryButton,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.retryText}>Coba Lagi</Text>
                </Pressable>
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
        error={leaveError}
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
  centerContainer: {
    alignItems: 'center',
    flex: 1,
    gap: 12,
    justifyContent: 'center',
    padding: 20,
  },
  stateText: {
    color: '#666666',
    fontSize: 14,
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
  separator: {
    height: 12,
  },
  emptyCard: {
    alignItems: 'center',
    backgroundColor: '#F2F2F2',
    borderRadius: 16,
    gap: 6,
    padding: 24,
  },
  emptyTitle: {
    color: '#000000',
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptyText: {
    color: '#666666',
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
  errorCard: {
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    borderColor: '#FCA5A5',
    borderRadius: 16,
    borderWidth: 1,
    gap: 10,
    padding: 20,
  },
  errorTitle: {
    color: '#B91C1C',
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
  errorText: {
    color: '#991B1B',
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
  inlineErrorCard: {
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    borderColor: '#FCA5A5',
    borderRadius: 14,
    borderWidth: 1,
    gap: 8,
    marginTop: 4,
    padding: 14,
  },
  inlineErrorText: {
    color: '#991B1B',
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#B91C1C',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  retryText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.78,
  },
});
