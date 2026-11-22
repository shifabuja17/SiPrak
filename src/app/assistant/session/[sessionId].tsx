import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import AssistantHeader from '@/components/common/AssistantHeader';
import { AttendanceSummary } from '@/features/assistant/components/attendance-summary';
import { useAssistantSessions } from '@/features/assistant/state/assistant-sessions-context';
import { FONT } from '@/constants/fonts';

type IconName =
  | 'book'
  | 'pin'
  | 'clock'
  | 'note'
  | 'play'
  | 'stop'
  | 'check'
  | 'alert'
  | 'close';

// ==========================================
// ICON SVG
// ==========================================

function DetailIcon({
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
      {name === 'book' && (
        <>
          <Path
            d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20V19H6.5A2.5 2.5 0 0 0 4 21V5.5Z"
            stroke={color}
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Path
            d="M4 5.5V21M8 7H16M8 11H16"
            stroke={color}
            strokeWidth={1.8}
            strokeLinecap="round"
          />
        </>
      )}

      {name === 'pin' && (
        <>
          <Path
            d="M20 10C20 15.5 12 21 12 21S4 15.5 4 10A8 8 0 1 1 20 10Z"
            stroke={color}
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Circle
            cx={12}
            cy={10}
            r={2.5}
            stroke={color}
            strokeWidth={1.8}
          />
        </>
      )}

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

      {name === 'note' && (
        <>
          <Rect
            x={5}
            y={3}
            width={14}
            height={18}
            rx={2}
            stroke={color}
            strokeWidth={1.8}
          />
          <Path
            d="M8 8H16M8 12H16M8 16H13"
            stroke={color}
            strokeWidth={1.8}
            strokeLinecap="round"
          />
        </>
      )}

      {name === 'play' && (
        <>
          <Circle
            cx={12}
            cy={12}
            r={9}
            stroke={color}
            strokeWidth={1.8}
          />
          <Path
            d="M10 8L16 12L10 16V8Z"
            stroke={color}
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      )}

      {name === 'stop' && (
        <>
          <Circle
            cx={12}
            cy={12}
            r={9}
            stroke={color}
            strokeWidth={1.8}
          />
          <Rect
            x={9}
            y={9}
            width={6}
            height={6}
            rx={1}
            fill={color}
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

      {name === 'close' && (
        <Path
          d="M6 6L18 18M18 6L6 18"
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
        />
      )}
    </Svg>
  );
}

// ==========================================
// STATUS SESI
// ==========================================

function SessionStatus({ status }: { status: string }) {
  let label = 'Dijadwalkan';
  let icon: IconName = 'clock';

  if (status === 'dibuka') {
    label = 'Sedang berlangsung';
    icon = 'play';
  } else if (status === 'ditutup') {
    label = 'Selesai';
    icon = 'check';
  }

  return (
    <View style={styles.statusBadge}>
      <DetailIcon name={icon} size={15} color="#5F5F66" />
      <Text style={styles.statusText}>{label}</Text>
    </View>
  );
}

// ==========================================
// INFORMASI SESI
// ==========================================

function InfoRow({
  icon,
  label,
  value,
  last = false,
}: {
  icon: IconName;
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <View style={[styles.infoRow, last && styles.infoRowLast]}>
      <View style={styles.infoIcon}>
        <DetailIcon name={icon} size={20} />
      </View>

      <View style={styles.infoText}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

// ==========================================
// HALAMAN DETAIL SESI
// ==========================================

export default function AssistantSessionDetailScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();

  const { sessions, openSession, closeSession } = useAssistantSessions();

  // Mengambil sesi dari data Firebase melalui context.
  const session = sessions.find((item) => item.id === sessionId);

  // STATE MODAL
  const [modalVisible, setModalVisible] = useState(false);
  const [sessionNote, setSessionNote] = useState('');

  // STATE PROSES DAN ERROR
  const [processingAction, setProcessingAction] = useState(false);
  const [actionError, setActionError] = useState('');

  // ========================================
  // MEMBUKA MODAL KONFIRMASI
  // ========================================

  function openActionModal() {
    if (!session) return;

    setSessionNote(session.sessionNote || '');
    setActionError('');
    setModalVisible(true);
  }

  // ========================================
  // MENUTUP MODAL
  // ========================================

  function closeActionModal() {
    if (processingAction) return;

    setModalVisible(false);
    setSessionNote('');
    setActionError('');
  }

  // ========================================
  // KONFIRMASI BUKA / TUTUP SESI
  // ========================================

  async function handleConfirmAction() {
    if (!session) return;

    try {
      setProcessingAction(true);
      setActionError('');

      if (session.status === 'dijadwalkan') {
        // Membuka sesi sekaligus menyimpan catatan ke Firebase.
        await openSession(session.id, sessionNote);
      } else if (session.status === 'dibuka') {
        // Menutup sesi melalui Firebase.
        await closeSession(session.id);
      }

      // Modal ditutup setelah proses Firebase berhasil.
      setSessionNote('');
      setModalVisible(false);

    } catch (error) {
      console.error('Gagal mengubah status sesi:', error);

      setActionError(
        error instanceof Error
          ? error.message
          : 'Terjadi kesalahan saat memproses sesi.',
      );
    } finally {
      setProcessingAction(false);
    }
  }

  // ========================================
  // JIKA SESI BELUM DITEMUKAN
  // ========================================

  if (!session) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" />
        <AssistantHeader />

        <View style={styles.notFound}>
          <View style={styles.notFoundIcon}>
            <DetailIcon name="alert" size={30} />
          </View>

          <Text style={styles.notFoundTitle}>
            Sesi tidak ditemukan
          </Text>

          <Text style={styles.notFoundDescription}>
            Data sesi yang kamu cari tidak tersedia.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const isScheduled = session.status === 'dijadwalkan';
  const isOpen = session.status === 'dibuka';
  const isClosed = session.status === 'ditutup';
  const baseLocation = session.labName || session.classRoom || '-';
  const locationValue =
    session.labId && session.labRadius
      ? `${baseLocation} (Radius presensi ${session.labRadius} m)`
      : baseLocation;

  // ========================================
  // TAMPILAN UTAMA
  // ========================================

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <AssistantHeader />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        {/* JUDUL SESI */}
        <View style={styles.heading}>
          <Text style={styles.pageSubtitle}>
            DETAIL SESI PRAKTIKUM
          </Text>

          <Text style={styles.title}>
            {session.practicumName}
          </Text>

          <SessionStatus status={session.status} />
        </View>

        {/* INFORMASI SESI */}
        <View style={styles.infoCard}>
          <Text style={styles.sectionTitle}>
            Informasi Sesi
          </Text>

          <InfoRow
            icon="book"
            label="Pertemuan dan Materi"
            value={session.moduleTitle}
          />

          <InfoRow
            icon="pin"
            label="Lokasi"
            value={locationValue}
          />

          <InfoRow
            icon="clock"
            label="Jadwal"
            value={session.scheduleTime}
          />

          <InfoRow
            icon="note"
            label="Catatan Sesi"
            value={session.sessionNote || 'Belum ada catatan'}
            last
          />
        </View>

        {/* TOMBOL BUKA SESI */}
        {isScheduled && (
          <Pressable
            style={({ pressed }) => [
              styles.actionButton,
              pressed && styles.buttonPressed,
            ]}
            onPress={openActionModal}
          >
            <DetailIcon name="play" size={20} color="#FFFFFF" />
            <Text style={styles.actionButtonText}>
              Buka Sesi
            </Text>
          </Pressable>
        )}

        {/* TOMBOL TUTUP SESI */}
        {isOpen && (
          <Pressable
            style={({ pressed }) => [
              styles.closeSessionButton,
              pressed && styles.buttonPressed,
            ]}
            onPress={openActionModal}
          >
            <DetailIcon name="stop" size={20} color="#111014" />
            <Text style={styles.closeSessionButtonText}>
              Tutup Sesi
            </Text>
          </Pressable>
        )}

        {/* NOTIFIKASI SESI SELESAI */}
        {isClosed && (
          <View style={styles.closedNotice}>
            <DetailIcon name="check" size={21} color="#5F5F66" />

            <View style={styles.closedNoticeContent}>
              <Text style={styles.closedNoticeTitle}>
                Sesi telah selesai
              </Text>

              <Text style={styles.closedNoticeText}>
                Presensi untuk sesi ini sudah ditutup.
              </Text>
            </View>
          </View>
        )}

        {/* REKAP PRESENSI */}
        <View style={styles.attendanceSection}>
          <Text style={styles.sectionTitle}>
            Rekap Presensi
          </Text>

          <AttendanceSummary records={session.attendances} />
        </View>
      </ScrollView>

      {/* =====================================
          MODAL KONFIRMASI BUKA / TUTUP SESI
      ===================================== */}

      <Modal
        animationType="slide"
        transparent
        visible={modalVisible}
        onRequestClose={closeActionModal}
      >
        {/* Kartu ikut naik di atas keyboard saat kolom catatan diisi. */}
        <KeyboardAvoidingView behavior="padding" style={styles.modalBackdrop}>
          <View style={styles.modalCard}>

            {/* TOMBOL TUTUP MODAL */}
            <View style={styles.modalTop}>
              <Pressable
                style={[
                  styles.modalCloseButton,
                  processingAction && styles.disabledButton,
                ]}
                onPress={closeActionModal}
                disabled={processingAction}
                hitSlop={8}
              >
                <DetailIcon
                  name="close"
                  size={20}
                  color="#5F5F66"
                />
              </Pressable>
            </View>

            {/* JUDUL */}
            <Text style={styles.modalTitle}>
              {isScheduled
                ? 'Buka sesi praktikum?'
                : 'Tutup sesi praktikum?'}
            </Text>

            {/* DESKRIPSI */}
            <Text style={styles.modalDescription}>
              {isScheduled
                ? 'Sesi akan berubah menjadi berlangsung dan praktikan dapat melakukan presensi.'
                : 'Sesi akan ditandai selesai. Praktikan tidak dapat melakukan presensi setelah sesi ditutup.'}
            </Text>

            {/* INPUT CATATAN */}
            {isScheduled && (
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>
                  Catatan / materi sesi (opsional)
                </Text>

                <TextInput
                  value={sessionNote}
                  onChangeText={setSessionNote}
                  placeholder="Contoh: Bahas latihan bagian 1–3"
                  placeholderTextColor="#8E8E93"
                  multiline
                  textAlignVertical="top"
                  style={styles.noteInput}
                  editable={!processingAction}
                />
              </View>
            )}

            {/* PESAN ERROR */}
            {actionError ? (
              <View style={styles.modalErrorBox}>
                <DetailIcon name="alert" size={17} color="#5F5F66" />

                <Text style={styles.modalError}>
                  {actionError}
                </Text>
              </View>
            ) : null}

            {/* TOMBOL */}
            <View style={styles.modalActions}>
              <Pressable
                style={({ pressed }) => [
                  styles.cancelButton,
                  pressed && styles.buttonPressed,
                  processingAction && styles.disabledButton,
                ]}
                onPress={closeActionModal}
                disabled={processingAction}
              >
                <Text style={styles.cancelButtonText}>
                  Batal
                </Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  styles.confirmButton,
                  pressed && styles.buttonPressed,
                  processingAction && styles.disabledButton,
                ]}
                onPress={handleConfirmAction}
                disabled={processingAction}
              >
                {processingAction ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.confirmButtonText}>
                    Konfirmasi
                  </Text>
                )}
              </Pressable>
            </View>

          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

