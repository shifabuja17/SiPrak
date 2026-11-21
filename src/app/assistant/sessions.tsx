import { useEffect, useState } from 'react';

import {
  ActivityIndicator,
  KeyboardAvoidingView,
  FlatList,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import Svg, { Path } from 'react-native-svg';

import AssistantHeader from '@/components/common/AssistantHeader';

import { useAuth } from '@/context/AuthContext';

import AttendanceRecap from '@/features/assistant/components/attendance-recap';

import {
  subscribeSchedules,
  type PracticumSchedule,
} from '@/features/assistant/services/schedule-service';

import {
  createSession,
  deleteSession,
  subscribeSessions,
  updateSession,
  openSession,
  closeSession,
  type SessionRecord,
  type SessionInput,
} from '@/features/assistant/services/session-service';
import DateTimeField from '@/components/common/DateTimeField';
import {
  combineDateAndTime,
  defaultSessionTimesFromSchedule,
  formatSessionTimeRange,
  startOfDay,
  toClockTime,
} from '@/utils/session-time';

// ==========================================
// FORM KOSONG
// ==========================================

interface SessionForm {
  scheduleId: string;
  sessionNote: string;
  /** Tanggal pertemuan (bagian jam diabaikan). */
  tanggal: Date;
  /** Jam mulai & selesai (bagian tanggal diabaikan). */
  jamMulai: Date;
  jamSelesai: Date;
}

function timesFromSchedule(scheduleTime: string) {
  const defaults = defaultSessionTimesFromSchedule(scheduleTime);
  return {
    tanggal: defaults.date,
    jamMulai: combineDateAndTime(defaults.date, defaults.start),
    jamSelesai: combineDateAndTime(defaults.date, defaults.end),
  };
}

function createEmptyForm(): SessionForm {
  return {
    scheduleId: '',
    sessionNote: '',
    ...timesFromSchedule(''),
  };
}

type SessionActionType = 'delete' | 'open' | 'close';

type SessionIconName = 'plus' | 'check';

// ==========================================
// KOMPONEN IKON SVG
// ==========================================

function SessionIcon({
  name,
  size = 20,
  color = '#000000',
}: {
  name: SessionIconName;
  size?: number;
  color?: string;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {name === 'plus' && (
        <Path
          d="M12 5V19M5 12H19"
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
        />
      )}

      {name === 'check' && (
        <Path
          d="M5 12L10 17L19 7"
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </Svg>
  );
}

// ==========================================
// HALAMAN MANAJEMEN SESI
// ==========================================

export default function AssistantSessionsScreen() {
  const { profile, loading: authLoading } = useAuth();

  // DATA FIRESTORE
  const [schedules, setSchedules] = useState<PracticumSchedule[]>([]);
  const [sessions, setSessions] = useState<SessionRecord[]>([]);

  // LOADING
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [processingAction, setProcessingAction] = useState(false);

  // ERROR DAN NOTIFIKASI
  const [error, setError] = useState('');
  const [pageMessage, setPageMessage] = useState('');
  const [modalError, setModalError] = useState('');
  const [actionError, setActionError] = useState('');

  // MODAL TAMBAH / EDIT
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [form, setForm] = useState<SessionForm>(createEmptyForm);

  // MODAL KONFIRMASI AKSI
  const [actionTarget, setActionTarget] = useState<{
    type: SessionActionType;
    item: SessionRecord;
  } | null>(null);

  // ==========================================
  // MENGAMBIL JADWAL DAN SESI REAL-TIME
  // ==========================================

  useEffect(() => {
    if (authLoading) return;

    if (!profile || profile.role !== 'asisten') {
      setLoading(false);
      setError('Halaman ini hanya dapat diakses oleh Asisten.');
      return;
    }

    setLoading(true);
    setError('');

    const unsubscribeSchedules = subscribeSchedules(
      (data) => {
        setSchedules(data);
      },
      (firebaseError) => {
        console.error('Gagal mengambil jadwal:', firebaseError);
        setError('Gagal mengambil daftar jadwal.');
        setLoading(false);
      },
    );

    const unsubscribeSessions = subscribeSessions(
      (data) => {
        setSessions(data);
        setLoading(false);
        setError('');
      },
      (firebaseError) => {
        console.error('Gagal mengambil sesi:', firebaseError);
        setError('Gagal mengambil daftar sesi.');
        setLoading(false);
      },
    );

    return () => {
      unsubscribeSchedules();
      unsubscribeSessions();
    };
  }, [profile, authLoading]);

  // ==========================================
  // FORM TAMBAH SESI
  // ==========================================

  function openCreateModal() {
    setPageMessage('');

    if (schedules.length === 0) {
      setError(
        'Buat jadwal praktikum terlebih dahulu sebelum menambahkan sesi.'
      );
      return;
    }

    setEditingId(null);

    setForm({
      scheduleId: schedules[0].id,
      sessionNote: '',
      ...timesFromSchedule(schedules[0].scheduleTime),
    });

    setModalError('');
    setModalVisible(true);
  }

  // ==========================================
  // FORM EDIT SESI
  // ==========================================

  function openEditModal(item: SessionRecord) {
    if (item.status !== 'dijadwalkan') {
      setPageMessage(
        'Hanya sesi yang belum dibuka yang dapat diedit.'
      );
      return;
    }

    const scheduleExists = schedules.some(
      (schedule) => schedule.id === item.scheduleId,
    );

    if (!scheduleExists) {
      setPageMessage(
        'Jadwal yang terhubung dengan sesi ini sudah tidak tersedia.'
      );
      return;
    }

    setEditingId(item.id);

    const linkedSchedule = schedules.find(
      (schedule) => schedule.id === item.scheduleId,
    );

    setForm({
      scheduleId: item.scheduleId,
      sessionNote: item.sessionNote || '',
      ...(item.waktuMulai && item.waktuSelesai
        ? {
            tanggal: startOfDay(item.waktuMulai),
            jamMulai: item.waktuMulai,
            jamSelesai: item.waktuSelesai,
          }
        : timesFromSchedule(linkedSchedule?.scheduleTime ?? item.scheduleTime)),
    });

    setModalError('');
    setModalVisible(true);
  }

  // ==========================================
  // MENUTUP MODAL
  // ==========================================

  function closeModal() {
    if (saving) return;

    setModalVisible(false);
    setEditingId(null);
    setForm(createEmptyForm());
    setModalError('');
  }

  // ==========================================
  // MENDAPATKAN JADWAL TERPILIH
  // ==========================================

  function getSelectedSchedule() {
    return schedules.find(
      (item) => item.id === form.scheduleId,
    );
  }

  // ==========================================
  // MENYIMPAN SESI
  // ==========================================

  async function handleSave() {
    if (!profile?.uid) {
      setModalError('Identitas Asisten tidak ditemukan.');
      return;
    }

    const selectedSchedule = getSelectedSchedule();

    if (!selectedSchedule) {
      setModalError('Pilih jadwal praktikum terlebih dahulu.');
      return;
    }

    const waktuMulai = combineDateAndTime(form.tanggal, toClockTime(form.jamMulai));
    const waktuSelesai = combineDateAndTime(form.tanggal, toClockTime(form.jamSelesai));

    if (!editingId && startOfDay(form.tanggal) < startOfDay(new Date())) {
      setModalError('Tanggal sesi tidak boleh sebelum hari ini.');
      return;
    }

    if (waktuSelesai <= waktuMulai) {
      setModalError('Jam selesai harus setelah jam mulai.');
      return;
    }

    const input: SessionInput = {
      scheduleId: selectedSchedule.id,
      classId: selectedSchedule.classId,
      practicumName: selectedSchedule.practicumName,
      moduleTitle: selectedSchedule.moduleTitle,
      classRoom: selectedSchedule.classRoom,
      scheduleTime: selectedSchedule.scheduleTime,
      waktuMulai,
      waktuSelesai,
      sessionNote: form.sessionNote.trim(),
    };

    try {
      setSaving(true);
      setModalError('');
      setPageMessage('');

      if (editingId) {
        await updateSession(editingId, input);
        setPageMessage('Sesi berhasil diperbarui.');
      } else {
        await createSession(input, profile.uid);
        setPageMessage('Sesi berhasil ditambahkan.');
      }

      setModalVisible(false);
      setEditingId(null);
      setForm(createEmptyForm());

    } catch (firebaseError) {
      console.error('Gagal menyimpan sesi:', firebaseError);

      setModalError(
        firebaseError instanceof Error
          ? firebaseError.message
          : 'Sesi tidak berhasil disimpan.',
      );
    } finally {
      setSaving(false);
    }
  }

  // ==========================================
  // MEMBUKA MODAL KONFIRMASI
  // ==========================================

  function openActionModal(
    type: SessionActionType,
    item: SessionRecord,
  ) {
    setActionError('');
    setActionTarget({ type, item });
  }

  function closeActionModal() {
    if (processingAction) return;

    setActionTarget(null);
    setActionError('');
  }

  // ==========================================
  // MENJALANKAN AKSI SESI
  // ==========================================

  async function handleSessionAction() {
    if (!actionTarget) return;

    const { type, item } = actionTarget;

    try {
      setProcessingAction(true);
      setActionError('');
      setPageMessage('');

      if (type === 'delete') {
        await deleteSession(item.id);
        setPageMessage('Sesi berhasil dihapus.');
      }

      if (type === 'open') {
        await openSession(item.id);
        setPageMessage('Sesi praktikum berhasil dibuka.');
      }

      if (type === 'close') {
        await closeSession(item.id);
        setPageMessage('Sesi praktikum berhasil ditutup.');
      }

      setActionTarget(null);

    } catch (firebaseError) {
      console.error('Gagal menjalankan aksi sesi:', firebaseError);

      setActionError(
        firebaseError instanceof Error
          ? firebaseError.message
          : 'Terjadi kesalahan saat memproses sesi.',
      );
    } finally {
      setProcessingAction(false);
    }
  }

  // ==========================================
  // DETAIL KONFIRMASI AKSI
  // ==========================================

  const actionTitle =
    actionTarget?.type === 'delete'
      ? 'Hapus Sesi?'
      : actionTarget?.type === 'open'
        ? 'Buka Sesi Praktikum?'
        : 'Tutup Sesi Praktikum?';

  const actionDescription =
    actionTarget?.type === 'delete'
      ? 'Apakah kamu yakin ingin menghapus sesi ini? Tindakan ini tidak dapat dibatalkan.'
      : actionTarget?.type === 'open'
        ? 'Sesi akan dibuka dan praktikan dapat mulai melakukan presensi.'
        : 'Sesi akan ditutup. Praktikan tidak dapat melakukan presensi lagi setelah sesi ditutup.';

  const actionButtonText =
    actionTarget?.type === 'delete'
      ? 'Hapus'
      : actionTarget?.type === 'open'
        ? 'Buka Sesi'
        : 'Tutup Sesi';

  // ==========================================
  // KARTU SESI
  // ==========================================

  function renderSession({
    item,
  }: {
    item: SessionRecord;
  }) {
    const statusLabel =
      item.status === 'dijadwalkan'
        ? 'BELUM DIBUKA'
        : item.status === 'dibuka'
          ? 'BERLANGSUNG'
          : 'SELESAI';

    return (
      <View style={styles.sessionItem}>
        <View style={styles.card}>

          {/* HEADER KARTU */}
          <View style={styles.cardHeader}>
            <View style={styles.cardTitleContainer}>
              <Text style={styles.sessionName}>
                {item.practicumName}
              </Text>

              <View
                style={[
                  styles.statusBadge,
                  item.status === 'dibuka' && styles.openBadge,
                  item.status === 'ditutup' && styles.closedBadge,
                ]}
              >
                <View
                  style={[
                    styles.statusDot,
                    item.status === 'dibuka' && styles.openDot,
                    item.status === 'ditutup' && styles.closedDot,
                  ]}
                />

                <Text style={styles.statusText}>
                  {statusLabel}
                </Text>
              </View>
            </View>
          </View>

          {/* INFORMASI SESI */}
          <View style={styles.detailGroup}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>
                ID Kelas
              </Text>

              <Text style={styles.detailValue}>
                {item.classId}
              </Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>
                Modul
              </Text>

              <Text style={styles.detailValue}>
                {item.moduleTitle}
              </Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>
                Ruangan
              </Text>

              <Text style={styles.detailValue}>
                {item.classRoom}
              </Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>
                Catatan Sesi
              </Text>

              <Text style={styles.detailValue}>
                {item.sessionNote || 'Tidak ada catatan.'}
              </Text>
            </View>
          </View>

          {/* INFORMASI WAKTU */}
          <View style={styles.timeBox}>
            <Text style={styles.timeLabel}>
              {item.waktuMulai ? 'WAKTU SESI' : 'JADWAL PRAKTIKUM'}
            </Text>

            <Text style={styles.timeValue}>
              {item.waktuMulai
                ? formatSessionTimeRange(item.waktuMulai, item.waktuSelesai)
                : item.scheduleTime}
            </Text>
          </View>

          {/* REKAP KEHADIRAN REAL-TIME */}
          <View style={styles.recapContainer}>
            <Text style={styles.recapTitle}>
              Rekap Kehadiran
            </Text>

            <AttendanceRecap
              sessionId={item.id}
              classId={item.classId}
            />
          </View>

          {/* SESI BELUM DIBUKA */}
          {item.status === 'dijadwalkan' && (
            <View style={styles.actionContainer}>
              <View style={styles.actionRow}>
                <Pressable
                  style={({ pressed }) => [
                    styles.editButton,
                    pressed && styles.pressed,
                  ]}
                  onPress={() => openEditModal(item)}
                >
                  <Text style={styles.editButtonText}>
                    Edit
                  </Text>
                </Pressable>

                <Pressable
                  style={({ pressed }) => [
                    styles.deleteButton,
                    pressed && styles.pressed,
                  ]}
                  onPress={() => openActionModal('delete', item)}
                >
                  <Text style={styles.deleteButtonText}>
                    Hapus
                  </Text>
                </Pressable>
              </View>

              <Pressable
                style={({ pressed }) => [
                  styles.openButton,
                  pressed && styles.pressed,
                ]}
                onPress={() => openActionModal('open', item)}
              >
                <Text style={styles.openButtonText}>
                  Buka Sesi
                </Text>
              </Pressable>
            </View>
          )}

          {/* SESI SEDANG BERLANGSUNG */}
          {item.status === 'dibuka' && (
            <Pressable
              style={({ pressed }) => [
                styles.closeButton,
                pressed && styles.pressed,
              ]}
              onPress={() => openActionModal('close', item)}
            >
              <Text style={styles.closeButtonText}>
                Tutup Sesi
              </Text>
            </Pressable>
          )}

          {/* SESI SELESAI */}
          {item.status === 'ditutup' && (
            <View style={styles.lockedBox}>
              <Text style={styles.lockedText}>
                Sesi telah selesai. Presensi sudah ditutup.
              </Text>
            </View>
          )}

        </View>
      </View>
    );
  }

  const isLoading = authLoading || loading;

  // ==========================================
  // PEMERIKSAAN AKSES
  // ==========================================

  if (authLoading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color="#000000" />

        <Text style={styles.mutedText}>
          Memeriksa akun...
        </Text>
      </SafeAreaView>
    );
  }

  if (!profile || profile.role !== 'asisten') {
    return (
      <SafeAreaView style={styles.centered}>
        <Text style={styles.emptyTitle}>
          Akses Ditolak
        </Text>

        <Text style={styles.mutedText}>
          Halaman ini hanya dapat diakses oleh Asisten.
        </Text>
      </SafeAreaView>
    );
  }

  // ==========================================
  // TAMPILAN UTAMA
  // ==========================================

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" />

      <FlatList
        data={sessions}
        keyExtractor={(item) => item.id}
        renderItem={renderSession}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => (
          <View style={styles.separator} />
        )}

        // HEADER HALAMAN
        ListHeaderComponent={
          <View>
            <AssistantHeader />

            <View style={styles.pageContent}>

              {/* JUDUL HALAMAN */}
              <View style={styles.header}>
                <Text style={styles.title}>
                  Manajemen Sesi
                </Text>

                <Text style={styles.subtitle}>
                  Buat dan kelola sesi berdasarkan jadwal praktikum.
                </Text>
              </View>

              {/* TOMBOL TAMBAH */}
              <Pressable
                style={({ pressed }) => [
                  styles.addButton,
                  pressed && styles.pressed,
                ]}
                onPress={openCreateModal}
              >
                <SessionIcon
                  name="plus"
                  size={19}
                  color="#FFFFFF"
                />

                <Text style={styles.addButtonText}>
                  Tambah Sesi
                </Text>
              </Pressable>

              {/* PESAN BERHASIL */}
              {pageMessage ? (
                <View style={styles.successBox}>
                  <Text style={styles.successText}>
                    {pageMessage}
                  </Text>
                </View>
              ) : null}

              {/* PESAN ERROR */}
              {error ? (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>
                    {error}
                  </Text>
                </View>
              ) : null}

              {/* HEADER DAFTAR SESI */}
              <View style={styles.sectionHeader}>
                <View style={styles.sectionInfo}>
                  <Text style={styles.sectionTitle}>
                    Daftar Sesi
                  </Text>

                  <Text style={styles.sectionCaption}>
                    Pantau status dan kehadiran praktikan.
                  </Text>
                </View>

                <View style={styles.totalBadge}>
                  <Text style={styles.totalText}>
                    {sessions.length} sesi
                  </Text>
                </View>
              </View>
            </View>
          </View>
        }

        // KONDISI KOSONG
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            {isLoading ? (
              <>
                <ActivityIndicator
                  size="large"
                  color="#000000"
                />

                <Text style={styles.mutedText}>
                  Memuat data sesi...
                </Text>
              </>
            ) : (
              <>
                <View style={styles.emptyIcon}>
                  <SessionIcon
                    name="plus"
                    size={25}
                    color="#000000"
                  />
                </View>

                <Text style={styles.emptyTitle}>
                  Belum Ada Sesi
                </Text>

                <Text style={styles.emptyText}>
                  Tekan Tambah Sesi untuk membuat sesi
                  praktikum pertama.
                </Text>
              </>
            )}
          </View>
        }
      />

      {/* =====================================
          MODAL TAMBAH / EDIT SESI
      ===================================== */}

      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={closeModal}
        statusBarTranslucent
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={closeModal}
            disabled={saving}
          />

          <View style={styles.modalContainer}>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.modalHandle} />

              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {editingId ? 'Edit Sesi' : 'Tambah Sesi'}
                </Text>

                <Text style={styles.modalSubtitle}>
                  Pilih jadwal praktikum, tentukan tanggal dan jam pertemuan, lalu lengkapi catatan sesi.
                </Text>
              </View>

              {/* PILIH JADWAL */}
              <Text style={styles.label}>
                Pilih Jadwal Praktikum
              </Text>

              <View style={styles.scheduleOptions}>
                {schedules.map((item) => {
                  const selected = form.scheduleId === item.id;

                  return (
                    <Pressable
                      key={item.id}
                      style={({ pressed }) => [
                        styles.scheduleOption,
                        selected && styles.scheduleOptionSelected,
                        pressed && styles.pressed,
                      ]}
                      onPress={() => {
                        setForm((previous) => ({
                          ...previous,
                          scheduleId: item.id,
                          // Saat membuat sesi baru, isi otomatis tanggal & jam dari jadwal.
                          ...(editingId ? {} : timesFromSchedule(item.scheduleTime)),
                        }));

                        setModalError('');
                      }}
                      disabled={saving}
                    >
                      <View style={styles.scheduleOptionHeader}>
                        <Text
                          style={[
                            styles.scheduleOptionTitle,
                            selected && styles.scheduleOptionTitleSelected,
                          ]}
                        >
                          {item.practicumName}
                        </Text>

                        {selected ? (
                          <View style={styles.selectedMark}>
                            <SessionIcon
                              name="check"
                              size={17}
                              color="#000000"
                            />
                          </View>
                        ) : null}
                      </View>

                      <Text style={styles.scheduleOptionDetail}>
                        {item.moduleTitle}
                      </Text>

                      <Text style={styles.scheduleOptionDetail}>
                        {item.classRoom} · {item.scheduleTime}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {/* TANGGAL & JAM SESI */}
              <Text style={styles.label}>
                Tanggal Pertemuan
              </Text>

              <DateTimeField
                mode="date"
                value={form.tanggal}
                minimumDate={editingId ? undefined : startOfDay(new Date())}
                disabled={saving}
                accessibilityLabel="Tanggal pertemuan"
                onChange={(value) => {
                  setForm((previous) => ({
                    ...previous,
                    tanggal: startOfDay(value),
                  }));
                  setModalError('');
                }}
              />

              <View style={styles.timeRow}>
                <View style={styles.timeColumn}>
                  <Text style={styles.label}>
                    Jam Mulai
                  </Text>

                  <DateTimeField
                    mode="time"
                    value={form.jamMulai}
                    disabled={saving}
                    accessibilityLabel="Jam mulai"
                    onChange={(value) => {
                      setForm((previous) => ({
                        ...previous,
                        jamMulai: value,
                      }));
                      setModalError('');
                    }}
                  />
                </View>

                <View style={styles.timeColumn}>
                  <Text style={styles.label}>
                    Jam Selesai
                  </Text>

                  <DateTimeField
                    mode="time"
                    value={form.jamSelesai}
                    disabled={saving}
                    accessibilityLabel="Jam selesai"
                    onChange={(value) => {
                      setForm((previous) => ({
                        ...previous,
                        jamSelesai: value,
                      }));
                      setModalError('');
                    }}
                  />
                </View>
              </View>

              {/* CATATAN SESI */}
              <Text style={styles.label}>
                Catatan Sesi
                <Text style={styles.optionalLabel}>
                  {' '}(Opsional)
                </Text>
              </Text>

              <TextInput
                style={styles.input}
                placeholder="Contoh: Praktikan wajib membawa laptop."
                placeholderTextColor="#888888"
                value={form.sessionNote}
                onChangeText={(value) => {
                  setForm((previous) => ({
                    ...previous,
                    sessionNote: value,
                  }));

                  setModalError('');
                }}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                editable={!saving}
              />

              {/* ERROR FORM */}
              {modalError ? (
                <Text style={styles.modalError}>
                  {modalError}
                </Text>
              ) : null}

              {/* TOMBOL */}
              <View style={styles.modalActions}>
                <Pressable
                  style={styles.cancelButton}
                  onPress={closeModal}
                  disabled={saving}
                >
                  <Text style={styles.cancelButtonText}>
                    Batal
                  </Text>
                </Pressable>

                <Pressable
                  style={[
                    styles.saveButton,
                    saving && styles.disabledButton,
                  ]}
                  onPress={handleSave}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.saveButtonText}>
                      {editingId ? 'Simpan Perubahan' : 'Simpan Sesi'}
                    </Text>
                  )}
                </Pressable>
              </View>

            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* =====================================
          MODAL KONFIRMASI AKSI SESI
      ===================================== */}

      <Modal
        visible={actionTarget !== null}
        transparent
        animationType="fade"
        onRequestClose={closeActionModal}
        statusBarTranslucent
      >
        <View style={styles.confirmBackdrop}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={closeActionModal}
            disabled={processingAction}
          />

          <View style={styles.confirmCard}>

            {/* JUDUL */}
            <Text style={styles.confirmTitle}>
              {actionTitle}
            </Text>

            {/* DESKRIPSI */}
            <Text style={styles.confirmDescription}>
              {actionDescription}
            </Text>

            {/* INFORMASI SESI */}
            {actionTarget ? (
              <View style={styles.confirmInfo}>
                <Text style={styles.confirmInfoName}>
                  {actionTarget.item.practicumName}
                </Text>

                <Text style={styles.confirmInfoDetail}>
                  {actionTarget.item.moduleTitle}
                </Text>

                <Text style={styles.confirmInfoDetail}>
                  {actionTarget.item.scheduleTime}
                </Text>
              </View>
            ) : null}

            {/* ERROR AKSI */}
            {actionError ? (
              <Text style={styles.modalError}>
                {actionError}
              </Text>
            ) : null}

            {/* TOMBOL */}
            <View style={styles.confirmActions}>
              <Pressable
                style={styles.cancelConfirmButton}
                onPress={closeActionModal}
                disabled={processingAction}
              >
                <Text style={styles.cancelConfirmText}>
                  Batal
                </Text>
              </Pressable>

              <Pressable
                style={[
                  styles.confirmButton,
                  processingAction && styles.disabledButton,
                ]}
                onPress={handleSessionAction}
                disabled={processingAction}
              >
                {processingAction ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.confirmButtonText}>
                    {actionButtonText}
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
// STYLE MANAJEMEN SESI
// ==========================================

