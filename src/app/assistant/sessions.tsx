import { router } from 'expo-router';
import { useEffect, useState } from 'react';

import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import Svg, { Path } from 'react-native-svg';

import AssistantHeader from '@/components/common/AssistantHeader';

import { useAuth } from '@/context/AuthContext';

import { SessionTile } from '@/components/common/session-schedule';
import AttendanceStats from '@/features/assistant/components/attendance-stats';
import { NO_EXCUSED, useExcusedBySession } from '@/features/assistant/hooks/use-session-attendance';

import {
  subscribeSchedules,
  type PracticumSchedule,
} from '@/features/assistant/services/schedule-service';

import DateTimeField from '@/components/common/DateTimeField';
import Dropdown from '@/components/common/Dropdown';
import {
  closeSession,
  createSession,
  deleteSession,
  openSession,
  subscribeSessions,
  updateSession,
  type SessionInput,
  type SessionRecord,
} from '@/features/assistant/services/session-service';
import {
  combineDateAndTime,
  defaultSessionTimesFromSchedule,
  startOfDay,
  toClockTime,
} from '@/utils/session-time';

import { useTabBottomSpace } from '@/components/common/tab-screen';
import { FONT } from '@/constants/fonts';
import { useClassCodes } from '@/features/assistant/hooks/use-class-codes';
import {
  ensureDefaultLaboratories,
  isLaboratoryId,
  subscribeLaboratories,
  type LaboratoryLocation,
} from '@/features/assistant/services/laboratory-service';
import { withClassCode } from '@/features/assistant/utils/class-label';
import { IconButton, IconButtonRow } from '@/components/common/IconButton';
import { withNotificationNote } from '@/features/notifications/utils/dispatch-message';
import FramedTextInput from '@/components/common/FramedTextInput';
import { BORDER_COLOR, PAGE_BG } from '@/constants/colors';


// ==========================================
// FORM KOSONG
// ==========================================

interface SessionForm {
  scheduleId: string;
  labId: string;
  /** Modul/materi pertemuan ini (berbeda tiap sesi, tidak disalin dari jadwal). */
  moduleTitle: string;
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
    moduleTitle: '',
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

type SessionIconName = 'plus';

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
    </Svg>
  );
}

function TrashIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path d="M4 7H20M9 7V4.5H15V7M6.5 7L7.5 20H16.5L17.5 7M10 11V16M14 11V16" stroke="#E00000" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/** Jeda agar modal edit selesai tertutup sebelum modal konfirmasi hapus dibuka (iOS). */
const MODAL_SWAP_DELAY = 350;

// ==========================================
// HALAMAN MANAJEMEN SESI
// ==========================================