// ==========================================
// STYLE DETAIL SESI
// ==========================================

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: '#FFFFFF',
    flex: 1,
    borderColor: '#8E8E93',
    borderWidth: 1,
  },

  content: {
    gap: 20,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 40,
  },

  // JUDUL
  heading: {
    gap: 10,
  },

  pageSubtitle: {
    fontFamily: FONT.bold,
    color: '#5F5F66',
    fontSize: 11,
    letterSpacing: 1.2,
  },

  title: {
    fontFamily: FONT.extrabold,
    color: '#111014',
    fontSize: 25,
    lineHeight: 33,
  },

  // STATUS
  statusBadge: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    flexDirection: 'row',
    gap: 7,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderColor: '#8E8E93',
    borderWidth: 1,
  },

  statusText: {
    fontFamily: FONT.bold,
    color: '#5F5F66',
    fontSize: 12,
  },

  // INFORMASI SESI
  infoCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#8E8E93',
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 18,
  },

  sectionTitle: {
    fontFamily: FONT.extrabold,
    color: '#111014',
    fontSize: 17,
    marginBottom: 8,
  },

  infoRow: {
    alignItems: 'center',
    borderBottomColor: '#E4E4E7',
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 13,
    paddingVertical: 15,
  },

  infoRowLast: {
    borderBottomWidth: 0,
  },

  infoIcon: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    height: 42,
    justifyContent: 'center',
    width: 42,
    borderColor: '#8E8E93',
    borderWidth: 1,
  },

  infoText: {
    flex: 1,
    gap: 5,
  },

  infoLabel: {
    fontFamily: FONT.semibold,
    color: '#5F5F66',
    fontSize: 12,
  },

  infoValue: {
    fontFamily: FONT.bold,
    color: '#111014',
    fontSize: 14,
    lineHeight: 20,
  },

  // TOMBOL BUKA
  actionButton: {
    alignItems: 'center',
    backgroundColor: '#111014',
    borderRadius: 14,
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
    padding: 16,
  },

  actionButtonText: {
    fontFamily: FONT.bold,
    color: '#FFFFFF',
    fontSize: 15,
  },

  // TOMBOL TUTUP
  closeSessionButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#111014',
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
    padding: 15,
  },

  closeSessionButtonText: {
    fontFamily: FONT.bold,
    color: '#111014',
    fontSize: 15,
  },

  // NOTIFIKASI SELESAI
  closedNotice: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    borderColor: '#8E8E93',
    borderWidth: 1,
  },

  closedNoticeContent: {
    flex: 1,
    gap: 4,
  },

  closedNoticeTitle: {
    fontFamily: FONT.extrabold,
    color: '#111014',
    fontSize: 14,
  },

  closedNoticeText: {
    fontFamily: FONT.regular,
    color: '#5F5F66',
    fontSize: 12,
    lineHeight: 18,
  },

  // REKAP
  attendanceSection: {
    gap: 12,
  },

  // ========================================
  // MODAL
  // ========================================

  modalBackdrop: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    flex: 1,
    justifyContent: 'flex-end',
  },

  modalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    gap: 14,
    padding: 22,
    paddingBottom: 32,
  },

  modalTop: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },

  modalCloseButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    height: 36,
    justifyContent: 'center',
    width: 36,
    borderColor: '#8E8E93',
    borderWidth: 1,
  },

  modalTitle: {
    fontFamily: FONT.extrabold,
    color: '#111014',
    fontSize: 20,
  },

  modalDescription: {
    fontFamily: FONT.regular,
    color: '#5F5F66',
    fontSize: 14,
    lineHeight: 21,
  },

  // INPUT CATATAN
  inputContainer: {
    gap: 9,
    marginTop: 4,
  },

  inputLabel: {
    fontFamily: FONT.bold,
    color: '#111014',
    fontSize: 13,
  },

  noteInput: {
    fontFamily: FONT.regular,
    borderColor: '#8E8E93',
    borderRadius: 12,
    borderWidth: 1,
    color: '#111014',
    fontSize: 14,
    minHeight: 95,
    padding: 12,
  },

  // ERROR
  modalErrorBox: {
    alignItems: 'center',
    backgroundColor: '#E00000',
    borderRadius: 10,
    flexDirection: 'row',
    gap: 8,
    padding: 11,
  },

  modalError: {
    fontFamily: FONT.regular,
    color: '#E00000',
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
  },

  // TOMBOL MODAL
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },

  cancelButton: {
    alignItems: 'center',
    borderColor: '#8E8E93',
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    padding: 14,
  },

  cancelButtonText: {
    fontFamily: FONT.bold,
    color: '#111014',
    fontSize: 14,
  },

  confirmButton: {
    alignItems: 'center',
    backgroundColor: '#111014',
    borderRadius: 12,
    flex: 1,
    justifyContent: 'center',
    padding: 14,
  },

  confirmButtonText: {
    fontFamily: FONT.bold,
    color: '#FFFFFF',
    fontSize: 14,
  },

  buttonPressed: {
    opacity: 0.65,
  },

  disabledButton: {
    opacity: 0.5,
  },

  // ========================================
  // SESI TIDAK DITEMUKAN
  // ========================================

  notFound: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: 30,
  },

  notFoundIcon: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    height: 64,
    justifyContent: 'center',
    marginBottom: 18,
    width: 64,
    borderColor: '#8E8E93',
    borderWidth: 1,
  },

  notFoundTitle: {
    fontFamily: FONT.extrabold,
    color: '#111014',
    fontSize: 18,
  },

  notFoundDescription: {
    fontFamily: FONT.regular,
    color: '#5F5F66',
    fontSize: 13,
    marginTop: 8,
    textAlign: 'center',
  },
});