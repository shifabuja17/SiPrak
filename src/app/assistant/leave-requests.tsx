import { useEffect, useState } from 'react';

import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Svg, { Circle, Path, Rect } from 'react-native-svg';

import AssistantHeader from '@/components/common/AssistantHeader';

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
import { FONT } from '@/constants/fonts';
import { useTabBottomSpace } from '@/components/common/tab-screen';
import { withNotificationNote } from '@/features/notifications/utils/dispatch-message';
import PersonIcon from '@/components/common/person-icon';
import { Chip } from '@/features/praktikan/ui/praktikan-ui';

// ==========================================
// TIPE AKSI
// ==========================================

type ReviewAction = 'diterima' | 'ditolak';

type ReviewTarget = {
  request: LeaveRequestRecord;
  status: ReviewAction;
};

type IconName =
  | 'clock'
  | 'check'
  | 'close'
  | 'file'
  | 'calendar'
  | 'user'
  | 'alert';

// ==========================================
// KOMPONEN IKON SVG
// ==========================================

function LeaveIcon({
  name,
  size = 20,
  color = '#000000',
}: {
  name: IconName;
  size?: number;
  color?: string;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {name === 'clock' && (
        <>
          <Circle
            cx={12}
            cy={12}
            r={9}
            stroke={color}
            strokeWidth={1.8}
          />
          <Path
            d="M12 7V12L15.5 14"
            stroke={color}
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      )}

      {name === 'check' && (
        <>
          <Circle
            cx={12}
            cy={12}
            r={9}
            stroke={color}
            strokeWidth={1.8}
          />
          <Path
            d="M8 12L10.5 14.5L16 9"
            stroke={color}
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      )}

      {name === 'close' && (
        <Path
          d="M6 6L18 18M18 6L6 18"
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
        />
      )}

      {name === 'file' && (
        <>
          <Path
            d="M6 3H14L19 8V20A1 1 0 0 1 18 21H6A1 1 0 0 1 5 20V4A1 1 0 0 1 6 3Z"
            stroke={color}
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Path
            d="M14 3V8H19M8 13H16M8 17H14"
            stroke={color}
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      )}

      {name === 'calendar' && (
        <>
          <Rect
            x={3}
            y={5}
            width={18}
            height={16}
            rx={2}
            stroke={color}
            strokeWidth={1.8}
          />
          <Path
            d="M7 3V7M17 3V7M3 10H21"
            stroke={color}
            strokeWidth={1.8}
            strokeLinecap="round"
          />
        </>
      )}

      {name === 'user' && (
        <>
          <Circle
            cx={12}
            cy={8}
            r={4}
            stroke={color}
            strokeWidth={1.8}
          />
          <Path
            d="M4 21C4 16.6 7.6 14 12 14C16.4 14 20 16.6 20 21"
            stroke={color}
            strokeWidth={1.8}
            strokeLinecap="round"
          />
        </>
      )}

      {name === 'alert' && (
        <>
          <Circle
            cx={12}
            cy={12}
            r={9}
            stroke={color}
            strokeWidth={1.8}
          />
          <Path
            d="M12 7.5V13"
            stroke={color}
            strokeWidth={1.8}
            strokeLinecap="round"
          />
          <Circle cx={12} cy={16.5} r={1} fill={color} />
        </>
      )}
    </Svg>
  );
}

// ==========================================
// HALAMAN PENGAJUAN IZIN
// ==========================================

/**
 * `sessionId` diisi saat dipakai sebagai tab di halaman Cek Presensi: hanya pengajuan
 * untuk sesi itu yang tampil, tanpa header halaman dan kartu ringkasan.
 */
