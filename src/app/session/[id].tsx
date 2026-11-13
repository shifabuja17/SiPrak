import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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

import StatusBadge, {
  type StatusBadgeStatus,
} from '@/components/common/StatusBadge';
import { useAuth } from '@/context/AuthContext';
import { usePracticum } from '@/context/PracticumContext';
import { AttendanceSummary } from '@/features/assistant/components/attendance-summary';
import PraktikanAttendanceSection from '@/features/praktikan/components/praktikan-attendance-section';
import { subscribeSessionById } from '@/features/praktikan/services/praktikan-sessions';
import type { PraktikanSession } from '@/features/praktikan/types';
import { formatMeetingTitle } from '@/features/praktikan/utils/format';

export default function SessionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const sessionIdParam = Array.isArray(id) ? id[0] : id;

  const {
    role: authRole,
    status: authStatus,
    loading: authLoading,
  } = useAuth();
  const { currentUser } = usePracticum();

  if (authLoading || authStatus === 'loading') {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.centerStateContainer}>
          <ActivityIndicator size="large" color="#000000" />
          <Text style={styles.stateText}>Memeriksa sesi akun...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (authRole === 'praktikan') {
    return <PraktikanSessionDetail sessionId={sessionIdParam} />;
  }

  if (
    authRole === 'asisten' ||
    (authRole === null && currentUser.role === 'ASISTEN')
  ) {
    return <AssistantSessionDetail sessionId={sessionIdParam} />;
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.missingContainer}>
        <Text style={styles.title}>Autentikasi Diperlukan</Text>
        <Text style={styles.stateText}>
          Silakan login menggunakan akun Firebase Praktikan untuk mengakses
          detail sesi dan presensi.
        </Text>
        <Pressable
          onPress={() => router.back()}
          style={styles.primaryButton}
        >
          <Text style={styles.primaryButtonText}>Kembali</Text>
        </Pressable>
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

  const trimmedId = sessionId?.trim() ?? '';

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

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.centerStateContainer}>
          <ActivityIndicator size="large" color="#000000" />
          <Text style={styles.stateText}>Memuat detail sesi...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.missingContainer}>
          <Text style={styles.title}>Gagal Memuat Sesi</Text>
          <Text style={styles.errorText}>{error}</Text>

          <Pressable
            onPress={() => setRetryNonce((prev) => prev + 1)}
            style={styles.primaryButton}
          >
            <Text style={styles.primaryButtonText}>Coba Lagi</Text>
          </Pressable>

          <Pressable
            onPress={() => router.back()}
            style={styles.secondaryButton}
          >
            <Text style={styles.secondaryButtonText}>Kembali ke Jadwal</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (!session) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" />
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

        <PraktikanAttendanceSection session={session} />
      </ScrollView>
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
      currentSessionStatus === 'UPCOMING' ? 'dibuka' : 'ditutup';

    try {
      if (currentSessionStatus === 'UPCOMING') {
        openSession(resolvedSessionId, sessionNote);
      } else if (currentSessionStatus === 'OPEN') {
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

        {session.status === 'UPCOMING' && (
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

        {session.status === 'OPEN' && (
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

        {session.status === 'CLOSED' && (
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
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {session.status === 'UPCOMING'
                ? 'Buka sesi praktikum?'
                : 'Tutup sesi praktikum?'}
            </Text>

            <Text style={styles.modalDescription}>
              {session.status === 'UPCOMING'
                ? 'Sesi akan berubah menjadi berlangsung sehingga praktikan dapat melakukan presensi.'
                : 'Sesi akan ditandai selesai dan tidak dapat menerima presensi baru.'}
            </Text>

            {session.status === 'UPCOMING' && (
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
        </View>
      </Modal>
    </SafeAreaView>
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
      <Pressable
        onPress={() => router.back()}
        style={styles.backButton}
      >
        <Text style={styles.backText}>‹ Kembali ke jadwal</Text>
      </Pressable>

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
    gap: 22,
    padding: 20,
    paddingTop: 32,
    paddingBottom: 40,
  },
  centerStateContainer: {
    alignItems: 'center',
    flex: 1,
    gap: 12,
    justifyContent: 'center',
    padding: 20,
  },
  missingContainer: {
    flex: 1,
    gap: 16,
    justifyContent: 'center',
    padding: 20,
  },
  stateText: {
    color: '#666666',
    fontSize: 14,
    lineHeight: 20,
  },
  errorText: {
    color: '#B91C1C',
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
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
    gap: 10,
  },
  title: {
    color: '#000000',
    fontSize: 25,
    fontWeight: '800',
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
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#000000',
    borderRadius: 14,
    padding: 16,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#000000',
    borderRadius: 14,
    borderWidth: 1,
    padding: 15,
  },
  secondaryButtonText: {
    color: '#000000',
    fontSize: 15,
    fontWeight: '700',
  },
  notice: {
    alignItems: 'center',
    backgroundColor: '#F2F2F2',
    borderRadius: 14,
    padding: 15,
  },
  noticeText: {
    color: '#404040',
    fontSize: 14,
    fontWeight: '600',
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
    color: '#000000',
    fontSize: 20,
    fontWeight: '800',
  },
  modalDescription: {
    color: '#404040',
    fontSize: 14,
    lineHeight: 21,
  },
  inputLabel: {
    color: '#000000',
    fontSize: 13,
    fontWeight: '700',
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
    color: '#000000',
    fontSize: 14,
    fontWeight: '700',
  },
  confirmButton: {
    alignItems: 'center',
    backgroundColor: '#000000',
    borderRadius: 12,
    flex: 1,
    padding: 14,
  },
  confirmButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.65,
  },
});