const styles = StyleSheet.create({

  // HALAMAN UTAMA
  safeArea: {
    flex: 1,
    backgroundColor: '#F7F7F9',
  },

  content: {
    paddingBottom: 40,
  },

  pageContent: {
    paddingHorizontal: 20,
    paddingTop: 25,
    gap: 16,
  },

  sessionItem: {
    paddingHorizontal: 20,
  },

  separator: {
    height: 12,
  },

  centered: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    flex: 1,
    justifyContent: 'center',
    padding: 25,
    gap: 10,
  },

  // JUDUL
  header: {
    gap: 6,
  },

  title: {
    color: '#000000',
    fontSize: 27,
    fontWeight: '800',
  },

  subtitle: {
    color: '#666666',
    fontSize: 13,
    lineHeight: 20,
  },

  // TOMBOL TAMBAH
  addButton: {
    alignItems: 'center',
    backgroundColor: '#000000',
    borderRadius: 14,
    flexDirection: 'row',
    gap: 9,
    justifyContent: 'center',
    paddingVertical: 16,
  },

  addButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },

  pressed: {
    opacity: 0.65,
  },

  disabledButton: {
    opacity: 0.5,
  },

  // NOTIFIKASI
  successBox: {
    backgroundColor: '#E8F0E8',
    borderRadius: 11,
    padding: 12,
  },

  successText: {
    color: '#315A35',
    fontSize: 12,
    lineHeight: 18,
  },

  errorBox: {
    backgroundColor: '#FEE2E2',
    borderRadius: 11,
    padding: 12,
  },

  errorText: {
    color: '#991B1B',
    fontSize: 12,
    lineHeight: 18,
  },

  mutedText: {
    color: '#666666',
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
  },

  // DAFTAR SESI
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },

  sectionInfo: {
    flex: 1,
    gap: 4,
  },

  sectionTitle: {
    color: '#000000',
    fontSize: 19,
    fontWeight: '800',
  },

  sectionCaption: {
    color: '#777777',
    fontSize: 11,
    lineHeight: 17,
    paddingBottom: 10,
  },

  totalBadge: {
    backgroundColor: '#EAEAEA',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },

  totalText: {
    color: '#333333',
    fontSize: 12,
    fontWeight: '700',
  },

  // KARTU SESI
  card: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E5E5E5',
    borderRadius: 18,
    borderWidth: 1,
    gap: 15,
    padding: 17,
  },

  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },

  cardTitleContainer: {
    flex: 1,
    gap: 9,
  },

  sessionName: {
    color: '#000000',
    fontSize: 17,
    fontWeight: '800',
    lineHeight: 23,
  },

  // STATUS SESI
  statusBadge: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#EEEEEE',
    borderRadius: 20,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },

  openBadge: {
    backgroundColor: '#E5E5E5',
  },

  closedBadge: {
    backgroundColor: '#DCDCDC',
  },

  statusDot: {
    backgroundColor: '#777777',
    borderRadius: 4,
    height: 7,
    width: 7,
  },

  openDot: {
    backgroundColor: '#222222',
  },

  closedDot: {
    backgroundColor: '#999999',
  },

  statusText: {
    color: '#333333',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.3,
  },

  // DETAIL SESI
  detailGroup: {
    gap: 11,
  },

  detailRow: {
    gap: 3,
  },

  detailLabel: {
    color: '#888888',
    fontSize: 11,
    fontWeight: '600',
  },

  detailValue: {
    color: '#333333',
    fontSize: 13,
    lineHeight: 19,
  },

  // WAKTU SESI
  timeBox: {
    backgroundColor: '#F1F1F3',
    borderRadius: 12,
    padding: 13,
    gap: 5,
  },

  timeLabel: {
    color: '#777777',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },

  timeValue: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '800',
  },

  // REKAP KEHADIRAN
  recapContainer: {
    backgroundColor: '#F7F7F9',
    borderRadius: 14,
    padding: 13,
    gap: 10,
  },

  recapTitle: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '800',
  },

  // TOMBOL AKSI
  actionContainer: {
    gap: 10,
  },

  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },

  editButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#D0D0D0',
    borderRadius: 10,
    borderWidth: 1,
    flex: 1,
    padding: 11,
  },

  editButtonText: {
    color: '#000000',
    fontSize: 13,
    fontWeight: '700',
  },

  deleteButton: {
    alignItems: 'center',
    backgroundColor: '#EEEEEE',
    borderRadius: 10,
    flex: 1,
    padding: 11,
  },

  deleteButtonText: {
    color: '#333333',
    fontSize: 13,
    fontWeight: '700',
  },

  openButton: {
    alignItems: 'center',
    backgroundColor: '#000000',
    borderRadius: 11,
    padding: 14,
  },

  openButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },

  closeButton: {
    alignItems: 'center',
    backgroundColor: '#EEEEEE',
    borderRadius: 11,
    padding: 14,
  },

  closeButtonText: {
    color: '#000000',
    fontSize: 13,
    fontWeight: '700',
  },

  lockedBox: {
    backgroundColor: '#F1F1F3',
    borderRadius: 10,
    padding: 12,
  },

  lockedText: {
    color: '#666666',
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },

  // KONDISI KOSONG
  emptyCard: {
    alignItems: 'center',
    backgroundColor: '#EEEEF1',
    borderRadius: 18,
    marginHorizontal: 20,
    padding: 25,
    gap: 9,
  },

  emptyIcon: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 25,
    height: 50,
    justifyContent: 'center',
    width: 50,
    marginBottom: 4,
  },

  emptyTitle: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '800',
  },

  emptyText: {
    color: '#666666',
    fontSize: 13,
    lineHeight: 20,
    marginTop: 4,
    textAlign: 'center',
  },

  // ==========================================
  // MODAL TAMBAH / EDIT
  // ==========================================

  modalOverlay: {
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },

  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 23,
    maxHeight: '90%',
    padding: 21,
    width: '100%',
  },

  modalHandle: {
    alignSelf: 'center',
    backgroundColor: '#DDDDDD',
    borderRadius: 5,
    height: 5,
    marginBottom: 17,
    width: 42,
  },

  modalHeader: {
    gap: 5,
    marginBottom: 5,
  },

  modalTitle: {
    color: '#000000',
    fontSize: 21,
    fontWeight: '800',
  },

  modalSubtitle: {
    color: '#666666',
    fontSize: 12,
    lineHeight: 19,
  },

  // PILIH JADWAL
  label: {
    color: '#222222',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
    marginTop: 15,
  },

  timeRow: {
    flexDirection: 'row',
    gap: 12,
  },

  timeColumn: {
    flex: 1,
  },

  optionalLabel: {
    color: '#888888',
    fontSize: 11,
    fontWeight: '400',
  },

  scheduleOptions: {
    gap: 9,
  },

  scheduleOption: {
    backgroundColor: '#FFFFFF',
    borderColor: '#DDDDDD',
    borderRadius: 12,
    borderWidth: 1,
    padding: 13,
    gap: 5,
  },

  scheduleOptionSelected: {
    backgroundColor: '#F1F1F3',
    borderColor: '#000000',
  },

  scheduleOptionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },

  scheduleOptionTitle: {
    color: '#333333',
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
  },

  scheduleOptionTitleSelected: {
    color: '#000000',
  },

  scheduleOptionDetail: {
    color: '#777777',
    fontSize: 12,
    lineHeight: 18,
  },

  selectedMark: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  // INPUT
  input: {
    backgroundColor: '#F8F8F8',
    borderColor: '#DDDDDD',
    borderRadius: 11,
    borderWidth: 1,
    color: '#000000',
    fontSize: 14,
    minHeight: 90,
    paddingHorizontal: 12,
    paddingVertical: 13,
  },

  modalError: {
    color: '#B91C1C',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 10,
  },

  // TOMBOL MODAL
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
    marginBottom: 5,
  },

  cancelButton: {
    alignItems: 'center',
    backgroundColor: '#EEEEEE',
    borderRadius: 11,
    flex: 1,
    padding: 13,
  },

  cancelButtonText: {
    color: '#222222',
    fontSize: 13,
    fontWeight: '700',
  },

  saveButton: {
    alignItems: 'center',
    backgroundColor: '#000000',
    borderRadius: 11,
    flex: 1,
    padding: 13,
  },

  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },

  // ==========================================
  // MODAL KONFIRMASI AKSI
  // ==========================================

  confirmBackdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
  },

  confirmCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 23,
    elevation: 10,
    gap: 13,
    maxWidth: 400,
    padding: 23,
    width: '100%',
  },

  confirmTitle: {
    color: '#000000',
    fontSize: 21,
    fontWeight: '800',
  },

  confirmDescription: {
    color: '#666666',
    fontSize: 13,
    lineHeight: 20,
  },

  confirmInfo: {
    backgroundColor: '#F4F4F5',
    borderRadius: 13,
    gap: 5,
    padding: 13,
  },

  confirmInfoName: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '800',
  },

  confirmInfoDetail: {
    color: '#777777',
    fontSize: 12,
  },

  confirmActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 5,
  },

  cancelConfirmButton: {
    alignItems: 'center',
    backgroundColor: '#EEEEEE',
    borderRadius: 11,
    flex: 1,
    justifyContent: 'center',
    paddingVertical: 14,
  },

  cancelConfirmText: {
    color: '#000000',
    fontSize: 13,
    fontWeight: '700',
  },

  confirmButton: {
    alignItems: 'center',
    backgroundColor: '#000000',
    borderRadius: 11,
    flex: 1,
    justifyContent: 'center',
    paddingVertical: 14,
  },

  confirmButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
});