export default function AssistantSessionsScreen() {
  const bottomSpace = useTabBottomSpace(40);
  const insets = useSafeAreaInsets();
  // uid praktikan dengan izin diterima, per sesi (untuk kolom "Izin" di rekap).
  const excusedBySession = useExcusedBySession(true);
  const classCodes = useClassCodes();
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
      moduleTitle: '',
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
      moduleTitle: item.moduleTitle || '',
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

    if (!form.moduleTitle.trim()) {
      setModalError('Isi modul atau materi pertemuan ini.');
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
      moduleTitle: form.moduleTitle.trim(),
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
    const linkedLab = item.labId
      ? laboratories.find((lab) => lab.id === item.labId)
      : undefined;
    const baseLocation = linkedLab?.name || item.labName || item.classRoom || '-';
    const locationDisplay =
      linkedLab || item.labId ? baseLocation : `${baseLocation} (Belum ditautkan ke titik lab)`;

    const chip =
      item.status === 'dibuka'
        ? { label: 'Berlangsung', live: true }
        : item.status === 'ditutup'
          ? { label: 'Selesai', live: false }
          : { label: 'Belum dibuka', live: false };

    // Rekap kehadiran & pengajuan izin sesi ini; tersedia di semua status sesi.
    const openCheckAttendance = () =>
      router.push({
        pathname: '/assistant/session/[sessionId]',
        params: { sessionId: item.id },
      });

    return (
      <View style={styles.sessionItem}>
        <SessionTile
          session={{
            ...item,
            practicumName: withClassCode(item.practicumName, classCodes.get(item.classId)),
            classRoom: locationDisplay,
          }}
          chipLabel={chip.label}
          live={chip.live}
          showDate
          chipInCorner
        >
          {item.sessionNote ? (
            <Text style={styles.tileNote}>Catatan: {item.sessionNote}</Text>
          ) : null}

          {/* REKAP KEHADIRAN REAL-TIME */}
          <AttendanceStats
            sessionId={item.id}
            classId={item.classId}
            excusedUids={excusedBySession.get(item.id) ?? NO_EXCUSED}
          />

          {/* TOMBOL AKSI: pojok kanan bawah kartu */}
          <IconButtonRow>
            {item.status === 'dijadwalkan' ? (
              <>
                <IconButton icon="edit" label="Edit sesi" onPress={() => openEditModal(item)} />
              </>
            ) : null}

            <IconButton icon="attendance" label="Cek presensi" onPress={openCheckAttendance} />

            {item.status === 'dijadwalkan' ? (
              <IconButton
                icon="play"
                label="Buka sesi"
                tone="accent"
                onPress={() => openActionModal('open', item)}
              />
            ) : null}

            {item.status === 'dibuka' ? (
              <IconButton
                icon="stop"
                label="Tutup sesi"
                tone="danger"
                onPress={() => openActionModal('close', item)}
              />
            ) : null}
          </IconButtonRow>
        </SessionTile>
      </View>
    );
  }

  const isLoading = authLoading || loading;

  // ==========================================
  // PEMERIKSAAN AKSES
  // ==========================================

  if (authLoading) {
    return (
      <SafeAreaView style={styles.centered} edges={['top']}>
        <ActivityIndicator size="large" color="#111014" />

        <Text style={styles.mutedText}>
          Memeriksa akun...
        </Text>
      </SafeAreaView>
    );
  }

  if (!profile || profile.role !== 'asisten') {
    return (
      <SafeAreaView style={styles.centered} edges={['top']}>
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
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar barStyle="dark-content" />

      <FlatList
        data={sessions}
        keyExtractor={(item) => item.id}
        renderItem={renderSession}
        contentContainerStyle={[styles.content, { paddingBottom: bottomSpace }]}
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
                  Sesi & Presensi
                </Text>

                <Text style={styles.subtitle}>
                  Buat dan kelola sesi beserta presensi praktikan.
                </Text>
              </View>

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
                <Text style={styles.sectionTitle}>
                  Daftar Sesi
                </Text>

                {/* TOMBOL TAMBAH SESI */}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Tambah sesi"
                  style={({ pressed }) => [
                    styles.addButton,
                    pressed && styles.pressed,
                  ]}
                  onPress={openCreateModal}
                >
                  <SessionIcon name="plus" size={16} color="#FFFFFF" />
                  <Text style={styles.addButtonText}>Tambah Sesi</Text>
                </Pressable>
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
          behavior="padding"
        >
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={closeModal}
            disabled={saving}
          />

          <View
            style={[styles.modalContainer, { paddingBottom: Math.max(insets.bottom, 12) + 12 }]}
          >
            <ScrollView
              style={styles.modalScroll}
              contentContainerStyle={styles.modalScrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.modalHandle} />

              <View style={[styles.modalHeader, styles.modalHeaderRow]}>
                <Text style={styles.modalTitle}>
                  {editingId ? 'Edit Sesi' : 'Tambah Sesi'}
                </Text>

                {/* HAPUS SESI (hanya saat edit) */}
                {editingId ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Hapus sesi"
                    hitSlop={6}
                    disabled={saving}
                    style={({ pressed }) => [styles.modalDeleteButton, pressed && styles.pressed]}
                    onPress={() => {
                      const target = sessions.find((session) => session.id === editingId);
                      closeModal();
                      if (target) {
                        setTimeout(() => openActionModal('delete', target), MODAL_SWAP_DELAY);
                      }
                    }}
                  >
                    <TrashIcon />
                  </Pressable>
                ) : null}
              </View>

              {/* PILIH JADWAL */}
              <Text style={styles.label}>
                Pilih Jadwal Praktikum
              </Text>

              <Dropdown
                value={form.scheduleId}
                options={schedules.map((item) => ({
                  value: item.id,
                  label: item.practicumName,
                  detail: `${item.classRoom} | ${item.scheduleTime}`,
                }))}
                placeholder="Pilih jadwal praktikum"
                accessibilityLabel="Pilih jadwal praktikum"
                disabled={saving}
                onChange={(scheduleId) => {
                  const item = schedules.find((schedule) => schedule.id === scheduleId);
                  if (!item) return;

                  setForm((previous) => {
                    const matchedLabId =
                      !editingId && !labManuallySelected
                        ? findMatchingLaboratoryId(item.classRoom, laboratories) ||
                          previous.labId ||
                          (laboratories[0]?.id ?? '')
                        : previous.labId;

                    // Jam mulai & selesai otomatis dari jadwal (tetap bisa diubah di bawah).
                    // Sesi baru juga mendapat tanggal pertemuan terdekat sesuai hari jadwal;
                    // saat edit, tanggal yang sudah dipilih dipertahankan.
                    const fromSchedule = timesFromSchedule(item.scheduleTime);
                    const times = editingId
                      ? {
                          jamMulai: combineDateAndTime(previous.tanggal, toClockTime(fromSchedule.jamMulai)),
                          jamSelesai: combineDateAndTime(previous.tanggal, toClockTime(fromSchedule.jamSelesai)),
                        }
                      : fromSchedule;

                    return {
                      ...previous,
                      scheduleId: item.id,
                      labId: matchedLabId,
                      ...times,
                    };
                  });

                  setModalError('');
                }}
              />

              {/* MODUL / MATERI PERTEMUAN */}
              <Text style={styles.label}>
                Modul / Materi
              </Text>

              <FramedTextInput
                placeholder="Contoh: Modul 3: Regresi Linear"
                value={form.moduleTitle}
                onChangeText={(value) => {
                  setForm((previous) => ({
                    ...previous,
                    moduleTitle: value,
                  }));
                  setModalError('');
                }}
                editable={!saving}
              />

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
                <Dropdown
                  value={form.labId}
                  options={laboratories.map((lab) => ({
                    value: lab.id,
                    label: lab.name,
                    detail: `Radius presensi ${lab.radius} m`,
                  }))}
                  placeholder="Pilih lokasi laboratorium"
                  accessibilityLabel="Pilih lokasi laboratorium"
                  disabled={saving}
                  onChange={(labId) => {
                    setLabManuallySelected(true);
                    setForm((previous) => ({ ...previous, labId }));
                    setModalError('');
                  }}
                />
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

              <FramedTextInput
                placeholder="Contoh: Praktikan wajib membawa laptop."
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
                editable={!saving}
              />

            </ScrollView>

            {/* BAGIAN BAWAH TETAP: pesan error + Batal / Simpan */}
            <View style={styles.modalFooter}>
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
            </View>
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
                  actionTarget?.type !== 'open' && styles.confirmDanger,
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
    backgroundColor: PAGE_BG,
  },

  content: {
    paddingBottom: 40,
  },

  pageContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    gap: 16,
  },

  sessionItem: {
    paddingHorizontal: 20,
  },
  tileNote: {
    fontFamily: FONT.regular,
    color: '#FFFFFF',
    fontSize: 13,
    lineHeight: 18,
  },

  separator: {
    height: 12,
  },

  centered: {
    alignItems: 'center',
    backgroundColor: PAGE_BG,
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
    backgroundColor: '#F47321',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    minHeight: 40,
    paddingHorizontal: 16,
  },

  addButtonText: {
    fontFamily: FONT.bold,
    color: '#FFFFFF',
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
    gap: 12,
    justifyContent: 'space-between',
    marginBottom: 16,
    marginTop: 8,
  },


  sectionTitle: {
    fontFamily: FONT.extrabold,
    color: '#111014',
    fontSize: 19,
  },




  // KARTU SESI




  // STATUS SESI







  // DETAIL SESI




  // WAKTU SESI



  // REKAP KEHADIRAN


  // TOMBOL AKSI












  // KONDISI KOSONG
  emptyCard: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    marginHorizontal: 20,
    padding: 20,
    gap: 9,
    borderColor: BORDER_COLOR,
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
    backgroundColor: 'rgba(0,0,0,0.55)',
    flex: 1,
    justifyContent: 'flex-end',
  },

  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '92%',
    paddingHorizontal: 21,
    paddingTop: 12,
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

  modalHeaderRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  modalDeleteButton: {
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    borderColor: '#E00000',
    borderRadius: 10,
    borderWidth: 1,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  modalTitle: {
    fontFamily: FONT.extrabold,
    color: '#111014',
    fontSize: 21,
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
    borderColor: BORDER_COLOR,
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


  modalError: {
    fontFamily: FONT.regular,
    color: '#E00000',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 10,
  },

  // TOMBOL MODAL
  modalScroll: {
    // Bisa menyusut supaya bagian bawah (tombol) tetap terlihat.
    flexShrink: 1,
  },
  modalScrollContent: {
    paddingBottom: 16,
  },
  modalFooter: {
    borderTopColor: BORDER_COLOR,
    borderTopWidth: 1,
    gap: 10,
    marginHorizontal: -21,
    paddingHorizontal: 21,
    paddingTop: 12,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
  },

  cancelButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 11,
    flex: 1,
    padding: 13,
    borderColor: BORDER_COLOR,
    borderWidth: 1,
  },

  cancelButtonText: {
    fontFamily: FONT.bold,
    color: '#111014',
    fontSize: 13,
  },

  saveButton: {
    alignItems: 'center',
    backgroundColor: '#F47321',
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
    borderColor: BORDER_COLOR,
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
    borderColor: BORDER_COLOR,
    borderWidth: 1,
  },

  cancelConfirmText: {
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