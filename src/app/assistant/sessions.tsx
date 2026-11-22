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

import {
  ensureDefaultLaboratories,
  isLaboratoryId,
  subscribeLaboratories,
  type LaboratoryLocation,
} from '@/features/assistant/services/laboratory-service';
import { FONT } from '@/constants/fonts';
import { withNotificationNote } from '@/features/notifications/utils/dispatch-message';

// ==========================================
// FORM KOSONG
// ==========================================

interface SessionForm {
  scheduleId: string;
  labId: string;
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
    labId: '',
    sessionNote: '',
    ...timesFromSchedule(''),
  };
}

function findMatchingLaboratoryId(
  locationText: string | undefined,
  laboratories: LaboratoryLocation[],
): string {
  const normalized = locationText?.trim().toLowerCase() ?? '';
  if (!normalized) return '';

  const exactMatch = laboratories.find(
    (lab) => lab.name.toLowerCase() === normalized || lab.id === normalized,
  );
  if (exactMatch) return exactMatch.id;

  const partialMatch = laboratories.find((lab) =>
    normalized.includes(lab.name.toLowerCase()),
  );
  return partialMatch?.id ?? '';
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
  const [laboratories, setLaboratories] = useState<LaboratoryLocation[]>([]);

  // LOADING
  const [loading, setLoading] = useState(true);
  const [labsLoading, setLabsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [processingAction, setProcessingAction] = useState(false);

  // ERROR DAN NOTIFIKASI
  const [error, setError] = useState('');
  const [labsError, setLabsError] = useState('');
  const [labRetryNonce, setLabRetryNonce] = useState(0);
  const [pageMessage, setPageMessage] = useState('');
  const [modalError, setModalError] = useState('');
  const [actionError, setActionError] = useState('');

  // MODAL TAMBAH / EDIT
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingLegacyWithoutLab, setEditingLegacyWithoutLab] = useState(false);
  const [labManuallySelected, setLabManuallySelected] = useState(false);

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
  // MENGAMBIL LOKASI LABORATORIUM REAL-TIME
  // ==========================================

  useEffect(() => {
    if (authLoading) return;

    if (!profile || profile.role !== 'asisten') {
      setLaboratories([]);
      setLabsLoading(false);
      return;
    }

    let active = true;
    let seeding = true;
    setLabsLoading(true);
    setLabsError('');

    const unsubscribeLaboratories = subscribeLaboratories(
      (data) => {
        if (!active) return;
        setLaboratories(data);
        if (!seeding || data.length > 0) {
          setLabsLoading(false);
        }
      },
      (firebaseError) => {
        if (!active) return;
        setLabsError(firebaseError.message);
        setLabsLoading(false);
      },
    );

    ensureDefaultLaboratories()
      .then(() => {
        if (!active) return;
        seeding = false;
        setLabsLoading(false);
      })
      .catch((seedError: unknown) => {
        if (!active) return;
        seeding = false;
        setLabsLoading(false);
        setLabsError(
          seedError instanceof Error
            ? seedError.message
            : 'Gagal memuat daftar lokasi laboratorium.',
        );
      });

    return () => {
      active = false;
      unsubscribeLaboratories();
    };
  }, [profile, authLoading, labRetryNonce]);

  useEffect(() => {
    if (
      !modalVisible ||
      editingId ||
      labManuallySelected ||
      form.labId ||
      laboratories.length === 0
    ) {
      return;
    }

    const selectedSchedule = schedules.find(
      (item) => item.id === form.scheduleId,
    );
    const matchedLabId = findMatchingLaboratoryId(
      selectedSchedule?.classRoom,
      laboratories,
    );

    setForm((previous) =>
      previous.labId
        ? previous
        : {
            ...previous,
            labId: matchedLabId || laboratories[0].id,
          },
    );
  }, [
    modalVisible,
    editingId,
    labManuallySelected,
    form.labId,
    form.scheduleId,
    laboratories,
    schedules,
  ]);

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

    const firstSchedule = schedules[0];
    const matchedLabId = findMatchingLaboratoryId(
      firstSchedule.classRoom,
      laboratories,
    );

    setEditingId(null);
    setEditingLegacyWithoutLab(false);
    setLabManuallySelected(false);

    setForm({
      scheduleId: firstSchedule.id,
      labId: matchedLabId || (laboratories[0]?.id ?? ''),
      sessionNote: '',
      ...timesFromSchedule(firstSchedule.scheduleTime),
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

    const hasStoredLab = Boolean(item.labId && isLaboratoryId(item.labId));
    const resolvedLabId = hasStoredLab
      ? (item.labId as string)
      : findMatchingLaboratoryId(item.labName ?? item.classRoom, laboratories);

    setEditingId(item.id);
    setEditingLegacyWithoutLab(!hasStoredLab);
    setLabManuallySelected(true);

    const linkedSchedule = schedules.find(
      (schedule) => schedule.id === item.scheduleId,
    );

    setForm({
      scheduleId: item.scheduleId,
      labId: resolvedLabId,
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
    setEditingLegacyWithoutLab(false);
    setLabManuallySelected(false);
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

    const selectedLab = laboratories.find((lab) => lab.id === form.labId);
    if (!selectedLab || !isLaboratoryId(selectedLab.id)) {
      setModalError('Pilih lokasi laboratorium terlebih dahulu.');
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
      labId: selectedLab.id,
      labName: selectedLab.name,
      practicumName: selectedSchedule.practicumName,
      moduleTitle: selectedSchedule.moduleTitle,
      classRoom: selectedLab.name,
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
        const notifyResult = await updateSession(editingId, input);
        setPageMessage(withNotificationNote('Sesi berhasil diperbarui.', notifyResult));
      } else {
        await createSession(input, profile.uid);
        setPageMessage('Sesi berhasil ditambahkan.');
      }

      setModalVisible(false);
      setEditingId(null);
      setEditingLegacyWithoutLab(false);
      setLabManuallySelected(false);
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
        const notifyResult = await openSession(item.id);
        setPageMessage(withNotificationNote('Sesi praktikum berhasil dibuka.', notifyResult));
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

    const linkedLab = item.labId
      ? laboratories.find((lab) => lab.id === item.labId)
      : undefined;
    const baseLocation = linkedLab?.name || item.labName || item.classRoom || '-';
    const locationDisplay = linkedLab
      ? `${baseLocation} (Radius ${linkedLab.radius} m)`
      : item.labId
        ? baseLocation
        : `${baseLocation} (Belum ditautkan ke titik lab)`;

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

                <Text
                  style={[
                    styles.statusText,
                    item.status !== 'dijadwalkan' && styles.statusTextOnColor,
                  ]}
                >
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
                Lokasi Laboratorium
              </Text>

              <Text style={styles.detailValue}>
                {locationDisplay}
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
        <ActivityIndicator size="large" color="#111014" />

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
      <StatusBar barStyle="dark-content" />

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
                  color="#111014"
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
                    color="#111014"
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
                        setForm((previous) => {
                          const matchedLabId =
                            !editingId && !labManuallySelected
                              ? findMatchingLaboratoryId(
                                  item.classRoom,
                                  laboratories,
                                ) ||
                                previous.labId ||
                                (laboratories[0]?.id ?? '')
                              : previous.labId;

                          return {
                            ...previous,
                            scheduleId: item.id,
                            labId: matchedLabId,
                            // Saat membuat sesi baru, isi otomatis tanggal & jam dari jadwal.
                            ...(editingId ? {} : timesFromSchedule(item.scheduleTime)),
                          };
                        });

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
                              color="#111014"
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

              {/* PILIH LOKASI LABORATORIUM */}
              <Text style={styles.label}>
                Pilih Lokasi Laboratorium
              </Text>

              {editingLegacyWithoutLab ? (
                <View style={styles.legacyLabNotice}>
                  <Text style={styles.legacyLabNoticeText}>
                    Sesi ini belum memiliki referensi titik lab. Pilih salah
                    satu lokasi laboratorium di bawah sebelum menyimpan.
                  </Text>
                </View>
              ) : null}

              {labsLoading && laboratories.length === 0 ? (
                <View style={styles.labStateBox}>
                  <ActivityIndicator size="small" color="#111014" />
                  <Text style={styles.labStateText}>
                    Memuat 4 lokasi laboratorium...
                  </Text>
                </View>
              ) : labsError && laboratories.length === 0 ? (
                <View style={styles.labErrorBox}>
                  <Text style={styles.labErrorText}>{labsError}</Text>
                  <Pressable
                    style={({ pressed }) => [
                      styles.labRetryButton,
                      pressed && styles.pressed,
                    ]}
                    onPress={() => setLabRetryNonce((prev) => prev + 1)}
                    disabled={saving}
                  >
                    <Text style={styles.labRetryButtonText}>
                      Muat Ulang Lokasi
                    </Text>
                  </Pressable>
                </View>
              ) : (
                <View style={styles.scheduleOptions}>
                  {laboratories.map((lab) => {
                    const selected = form.labId === lab.id;

                    return (
                      <Pressable
                        key={lab.id}
                        style={({ pressed }) => [
                          styles.scheduleOption,
                          selected && styles.scheduleOptionSelected,
                          pressed && styles.pressed,
                        ]}
                        onPress={() => {
                          setLabManuallySelected(true);
                          setForm((previous) => ({
                            ...previous,
                            labId: lab.id,
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
                            {lab.name}
                          </Text>

                          {selected ? (
                            <View style={styles.selectedMark}>
                              <SessionIcon
                                name="check"
                                size={17}
                                color="#111014"
                              />
                            </View>
                          ) : null}
                        </View>

                        <Text style={styles.scheduleOptionDetail}>
                          Radius {lab.radius} m · {lab.latitude.toFixed(5)},{' '}
                          {lab.longitude.toFixed(5)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}

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
                placeholderTextColor="#8E8E93"
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
    backgroundColor: '#FFFFFF',
    borderColor: '#8E8E93',
    borderWidth: 1,
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
    fontFamily: FONT.extrabold,
    color: '#111014',
    fontSize: 27,
  },

  subtitle: {
    fontFamily: FONT.regular,
    color: '#5F5F66',
    fontSize: 13,
    lineHeight: 20,
  },

  // TOMBOL TAMBAH
  addButton: {
    alignItems: 'center',
    backgroundColor: '#111014',
    borderRadius: 14,
    flexDirection: 'row',
    gap: 9,
    justifyContent: 'center',
    paddingVertical: 16,
  },

  addButtonText: {
    fontFamily: FONT.bold,
    color: '#FFFFFF',
    fontSize: 14,
  },

  pressed: {
    opacity: 0.65,
  },

  disabledButton: {
    opacity: 0.5,
  },

  // NOTIFIKASI
  successBox: {
    backgroundColor: '#F47321',
    borderRadius: 11,
    padding: 12,
  },

  successText: {
    fontFamily: FONT.regular,
    color: '#FFFFFF',
    fontSize: 12,
    lineHeight: 18,
  },

  errorBox: {
    backgroundColor: '#E00000',
    borderRadius: 11,
    padding: 12,
  },

  errorText: {
    fontFamily: FONT.regular,
    color: '#FFFFFF',
    fontSize: 12,
    lineHeight: 18,
  },

  mutedText: {
    fontFamily: FONT.regular,
    color: '#5F5F66',
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
    fontFamily: FONT.extrabold,
    color: '#111014',
    fontSize: 19,
  },

  sectionCaption: {
    fontFamily: FONT.regular,
    color: '#5F5F66',
    fontSize: 11,
    lineHeight: 17,
    paddingBottom: 10,
  },

  totalBadge: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderColor: '#8E8E93',
    borderWidth: 1,
  },

  totalText: {
    fontFamily: FONT.bold,
    color: '#5F5F66',
    fontSize: 12,
  },

  // KARTU SESI
  card: {
    backgroundColor: '#FFFFFF',
    borderColor: '#8E8E93',
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
    fontFamily: FONT.extrabold,
    color: '#111014',
    fontSize: 17,
    lineHeight: 23,
  },

  // STATUS SESI
  statusBadge: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderColor: '#8E8E93',
    borderWidth: 1,
  },

  openBadge: {
    backgroundColor: '#F47321',
    borderColor: '#F47321',
    borderWidth: 1,
  },

  closedBadge: {
    backgroundColor: '#111014',
    borderColor: '#111014',
    borderWidth: 1,
  },

  statusDot: {
    backgroundColor: '#8E8E93',
    borderRadius: 4,
    height: 7,
    width: 7,
  },

  openDot: {
    backgroundColor: '#FFFFFF',
  },

  closedDot: {
    backgroundColor: '#FFFFFF',
  },

  statusText: {
    fontFamily: FONT.extrabold,
    color: '#5F5F66',
    fontSize: 10,
    letterSpacing: 0.3,
  },
  statusTextOnColor: {
    color: '#FFFFFF',
  },

  // DETAIL SESI
  detailGroup: {
    gap: 11,
  },

  detailRow: {
    gap: 3,
  },

  detailLabel: {
    fontFamily: FONT.semibold,
    color: '#5F5F66',
    fontSize: 11,
  },

  detailValue: {
    fontFamily: FONT.regular,
    color: '#5F5F66',
    fontSize: 13,
    lineHeight: 19,
  },

  // WAKTU SESI
  timeBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 13,
    gap: 5,
    borderColor: '#8E8E93',
    borderWidth: 1,
  },

  timeLabel: {
    fontFamily: FONT.extrabold,
    color: '#5F5F66',
    fontSize: 10,
    letterSpacing: 0.5,
  },

  timeValue: {
    fontFamily: FONT.extrabold,
    color: '#111014',
    fontSize: 14,
  },

  // REKAP KEHADIRAN
  recapContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 13,
    gap: 10,
    borderColor: '#8E8E93',
    borderWidth: 1,
  },

  recapTitle: {
    fontFamily: FONT.extrabold,
    color: '#111014',
    fontSize: 14,
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
    borderColor: '#8E8E93',
    borderRadius: 10,
    borderWidth: 1,
    flex: 1,
    padding: 11,
  },

  editButtonText: {
    fontFamily: FONT.bold,
    color: '#111014',
    fontSize: 13,
  },

  deleteButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    flex: 1,
    padding: 11,
    borderColor: '#8E8E93',
    borderWidth: 1,
  },

  deleteButtonText: {
    fontFamily: FONT.bold,
    color: '#5F5F66',
    fontSize: 13,
  },

  openButton: {
    alignItems: 'center',
    backgroundColor: '#111014',
    borderRadius: 11,
    padding: 14,
  },

  openButtonText: {
    fontFamily: FONT.bold,
    color: '#FFFFFF',
    fontSize: 13,
  },

  closeButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 11,
    padding: 14,
    borderColor: '#8E8E93',
    borderWidth: 1,
  },

  closeButtonText: {
    fontFamily: FONT.bold,
    color: '#111014',
    fontSize: 13,
  },

  lockedBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 12,
    borderColor: '#8E8E93',
    borderWidth: 1,
  },

  lockedText: {
    fontFamily: FONT.regular,
    color: '#5F5F66',
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },

  // KONDISI KOSONG
  emptyCard: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    marginHorizontal: 20,
    padding: 25,
    gap: 9,
    borderColor: '#8E8E93',
    borderWidth: 1,
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
    fontFamily: FONT.extrabold,
    color: '#111014',
    fontSize: 16,
  },

  emptyText: {
    fontFamily: FONT.regular,
    color: '#5F5F66',
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
    backgroundColor: '#8E8E93',
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
    fontFamily: FONT.extrabold,
    color: '#111014',
    fontSize: 21,
  },

  modalSubtitle: {
    fontFamily: FONT.regular,
    color: '#5F5F66',
    fontSize: 12,
    lineHeight: 19,
  },

  // PILIH JADWAL
  label: {
    fontFamily: FONT.bold,
    color: '#111014',
    fontSize: 13,
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
    fontFamily: FONT.regular,
    color: '#5F5F66',
    fontSize: 11,
  },

  scheduleOptions: {
    gap: 9,
  },

  scheduleOption: {
    backgroundColor: '#FFFFFF',
    borderColor: '#8E8E93',
    borderRadius: 12,
    borderWidth: 1,
    padding: 13,
    gap: 5,
  },

  scheduleOptionSelected: {
    backgroundColor: '#FFFFFF',
    borderColor: '#111014',
    borderWidth: 2,
  },

  scheduleOptionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },

  scheduleOptionTitle: {
    fontFamily: FONT.bold,
    color: '#5F5F66',
    flex: 1,
    fontSize: 14,
  },

  scheduleOptionTitleSelected: {
    color: '#111014',
  },

  scheduleOptionDetail: {
    fontFamily: FONT.regular,
    color: '#5F5F66',
    fontSize: 12,
    lineHeight: 18,
  },

  selectedMark: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  legacyLabNotice: {
    backgroundColor: '#E00000',
    borderRadius: 10,
    marginBottom: 9,
    padding: 11,
  },

  legacyLabNoticeText: {
    fontFamily: FONT.regular,
    color: '#FFFFFF',
    fontSize: 12,
    lineHeight: 17,
  },

  labStateBox: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    flexDirection: 'row',
    gap: 10,
    padding: 14,
    borderColor: '#8E8E93',
    borderWidth: 1,
  },

  labStateText: {
    fontFamily: FONT.regular,
    color: '#5F5F66',
    fontSize: 12,
  },

  labErrorBox: {
    backgroundColor: '#E00000',
    borderRadius: 12,
    gap: 9,
    padding: 12,
  },

  labErrorText: {
    fontFamily: FONT.regular,
    color: '#FFFFFF',
    fontSize: 12,
    lineHeight: 17,
  },

  labRetryButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },

  labRetryButtonText: {
    fontFamily: FONT.bold,
    color: '#111014',
    fontSize: 12,
  },

  // INPUT
  input: {
    fontFamily: FONT.regular,
    backgroundColor: '#FFFFFF',
    borderColor: '#8E8E93',
    borderRadius: 11,
    borderWidth: 1,
    color: '#111014',
    fontSize: 14,
    minHeight: 90,
    paddingHorizontal: 12,
    paddingVertical: 13,
  },

  modalError: {
    fontFamily: FONT.regular,
    color: '#E00000',
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
    backgroundColor: '#FFFFFF',
    borderRadius: 11,
    flex: 1,
    padding: 13,
    borderColor: '#8E8E93',
    borderWidth: 1,
  },

  cancelButtonText: {
    fontFamily: FONT.bold,
    color: '#111014',
    fontSize: 13,
  },

  saveButton: {
    alignItems: 'center',
    backgroundColor: '#111014',
    borderRadius: 11,
    flex: 1,
    padding: 13,
  },

  saveButtonText: {
    fontFamily: FONT.bold,
    color: '#FFFFFF',
    fontSize: 13,
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
    fontFamily: FONT.extrabold,
    color: '#111014',
    fontSize: 21,
  },

  confirmDescription: {
    fontFamily: FONT.regular,
    color: '#5F5F66',
    fontSize: 13,
    lineHeight: 20,
  },

  confirmInfo: {
    backgroundColor: '#FFFFFF',
    borderRadius: 13,
    gap: 5,
    padding: 13,
    borderColor: '#8E8E93',
    borderWidth: 1,
  },

  confirmInfoName: {
    fontFamily: FONT.extrabold,
    color: '#111014',
    fontSize: 14,
  },

  confirmInfoDetail: {
    fontFamily: FONT.regular,
    color: '#5F5F66',
    fontSize: 12,
  },

  confirmActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 5,
  },

  cancelConfirmButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 11,
    flex: 1,
    justifyContent: 'center',
    paddingVertical: 14,
    borderColor: '#8E8E93',
    borderWidth: 1,
  },

  cancelConfirmText: {
    fontFamily: FONT.bold,
    color: '#111014',
    fontSize: 13,
  },

  confirmButton: {
    alignItems: 'center',
    backgroundColor: '#111014',
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