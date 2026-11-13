import { useEffect, useState } from 'react';
import { router } from 'expo-router';

import {
  ActivityIndicator,
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { auth } from '@/lib/firebase';

import {
  subscribeLeaveRequests,
  reviewLeaveRequest,
  type LeaveRequestRecord,
  type LeaveRequestStatus,
} from '@/features/assistant/services/leave-service';

import {
  subscribeSessions,
  type SessionRecord,
} from '@/features/assistant/services/session-service';

export default function LeaveRequestsScreen() {
  const [requests, setRequests] = useState<LeaveRequestRecord[]>([]);
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Mengambil pengajuan izin dan data sesi secara real-time.
  useEffect(() => {
    const unsubscribeRequests = subscribeLeaveRequests(
      (data) => {
        setRequests(data);
        setLoading(false);
        setError('');
      },
      (err) => {
        console.error(err);
        setError('Gagal mengambil data pengajuan izin.');
        setLoading(false);
      }
    );

    const unsubscribeSessions = subscribeSessions(
      (data) => {
        setSessions(data);
      },
      (err) => {
        console.error(err);
        setError('Gagal mengambil data sesi praktikum.');
      }
    );

    return () => {
      unsubscribeRequests();
      unsubscribeSessions();
    };
  }, []);

  // Memproses keputusan Asisten.
  async function processReview(
    requestId: string,
    status: 'diterima' | 'ditolak'
  ) {
    const currentUid = auth.currentUser?.uid;

    if (!currentUid) {
      Alert.alert('Gagal', 'Pengguna belum login.');
      return;
    }

    try {
      setProcessingId(requestId);

      await reviewLeaveRequest(
        requestId,
        status,
        currentUid
      );

      Alert.alert(
        'Berhasil',
        status === 'diterima'
          ? 'Pengajuan izin berhasil diterima.'
          : 'Pengajuan izin berhasil ditolak.'
      );
    } catch (err) {
      console.error(err);

      Alert.alert(
        'Gagal',
        err instanceof Error
          ? err.message
          : 'Terjadi kesalahan saat memproses pengajuan.'
      );
    } finally {
      setProcessingId(null);
    }
  }

  // Meminta konfirmasi sebelum menerima atau menolak.
  function confirmReview(
    requestId: string,
    status: 'diterima' | 'ditolak'
  ) {
    const action = status === 'diterima' ? 'menerima' : 'menolak';

    Alert.alert(
      'Konfirmasi Pengajuan',
      `Apakah kamu yakin ingin ${action} pengajuan izin ini?`,
      [
        {
          text: 'Batal',
          style: 'cancel',
        },
        {
          text: status === 'diterima' ? 'Terima' : 'Tolak',
          style: status === 'ditolak' ? 'destructive' : 'default',
          onPress: () => {
            void processReview(requestId, status);
          },
        },
      ]
    );
  }

  function getStatusLabel(status: LeaveRequestStatus) {
    if (status === 'menunggu') return 'MENUNGGU';
    if (status === 'diterima') return 'DITERIMA';
    return 'DITOLAK';
  }

  function getSessionName(sessionId: string) {
    const session = sessions.find((item) => item.id === sessionId);

    if (!session) return `Sesi: ${sessionId}`;

    return `${session.practicumName} - ${session.moduleTitle}`;
  }

  function formatDate(date: Date | null) {
    if (!date) return 'Tanggal tidak tersedia';

    return date.toLocaleString('id-ID', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  const pendingCount = requests.filter(
    (item) => item.status === 'menunggu'
  ).length;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.backText}>‹ Kembali</Text>
        </Pressable>

        <Text style={styles.title}>Pengajuan Izin</Text>
        <Text style={styles.subtitle}>
          Kelola pengajuan izin dari Praktikan.
        </Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
      >
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Menunggu Keputusan</Text>
          <Text style={styles.summaryNumber}>{pendingCount}</Text>
          <Text style={styles.summaryDescription}>
            {pendingCount === 1
              ? 'pengajuan perlu diperiksa'
              : 'pengajuan perlu diperiksa'}
          </Text>
        </View>

        <Text style={styles.sectionTitle}>
          Daftar Pengajuan ({requests.length})
        </Text>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#22396F" />
            <Text style={styles.helperText}>Memuat pengajuan izin...</Text>
          </View>
        ) : error ? (
          <View style={styles.emptyCard}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : requests.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>
              Belum Ada Pengajuan
            </Text>
            <Text style={styles.helperText}>
              Pengajuan izin dari Praktikan akan muncul di sini.
            </Text>
          </View>
        ) : (
          requests.map((item) => {
            const isProcessing = processingId === item.id;
            const isPending = item.status === 'menunggu';

            return (
              <View key={item.id} style={styles.requestCard}>
                <View style={styles.cardHeader}>
                  <View style={styles.userInfo}>
                    <Text style={styles.name}>
                      {item.nama}
                    </Text>
                    <Text style={styles.date}>
                      {formatDate(item.createdAt)}
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.statusBadge,
                      item.status === 'menunggu' && styles.pendingBadge,
                      item.status === 'diterima' && styles.acceptedBadge,
                      item.status === 'ditolak' && styles.rejectedBadge,
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusText,
                        item.status === 'menunggu' && styles.pendingText,
                        item.status === 'diterima' && styles.acceptedText,
                        item.status === 'ditolak' && styles.rejectedText,
                      ]}
                    >
                      {getStatusLabel(item.status)}
                    </Text>
                  </View>
                </View>

                <View style={styles.divider} />

                <Text style={styles.fieldLabel}>Sesi Praktikum</Text>
                <Text style={styles.fieldValue}>
                  {getSessionName(item.sessionId)}
                </Text>

                <Text style={styles.fieldLabel}>Alasan Izin</Text>
                <Text style={styles.reason}>
                  {item.alasan}
                </Text>

                <Text style={styles.fieldLabel}>Kategori AI</Text>
                <Text style={styles.fieldValue}>
                  {item.kategoriAI || 'Tidak tersedia'}
                </Text>

                {isPending && (
                  <View style={styles.actionContainer}>
                    <Pressable
                      style={[
                        styles.actionButton,
                        styles.rejectButton,
                        processingId !== null && styles.disabledButton,
                      ]}
                      disabled={processingId !== null}
                      onPress={() => confirmReview(item.id, 'ditolak')}
                    >
                      <Text style={styles.rejectButtonText}>
                        {isProcessing ? 'Memproses...' : 'Tolak'}
                      </Text>
                    </Pressable>

                    <Pressable
                      style={[
                        styles.actionButton,
                        styles.acceptButton,
                        processingId !== null && styles.disabledButton,
                      ]}
                      disabled={processingId !== null}
                      onPress={() => confirmReview(item.id, 'diterima')}
                    >
                      <Text style={styles.acceptButtonText}>
                        {isProcessing ? 'Memproses...' : 'Terima'}
                      </Text>
                    </Pressable>
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F5F7FB',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
  },
  backText: {
    color: '#22396F',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 18,
  },
  title: {
    fontSize: 25,
    fontWeight: 'bold',
    color: '#010736',
  },
  subtitle: {
    fontSize: 14,
    color: '#68738A',
    marginTop: 6,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  summaryCard: {
    backgroundColor: '#22396F',
    borderRadius: 14,
    padding: 20,
    marginBottom: 24,
  },
  summaryLabel: {
    color: '#FFFFFF',
    fontSize: 14,
  },
  summaryNumber: {
    color: '#FFFFFF',
    fontSize: 34,
    fontWeight: 'bold',
    marginTop: 8,
  },
  summaryDescription: {
    color: '#DCE4F5',
    fontSize: 13,
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#010736',
    marginBottom: 14,
  },
  center: {
    alignItems: 'center',
    padding: 30,
  },
  helperText: {
    color: '#7A8498',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 8,
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
  },
  emptyTitle: {
    color: '#010736',
    fontSize: 16,
    fontWeight: 'bold',
  },
  errorText: {
    color: '#C0392B',
    textAlign: 'center',
  },
  requestCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E8ECF3',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
  },
  userInfo: {
    flex: 1,
  },
  name: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#010736',
  },
  date: {
    fontSize: 12,
    color: '#7A8498',
    marginTop: 5,
  },
  statusBadge: {
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  pendingBadge: {
    backgroundColor: '#FFF3D6',
  },
  acceptedBadge: {
    backgroundColor: '#DDF5E6',
  },
  rejectedBadge: {
    backgroundColor: '#FCE4E4',
  },
  statusText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  pendingText: {
    color: '#A66A00',
  },
  acceptedText: {
    color: '#21834A',
  },
  rejectedText: {
    color: '#C0392B',
  },
  divider: {
    height: 1,
    backgroundColor: '#E8ECF3',
    marginVertical: 14,
  },
  fieldLabel: {
    fontSize: 12,
    color: '#7A8498',
    marginTop: 10,
    marginBottom: 4,
  },
  fieldValue: {
    color: '#26334D',
    fontSize: 14,
    fontWeight: '500',
  },
  reason: {
    color: '#26334D',
    fontSize: 14,
    lineHeight: 21,
  },
  actionContainer: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  actionButton: {
    flex: 1,
    borderRadius: 9,
    paddingVertical: 12,
    alignItems: 'center',
  },
  rejectButton: {
    backgroundColor: '#FCE4E4',
  },
  acceptButton: {
    backgroundColor: '#22396F',
  },
  rejectButtonText: {
    color: '#C0392B',
    fontWeight: 'bold',
  },
  acceptButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  disabledButton: {
    opacity: 0.5,
  },
});