export default function LeaveRequestsScreen({ sessionId }: { sessionId?: string } = {}) {
  const bottomSpace = useTabBottomSpace(40);
  const embedded = Boolean(sessionId);
  // ========================================
  // STATE DATA
  // ========================================

  const [requests, setRequests] = useState<LeaveRequestRecord[]>([]);
  const [sessions, setSessions] = useState<SessionRecord[]>([]);

  // ========================================
  // STATE LOADING DAN ERROR
  // ========================================

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pageMessage, setPageMessage] = useState('');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');

  // ========================================
  // STATE MODAL KONFIRMASI
  // ========================================

  const [reviewTarget, setReviewTarget] = useState<ReviewTarget | null>(null);

  // ========================================
  // MENGAMBIL DATA REAL-TIME
  // ========================================

  useEffect(() => {
    const unsubscribeRequests = subscribeLeaveRequests(
      (data) => {
        setRequests(sessionId ? data.filter((item) => item.sessionId === sessionId) : data);
        setLoading(false);
        setError('');
      },
      (err) => {
        console.error('Gagal mengambil pengajuan izin:', err);
        setError('Gagal mengambil data pengajuan izin.');
        setLoading(false);
      },
    );

    const unsubscribeSessions = subscribeSessions(
      (data) => {
        setSessions(data);
      },
      (err) => {
        console.error('Gagal mengambil data sesi:', err);
        setError('Gagal mengambil data sesi praktikum.');
      },
    );

    return () => {
      unsubscribeRequests();
      unsubscribeSessions();
    };
  }, [sessionId]);

  // ========================================
  // MENDAPATKAN NAMA SESI
  // ========================================

  function getSessionName(sessionId: string) {
    const session = sessions.find((item) => item.id === sessionId);

    if (!session) {
      return `Sesi: ${sessionId}`;
    }

    return `${session.practicumName} - ${session.moduleTitle}`;
  }

  // ========================================
  // FORMAT TANGGAL
  // ========================================

  /** "21 November 2026, 14:13 WIB" */
  function formatSubmittedAt(date: Date | null) {
    if (!date) {
      return 'Waktu tidak tersedia';
    }

    const day = date.toLocaleDateString('id-ID', {
      timeZone: 'Asia/Jakarta',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    const time = date
      .toLocaleTimeString('id-ID', {
        timeZone: 'Asia/Jakarta',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      })
      .replace('.', ':');

    return `${day}, ${time} WIB`;
  }

  // ========================================
  // LABEL STATUS
  // ========================================

  function getStatusLabel(status: LeaveRequestStatus) {
    if (status === 'menunggu') {
      return 'Menunggu';
    }

    if (status === 'diterima') {
      return 'Diterima';
    }

    return 'Ditolak';
  }


  // ========================================
  // MEMBUKA MODAL KONFIRMASI
  // ========================================

  function openReviewModal(
    request: LeaveRequestRecord,
    status: ReviewAction,
  ) {
    setPageMessage('');
    setActionError('');

    setReviewTarget({
      request,
      status,
    });
  }

  // ========================================
  // MENUTUP MODAL
  // ========================================

  function closeReviewModal() {
    if (processingId !== null) {
      return;
    }

    setReviewTarget(null);
    setActionError('');
  }

  // ========================================
  // MEMPROSES KEPUTUSAN ASISTEN
  // ========================================

  async function processReview(
    requestId: string,
    status: ReviewAction,
  ) {
    const currentUid = auth.currentUser?.uid;

    if (!currentUid) {
      setActionError('Pengguna belum login. Silakan login kembali.');
      return;
    }

    try {
      setProcessingId(requestId);
      setActionError('');
      setPageMessage('');

      const notifyResult = await reviewLeaveRequest(
        requestId,
        status,
        currentUid,
      );

      setPageMessage(
        withNotificationNote(
          status === 'diterima'
            ? 'Pengajuan izin berhasil diterima.'
            : 'Pengajuan izin berhasil ditolak.',
          notifyResult,
        ),
      );

      setReviewTarget(null);

    } catch (err) {
      console.error('Gagal memproses pengajuan izin:', err);

      setActionError(
        err instanceof Error
          ? err.message
          : 'Terjadi kesalahan saat memproses pengajuan.',
      );
    } finally {
      setProcessingId(null);
    }
  }

  // ========================================
  // KONFIRMASI KEPUTUSAN
  // ========================================

  function handleConfirmReview() {
    if (!reviewTarget) {
      return;
    }

    void processReview(
      reviewTarget.request.id,
      reviewTarget.status,
    );
  }

  // ========================================
  // JUMLAH PENGAJUAN
  // ========================================

  const pendingCount = requests.filter(
    (item) => item.status === 'menunggu',
  ).length;

  const acceptedCount = requests.filter(
    (item) => item.status === 'diterima',
  ).length;

  const rejectedCount = requests.filter(
    (item) => item.status === 'ditolak',
  ).length;

  // ========================================
  // DETAIL MODAL
  // ========================================

  const reviewTitle =
    reviewTarget?.status === 'diterima'
      ? 'Terima Pengajuan Izin?'
      : 'Tolak Pengajuan Izin?';

  const reviewDescription =
    reviewTarget?.status === 'diterima'
      ? 'Apakah kamu yakin ingin menerima pengajuan izin ini? Status pengajuan akan diperbarui.'
      : 'Apakah kamu yakin ingin menolak pengajuan izin ini? Keputusan ini akan disimpan.';

  const reviewButtonText =
    reviewTarget?.status === 'diterima'
      ? 'Terima Pengajuan'
      : 'Tolak Pengajuan';

  // ========================================
  // TAMPILAN UTAMA
  // ========================================

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar barStyle="dark-content" />

      {embedded ? null : <AssistantHeader />}

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: bottomSpace }]}
        showsVerticalScrollIndicator={false}
      >
        {embedded ? null : (
          <>
        {/* JUDUL HALAMAN */}
        <View style={styles.heading}>
          <Text style={styles.pageSubtitle}>
            MANAJEMEN PRAKTIKUM
          </Text>

          <Text style={styles.title}>
            Pengajuan Izin
          </Text>

          <Text style={styles.subtitle}>
            Kelola dan periksa pengajuan izin dari Praktikan.
          </Text>
        </View>

        {/* RINGKASAN PENGAJUAN */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>
            Menunggu Keputusan
          </Text>

          <Text style={styles.summaryNumber}>
            {pendingCount}
          </Text>

          <Text style={styles.summaryDescription}>
            pengajuan perlu diperiksa
          </Text>

          <View style={styles.summaryDivider} />

          <View style={styles.summaryStats}>
            <View style={styles.summaryStatItem}>
              <Text style={styles.summaryStatNumber}>
                {requests.length}
              </Text>

              <Text style={styles.summaryStatLabel}>
                Total
              </Text>
            </View>

            <View style={styles.summaryStatDivider} />

            <View style={styles.summaryStatItem}>
              <Text style={styles.summaryStatNumber}>
                {acceptedCount}
              </Text>

              <Text style={styles.summaryStatLabel}>
                Diterima
              </Text>
            </View>

            <View style={styles.summaryStatDivider} />

            <View style={styles.summaryStatItem}>
              <Text style={styles.summaryStatNumber}>
                {rejectedCount}
              </Text>

              <Text style={styles.summaryStatLabel}>
                Ditolak
              </Text>
            </View>
          </View>
        </View>
          </>
        )}

        {/* PESAN BERHASIL */}
        {pageMessage ? (
          <View style={styles.successBox}>
            <LeaveIcon
              name="check"
              size={18}
              color="#333333"
            />

            <Text style={styles.successText}>
              {pageMessage}
            </Text>
          </View>
        ) : null}

        {/* PESAN ERROR */}
        {error ? (
          <View style={styles.errorBox}>
            <LeaveIcon
              name="alert"
              size={18}
              color="#5F5F66"
            />

            <Text style={styles.errorText}>
              {error}
            </Text>
          </View>
        ) : null}

        {/* LOADING */}
        {loading ? (
          <View style={styles.stateCard}>
            <ActivityIndicator
              size="large"
              color="#111014"
            />

            <Text style={styles.helperText}>
              Memuat pengajuan izin...
            </Text>
          </View>
        ) : error ? (
          <View style={styles.stateCard}>
            <LeaveIcon
              name="alert"
              size={28}
              color="#5F5F66"
            />

            <Text style={styles.emptyTitle}>
              Data belum tersedia
            </Text>

            <Text style={styles.helperText}>
              Periksa koneksi dan coba buka halaman kembali.
            </Text>
          </View>
        ) : requests.length === 0 ? (
          <View style={styles.stateCard}>
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
                {/* IDENTITAS PRAKTIKAN DAN STATUS */}
                <View style={styles.cardHeader}>
                  <View style={styles.userInfo}>
                    <View style={styles.nameRow}>
                      <View style={styles.userIcon}>
                        <PersonIcon size={18} color="#111014" />
                      </View>

                      <Text style={styles.name}>
                        {item.nama}
                      </Text>
                    </View>
                  </View>

                  {/* STATUS (gaya chip kartu beranda) */}
                  <Chip
                    label={getStatusLabel(item.status)}
                    tone={
                      item.status === 'diterima'
                        ? 'solid'
                        : item.status === 'ditolak'
                          ? 'dark'
                          : 'neutral'
                    }
                  />
                </View>

                {/* WAKTU PENGAJUAN */}
                <View style={styles.fieldContainer}>
                  <View style={styles.fieldHeading}>
                    <LeaveIcon
                      name="calendar"
                      size={16}
                      color="#FFFFFF"
                    />

                    <Text style={styles.fieldLabel}>
                      Waktu Pengajuan
                    </Text>
                  </View>

                  <Text style={styles.fieldValue}>
                    {formatSubmittedAt(item.createdAt)}
                  </Text>
                </View>

                {/* ALASAN IZIN */}
                <View style={styles.fieldContainer}>
                  <View style={styles.fieldHeading}>
                    <LeaveIcon
                      name="file"
                      size={16}
                      color="#FFFFFF"
                    />

                    <Text style={styles.fieldLabel}>
                      Alasan Izin
                    </Text>
                  </View>

                  <Text style={styles.reason}>
                    {item.alasan}
                  </Text>
                </View>

                {/* KATEGORI AI */}
                <View style={styles.fieldContainer}>
                  <Text style={styles.fieldLabel}>
                    Kategori AI
                  </Text>

                  <View style={styles.categoryBadge}>
                    <Text style={styles.categoryText}>
                      {item.kategoriAI || 'Tidak tersedia'}
                    </Text>
                  </View>
                </View>

                {/* TOMBOL KEPUTUSAN */}
                {isPending && (
                  <View style={styles.actionContainer}>
                    <Pressable
                      style={({ pressed }) => [
                        styles.actionButton,
                        styles.rejectButton,
                        pressed && styles.pressed,
                        processingId !== null && styles.disabledButton,
                      ]}
                      disabled={processingId !== null}
                      onPress={() => openReviewModal(item, 'ditolak')}
                    >
                      {isProcessing ? (
                        <ActivityIndicator color="#FFFFFF" />
                      ) : (
                        <>
                          <LeaveIcon
                            name="close"
                            size={17}
                            color="#FFFFFF"
                          />

                          <Text style={styles.rejectButtonText}>
                            Tolak
                          </Text>
                        </>
                      )}
                    </Pressable>

                    <Pressable
                      style={({ pressed }) => [
                        styles.actionButton,
                        styles.acceptButton,
                        pressed && styles.pressed,
                        processingId !== null && styles.disabledButton,
                      ]}
                      disabled={processingId !== null}
                      onPress={() => openReviewModal(item, 'diterima')}
                    >
                      {isProcessing ? (
                        <ActivityIndicator color="#F47321" />
                      ) : (
                        <>
                          <LeaveIcon
                            name="check"
                            size={17}
                            color="#F47321"
                          />

                          <Text style={styles.acceptButtonText}>
                            Terima
                          </Text>
                        </>
                      )}
                    </Pressable>
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>

      {/* =====================================
          MODAL KONFIRMASI TERIMA / TOLAK
      ===================================== */}

      <Modal
        visible={reviewTarget !== null}
        transparent
        animationType="fade"
        onRequestClose={closeReviewModal}
        statusBarTranslucent
      >
        <View style={styles.modalBackdrop}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={closeReviewModal}
            disabled={processingId !== null}
          />

          <View style={styles.confirmCard}>
            {/* JUDUL */}
            <Text style={styles.confirmTitle}>
              {reviewTitle}
            </Text>

            {/* DESKRIPSI */}
            <Text style={styles.confirmDescription}>
              {reviewDescription}
            </Text>

            {/* INFORMASI PRAKTIKAN */}
            {reviewTarget ? (
              <View style={styles.confirmInfo}>
                <Text style={styles.confirmName}>
                  {reviewTarget.request.nama}
                </Text>

                <Text style={styles.confirmDetail}>
                  {getSessionName(reviewTarget.request.sessionId)}
                </Text>

                <Text style={styles.confirmDetail}>
                  Alasan: {reviewTarget.request.alasan}
                </Text>
              </View>
            ) : null}

            {/* ERROR */}
            {actionError ? (
              <View style={styles.modalErrorBox}>
                <LeaveIcon
                  name="alert"
                  size={17}
                  color="#5F5F66"
                />

                <Text style={styles.modalErrorText}>
                  {actionError}
                </Text>
              </View>
            ) : null}

            {/* TOMBOL */}
            <View style={styles.modalActions}>
              <Pressable
                style={({ pressed }) => [
                  styles.cancelButton,
                  pressed && styles.pressed,
                ]}
                onPress={closeReviewModal}
                disabled={processingId !== null}
              >
                <Text style={styles.cancelButtonText}>
                  Batal
                </Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  styles.confirmButton,
                  reviewTarget?.status === 'ditolak' && styles.confirmDanger,
                  pressed && styles.pressed,
                  processingId !== null && styles.disabledButton,
                ]}
                onPress={handleConfirmReview}
                disabled={processingId !== null}
              >
                {processingId !== null ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.confirmButtonText}>
                    {reviewButtonText}
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ==========================================
// STYLE PENGAJUAN IZIN
// ==========================================

const styles = StyleSheet.create({

  // HALAMAN UTAMA
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },

  scroll: {
    flex: 1,
  },

  content: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
  },

  heading: {
    gap: 7,
    marginBottom: 20,
  },

  pageSubtitle: {
    fontFamily: FONT.bold,
    color: '#5F5F66',
    fontSize: 11,
    letterSpacing: 1.1,
  },

  title: {
    fontFamily: FONT.extrabold,
    color: '#111014',
    fontSize: 26,
  },

  subtitle: {
    fontFamily: FONT.regular,
    color: '#5F5F66',
    fontSize: 13,
    lineHeight: 20,
  },

  // RINGKASAN
  summaryCard: {
    backgroundColor: '#F47321',
    borderRadius: 26,
    marginBottom: 23,
    padding: 18,
  },

  summaryLabel: {
    fontFamily: FONT.semibold,
    color: '#DDDDDD',
    fontSize: 13,
  },

  summaryNumber: {
    fontFamily: FONT.extrabold,
    color: '#FFFFFF',
    fontSize: 38,
    marginTop: 7,
  },

  summaryDescription: {
    fontFamily: FONT.regular,
    color: '#CCCCCC',
    fontSize: 12,
    marginTop: 2,
  },

  summaryDivider: {
    backgroundColor: '#444444',
    height: 1,
    marginVertical: 16,
  },

  summaryStats: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-around',
  },

  summaryStatItem: {
    alignItems: 'center',
    flex: 1,
    gap: 4,
  },

  summaryStatNumber: {
    fontFamily: FONT.extrabold,
    color: '#FFFFFF',
    fontSize: 17,
  },

  summaryStatLabel: {
    fontFamily: FONT.regular,
    color: '#CCCCCC',
    fontSize: 11,
  },

  summaryStatDivider: {
    backgroundColor: '#444444',
    height: 30,
    width: 1,
  },

  // NOTIFIKASI
  successBox: {
    alignItems: 'center',
    backgroundColor: '#F47321',
    borderRadius: 11,
    flexDirection: 'row',
    gap: 9,
    marginBottom: 18,
    padding: 13,
  },

  successText: {
    fontFamily: FONT.regular,
    color: '#FFFFFF',
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
  },

  errorBox: {
    alignItems: 'center',
    backgroundColor: '#E00000',
    borderRadius: 11,
    flexDirection: 'row',
    gap: 9,
    marginBottom: 18,
    padding: 13,
  },

  errorText: {
    fontFamily: FONT.regular,
    color: '#FFFFFF',
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
  },

  // HEADER DAFTAR






  // KONDISI LOADING DAN KOSONG
  stateCard: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#8E8E93',
    borderRadius: 20,
    borderWidth: 1,
    gap: 10,
    padding: 20,
  },


  emptyTitle: {
    fontFamily: FONT.extrabold,
    color: '#111014',
    fontSize: 16,
    textAlign: 'center',
  },

  helperText: {
    fontFamily: FONT.regular,
    color: '#5F5F66',
    fontSize: 12,
    lineHeight: 19,
    textAlign: 'center',
  },

  // KARTU PENGAJUAN
  requestCard: {
    backgroundColor: '#F47321',
    borderRadius: 26,
    gap: 14,
    marginBottom: 14,
    padding: 18,
  },

  cardHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },

  userInfo: {
    flex: 1,
    gap: 7,
  },

  nameRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 9,
  },

  userIcon: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },

  name: {
    fontFamily: FONT.extrabold,
    color: '#FFFFFF',
    flex: 1,
    fontSize: 15,
  },


  // STATUS









  // INFORMASI PENGAJUAN
  fieldContainer: {
    gap: 6,
  },

  fieldHeading: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 7,
  },

  fieldLabel: {
    fontFamily: FONT.semibold,
    color: '#FFFFFF',
    fontSize: 11,
    opacity: 0.9,
  },

  fieldValue: {
    fontFamily: FONT.semibold,
    color: '#FFFFFF',
    fontSize: 14,
    lineHeight: 20,
  },

  reason: {
    fontFamily: FONT.regular,
    color: '#FFFFFF',
    fontSize: 13,
    lineHeight: 21,
  },

  categoryBadge: {
    alignSelf: 'flex-start',
    borderColor: '#FFFFFF',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },

  categoryText: {
    fontFamily: FONT.bold,
    color: '#FFFFFF',
    fontSize: 11,
  },

  // TOMBOL KEPUTUSAN
  actionContainer: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },

  actionButton: {
    alignItems: 'center',
    borderRadius: 10,
    flex: 1,
    flexDirection: 'row',
    gap: 7,
    justifyContent: 'center',
    minHeight: 44,
  },

  rejectButton: {
    backgroundColor: '#F47321',
    borderColor: '#FFFFFF',
    borderWidth: 1.5,
  },

  rejectButtonText: {
    fontFamily: FONT.bold,
    color: '#FFFFFF',
    fontSize: 13,
  },

  acceptButton: {
    backgroundColor: '#FFFFFF',
  },

  acceptButtonText: {
    fontFamily: FONT.bold,
    color: '#F47321',
    fontSize: 13,
  },

  confirmDanger: {
    backgroundColor: '#E00000',
  },
  pressed: {
    opacity: 0.65,
  },

  disabledButton: {
    opacity: 0.5,
  },

  // ========================================
  // MODAL KONFIRMASI
  // ========================================

  modalBackdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 25,
  },

  confirmCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    gap: 14,
    maxWidth: 400,
    padding: 22,
    width: '100%',
  },

  confirmTitle: {
    fontFamily: FONT.extrabold,
    color: '#111014',
    fontSize: 20,
  },

  confirmDescription: {
    fontFamily: FONT.regular,
    color: '#5F5F66',
    fontSize: 13,
    lineHeight: 20,
  },

  confirmInfo: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    gap: 7,
    padding: 13,
    borderColor: '#8E8E93',
    borderWidth: 1,
  },

  confirmName: {
    fontFamily: FONT.extrabold,
    color: '#111014',
    fontSize: 14,
  },

  confirmDetail: {
    fontFamily: FONT.regular,
    color: '#5F5F66',
    fontSize: 12,
    lineHeight: 18,
  },

  modalErrorBox: {
    alignItems: 'center',
    backgroundColor: '#E00000',
    borderRadius: 10,
    flexDirection: 'row',
    gap: 8,
    padding: 11,
  },

  modalErrorText: {
    fontFamily: FONT.regular,
    color: '#5F5F66',
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
  },

  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },

  cancelButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 11,
    flex: 1,
    justifyContent: 'center',
    paddingVertical: 14,
    borderColor: '#8E8E93',
    borderWidth: 1,
  },

  cancelButtonText: {
    fontFamily: FONT.bold,
    color: '#111014',
    fontSize: 13,
  },

  confirmButton: {
    alignItems: 'center',
    backgroundColor: '#F47321',
    borderRadius: 11,
    flex: 1,
    justifyContent: 'center',
    paddingVertical: 14,
  },

  confirmButtonText: {
    fontFamily: FONT.bold,
    color: '#FFFFFF',
    fontSize: 13,
  },
});