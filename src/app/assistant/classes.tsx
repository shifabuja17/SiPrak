import { router } from 'expo-router';
import { useEffect, useState } from 'react';

import {
  ActivityIndicator,
  KeyboardAvoidingView,
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

import AssistantHeader from '@/components/common/AssistantHeader';

import { useAuth } from '@/context/AuthContext';
import { isAssistantRole } from '@/types/user';

import DateTimeField from '@/components/common/DateTimeField';
import Dropdown from '@/components/common/Dropdown';
import { useTabBottomSpace } from '@/components/common/tab-screen';
import { FONT } from '@/constants/fonts';
import {
  createClass,
  deleteClass,
  subscribeClasses,
  updateClass,
  type ClassInput,
  type PracticumClass,
} from '@/features/assistant/services/class-service';
import {
  subscribeLaboratories,
  type LaboratoryLocation,
} from '@/features/assistant/services/laboratory-service';
import {
  createSchedule,
  subscribeSchedules,
  updateSchedule,
  type PracticumSchedule,
} from '@/features/assistant/services/schedule-service';
import { classLabel } from '@/features/assistant/utils/class-label';
import { MetaLine } from '@/features/praktikan/ui/praktikan-ui';
import { formatClock, parseScheduleTimeText } from '@/utils/session-time';
import Svg, { Path } from 'react-native-svg';
import { IconButton, IconButtonRow } from '@/components/common/IconButton';
import { withNotificationNote } from '@/features/notifications/utils/dispatch-message';

// Form kosong untuk tambah kelas.
const EMPTY_FORM: ClassInput = {
  nama: '',
  kode: '',
  deskripsi: '',
};

/** Hari praktikum (indeks mengikuti Date.getDay: 0 = Minggu). */
const DAY_OPTIONS = [
  { value: '1', label: 'Senin' },
  { value: '2', label: 'Selasa' },
  { value: '3', label: 'Rabu' },
  { value: '4', label: 'Kamis' },
  { value: '5', label: 'Jumat' },
  { value: '6', label: 'Sabtu' },
  { value: '0', label: 'Minggu' },
];

/** Jadwal tetap kelas: lab, hari, serta jam mulai & selesai. */
interface ScheduleForm {
  labId: string;
  day: string;
  jamMulai: Date;
  jamSelesai: Date;
}

function clock(hours: number, minutes: number): Date {
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date;
}

function emptyScheduleForm(): ScheduleForm {
  return { labId: '', day: '1', jamMulai: clock(7, 0), jamSelesai: clock(9, 0) };
}

/** "Senin, 07.00 - 09.00 WIB" (format yang juga dibaca form sesi). */
function formatScheduleTime(form: ScheduleForm): string {
  const day = DAY_OPTIONS.find((option) => option.value === form.day)?.label ?? '';
  return `${day}, ${formatClock(form.jamMulai)} - ${formatClock(form.jamSelesai)} WIB`;
}

function minutesOf(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
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

function PlusIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Path d="M12 5V19M5 12H19" stroke="#FFFFFF" strokeWidth={2.2} strokeLinecap="round" />
    </Svg>
  );
}

export default function AssistantClassesScreen() {
  const bottomSpace = useTabBottomSpace(40);
  const { profile, loading: authLoading } = useAuth();

  const [classes, setClasses] = useState<PracticumClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pageMessage, setPageMessage] = useState('');

  const [modalVisible, setModalVisible] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState<ClassInput>(EMPTY_FORM);
  const [scheduleForm, setScheduleForm] = useState<ScheduleForm>(emptyScheduleForm);
  const [schedules, setSchedules] = useState<PracticumSchedule[]>([]);
  const [laboratories, setLaboratories] = useState<LaboratoryLocation[]>([]);
  const [editingClass, setEditingClass] =
    useState<PracticumClass | null>(null);

  // State untuk modal konfirmasi hapus.
  const [deleteTarget, setDeleteTarget] =
    useState<PracticumClass | null>(null);

  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  // ==========================================
  // MENGAMBIL DATA KELAS REAL-TIME
  // ==========================================

  useEffect(() => {
    if (authLoading) return;

    if (!profile || !isAssistantRole(profile.role)) {
      setClasses([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    const unsubscribe = subscribeClasses(
      (data) => {
        setClasses(data);
        setLoading(false);
        setError('');
      },
      (firebaseError) => {
        setError(firebaseError.message);
        setLoading(false);
      }
    );

    // Jadwal tetap tiap kelas & 4 titik lab untuk pilihan lokasi.
    const unsubscribeSchedules = subscribeSchedules(setSchedules, (firebaseError) =>
      setError(firebaseError.message),
    );
    const unsubscribeLabs = subscribeLaboratories(setLaboratories, (firebaseError) =>
      setError(firebaseError.message),
    );

    return () => {
      unsubscribe();
      unsubscribeSchedules();
      unsubscribeLabs();
    };
  }, [profile, authLoading]);

  /** Satu kelas praktikum hanya memakai satu jadwal tetap. */
  function scheduleOf(classId: string): PracticumSchedule | undefined {
    return schedules.find((item) => item.classId === classId);
  }

  // ==========================================
  // FORM TAMBAH KELAS
  // ==========================================

  function openCreateForm() {
    setEditingClass(null);
    setForm(EMPTY_FORM);
    setScheduleForm(emptyScheduleForm());
    setError('');
    setPageMessage('');
    setModalVisible(true);
  }

  // ==========================================
  // FORM EDIT KELAS
  // ==========================================

  function openEditForm(item: PracticumClass) {
    setEditingClass(item);

    setForm({
      nama: item.nama,
      kode: item.kode,
      deskripsi: item.deskripsi,
    });

    // Isi jadwal dari data yang ada (teks seperti "Senin, 07.00 - 09.00 WIB").
    const schedule = scheduleOf(item.id);
    const parsed = parseScheduleTimeText(schedule?.scheduleTime ?? '');
    const room = schedule?.classRoom.trim().toLowerCase() ?? '';
    const defaults = emptyScheduleForm();
    setScheduleForm({
      labId: laboratories.find((lab) => lab.name.toLowerCase() === room)?.id ?? '',
      day: parsed.dayIndex !== null ? String(parsed.dayIndex) : defaults.day,
      jamMulai: parsed.start ? clock(parsed.start.hours, parsed.start.minutes) : defaults.jamMulai,
      jamSelesai: parsed.end ? clock(parsed.end.hours, parsed.end.minutes) : defaults.jamSelesai,
    });

    setError('');
    setModalVisible(true);
  }

  // ==========================================
  // MENUTUP MODAL TAMBAH / EDIT
  // ==========================================

  function closeModal() {
    if (saving) return;

    setModalVisible(false);
    setError('');
  }

  // ==========================================
  // MENYIMPAN DATA KELAS
  // ==========================================

  async function handleSave() {
    if (!profile) return;

    const lab = laboratories.find((item) => item.id === scheduleForm.labId);
    if (!lab) {
      setError('Pilih lokasi lab praktikum.');
      return;
    }
    if (minutesOf(scheduleForm.jamSelesai) <= minutesOf(scheduleForm.jamMulai)) {
      setError('Jam selesai harus setelah jam mulai.');
      return;
    }

    try {
      setSaving(true);
      setError('');

      let classId: string;
      if (editingClass) {
        await updateClass(editingClass.id, form);
        classId = editingClass.id;
      } else {
        classId = await createClass(form, profile.uid);
      }

      // Jadwal tetap kelas disimpan bersamaan dengan data kelas.
      const scheduleInput = {
        classId,
        practicumName: classLabel(form),
        classRoom: lab.name,
        scheduleTime: formatScheduleTime(scheduleForm),
      };
      const existing = scheduleOf(classId);
      if (existing) {
        // FR-20: praktikan kelas ini diberi tahu bila jadwal berubah.
        const notifyResult = await updateSchedule(existing.id, scheduleInput);
        setPageMessage(withNotificationNote('Kelas dan jadwal berhasil diperbarui.', notifyResult));
      } else {
        await createSchedule(scheduleInput, profile.uid);
        setPageMessage('Kelas berhasil ditambahkan.');
      }

      setModalVisible(false);
      setForm(EMPTY_FORM);
      setEditingClass(null);

    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Gagal menyimpan data kelas.'
      );
    } finally {
      setSaving(false);
    }
  }

  // ==========================================
  // MODAL KONFIRMASI HAPUS KELAS
  // ==========================================

  function handleDelete(item: PracticumClass) {
    setDeleteError('');
    setDeleteTarget(item);
  }

  function closeDeleteModal() {
    if (deleting) return;

    setDeleteTarget(null);
    setDeleteError('');
  }

  // ==========================================
  // PROSES HAPUS KELAS
  // ==========================================

  async function confirmDelete() {
    if (!deleteTarget) return;

    try {
      setDeleting(true);
      setDeleteError('');

      await deleteClass(deleteTarget.id);

      setDeleteTarget(null);
      setDeleteError('');

    } catch (err) {
      setDeleteError(
        err instanceof Error
          ? err.message
          : 'Gagal menghapus data kelas.'
      );
    } finally {
      setDeleting(false);
    }
  }

  // ==========================================
  // PEMERIKSAAN AUTENTIKASI
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

  if (!profile) {
    return (
      <SafeAreaView style={styles.centered} edges={['top']}>
        <Text style={styles.emptyTitle}>
          Belum Login
        </Text>

        <Text style={styles.mutedText}>
          Silakan login terlebih dahulu untuk mengelola kelas.
        </Text>
      </SafeAreaView>
    );
  }

  if (!isAssistantRole(profile.role)) {
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
  // TAMPILAN MANAJEMEN KELAS
  // ==========================================

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar
        barStyle="dark-content"
      />

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: bottomSpace }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >

        {/* HEADER SIPRAK */}
        <AssistantHeader />

        <View style={styles.pageContent}>

          {/* JUDUL HALAMAN */}
          <View style={styles.header}>
            <Text style={styles.title}>
              Praktikum & Peserta
            </Text>

            <Text style={styles.subtitle}>
              Kelola kelas praktikum, jadwal, dan pesertanya.
            </Text>
          </View>

          {/* PESAN BERHASIL (+ status notifikasi perubahan jadwal) */}
          {pageMessage ? (
            <View style={styles.successBox}>
              <Text style={styles.successText}>{pageMessage}</Text>
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

          {/* HEADER DAFTAR KELAS + TOMBOL TAMBAH (sama dengan Sesi & Presensi) */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              Daftar Kelas
            </Text>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Tambah kelas"
              style={({ pressed }) => [
                styles.addButton,
                pressed && styles.pressed,
              ]}
              onPress={openCreateForm}
            >
              <PlusIcon />
              <Text style={styles.addButtonText}>Tambah Kelas</Text>
            </Pressable>
          </View>

          {/* KONDISI LOADING */}
          {loading ? (
            <View style={styles.centeredContent}>
              <ActivityIndicator
                size="large"
                color="#111014"
              />

              <Text style={styles.mutedText}>
                Memuat data kelas...
              </Text>
            </View>

          ) : classes.length === 0 ? (

            /* KONDISI KELAS KOSONG */
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>
                Belum Ada Kelas
              </Text>

              <Text style={styles.mutedText}>
                Tambahkan kelas praktikum pertama untuk mulai
                mengelola peserta dan jadwal.
              </Text>
            </View>

          ) : (

            /* DAFTAR DATA KELAS */
            classes.map((item) => (
              <View key={item.id} style={styles.classCard}>
                <View style={styles.classInfo}>
                  <Text style={styles.className}>
                    {classLabel(item)}
                  </Text>

                  {item.deskripsi ? (
                    <Text style={styles.classDescription}>{item.deskripsi}</Text>
                  ) : null}
                </View>

                {/* JADWAL TETAP KELAS */}
                {scheduleOf(item.id) ? (
                  <View style={styles.classMeta}>
                    <MetaLine icon="time" textStyle={styles.classMetaText}>
                      {scheduleOf(item.id)!.scheduleTime}
                    </MetaLine>
                    <MetaLine icon="place" textStyle={styles.classMetaText}>
                      {scheduleOf(item.id)!.classRoom}
                    </MetaLine>
                  </View>
                ) : (
                  <Text style={styles.classMetaText}>
                    Jadwal belum diatur. Tekan Edit untuk menentukan lab, hari, dan jam.
                  </Text>
                )}

                {/* TOMBOL AKSI: pojok kanan bawah kartu */}
                <IconButtonRow>
                  <IconButton icon="edit" label="Edit kelas" onPress={() => openEditForm(item)} />
                  <IconButton
                    icon="people"
                    label="Kelola peserta"
                    tone="accent"
                    onPress={() =>
                      router.push({
                        pathname: '/assistant/class-members/[classId]',
                        params: { classId: item.id },
                      })
                    }
                  />
                </IconButtonRow>
              </View>
            ))
          )}

        </View>
      </ScrollView>

      {/* =====================================
          MODAL TAMBAH DAN EDIT KELAS
      ===================================== */}

      <Modal
        animationType="slide"
        transparent
        visible={modalVisible}
        onRequestClose={closeModal}
      >
        <KeyboardAvoidingView
          style={styles.modalKeyboard}
          behavior="padding"
        >
          <View style={styles.modalBackdrop}>
            <ScrollView
              contentContainerStyle={styles.modalScrollContent}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              showsVerticalScrollIndicator={false}
              bounces={false}
            >
              <View style={styles.modalCard}>

                {/* JUDUL MODAL */}
                <View style={[styles.modalHeader, styles.modalHeaderRow]}>
                  <Text style={styles.modalTitle}>
                    {editingClass ? 'Edit Kelas' : 'Tambah Kelas'}
                  </Text>

                  {/* HAPUS KELAS (hanya saat edit) */}
                  {editingClass ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Hapus kelas"
                      hitSlop={6}
                      disabled={saving}
                      style={({ pressed }) => [styles.modalDeleteButton, pressed && styles.pressed]}
                      onPress={() => {
                        const target = editingClass;
                        closeModal();
                        setTimeout(() => handleDelete(target), MODAL_SWAP_DELAY);
                      }}
                    >
                      <TrashIcon />
                    </Pressable>
                  ) : null}
                </View>

                {/* INPUT NAMA KELAS */}
                <Text style={styles.inputLabel}>
                  Nama Praktikum
                </Text>

                <TextInput
                  value={form.nama}
                  onChangeText={(value) =>
                    setForm((previous) => ({
                      ...previous,
                      nama: value,
                    }))
                  }
                  placeholder="Contoh: Praktikum Sistem Operasi"
                  placeholderTextColor="#8E8E93"
                  style={styles.input}
                  editable={!saving}
                  maxLength={100}
                  returnKeyType="next"
                  blurOnSubmit={false}
                />

                {/* INPUT KODE KELAS */}
                <Text style={styles.inputLabel}>
                  Kelas
                </Text>

                <TextInput
                  value={form.kode}
                  onChangeText={(value) =>
                    setForm((previous) => ({
                      ...previous,
                      kode: value.toUpperCase(),
                    }))
                  }
                  placeholder="Contoh: E1"
                  placeholderTextColor="#8E8E93"
                  style={styles.input}
                  editable={!saving}
                  autoCapitalize="characters"
                  maxLength={20}
                  returnKeyType="next"
                  blurOnSubmit={false}
                />

                {/* INPUT DESKRIPSI */}
                <Text style={styles.inputLabel}>
                  Deskripsi
                </Text>

                <TextInput
                  value={form.deskripsi}
                  onChangeText={(value) =>
                    setForm((previous) => ({
                      ...previous,
                      deskripsi: value,
                    }))
                  }
                  placeholder="Keterangan kelas (opsional)"
                  placeholderTextColor="#8E8E93"
                  style={[
                    styles.input,
                    styles.descriptionInput,
                  ]}
                  multiline
                  textAlignVertical="top"
                  editable={!saving}
                  maxLength={300}
                />

                {/* JADWAL TETAP: LAB, HARI, JAM */}
                <Text style={styles.inputLabel}>
                  Lokasi Lab
                </Text>

                <Dropdown
                  value={scheduleForm.labId}
                  options={laboratories.map((lab) => ({ value: lab.id, label: lab.name }))}
                  placeholder="Pilih lokasi lab"
                  accessibilityLabel="Pilih lokasi lab"
                  disabled={saving}
                  onChange={(labId) => {
                    setScheduleForm((previous) => ({ ...previous, labId }));
                    setError('');
                  }}
                />

                <Text style={styles.inputLabel}>
                  Hari
                </Text>

                <Dropdown
                  value={scheduleForm.day}
                  options={DAY_OPTIONS}
                  accessibilityLabel="Pilih hari praktikum"
                  disabled={saving}
                  onChange={(day) => {
                    setScheduleForm((previous) => ({ ...previous, day }));
                    setError('');
                  }}
                />

                <View style={styles.timeRow}>
                  <View style={styles.timeColumn}>
                    <Text style={styles.inputLabel}>
                      Jam Mulai
                    </Text>
                    <DateTimeField
                      mode="time"
                      value={scheduleForm.jamMulai}
                      disabled={saving}
                      accessibilityLabel="Jam mulai"
                      onChange={(jamMulai) => {
                        setScheduleForm((previous) => ({ ...previous, jamMulai }));
                        setError('');
                      }}
                    />
                  </View>

                  <View style={styles.timeColumn}>
                    <Text style={styles.inputLabel}>
                      Jam Selesai
                    </Text>
                    <DateTimeField
                      mode="time"
                      value={scheduleForm.jamSelesai}
                      disabled={saving}
                      accessibilityLabel="Jam selesai"
                      onChange={(jamSelesai) => {
                        setScheduleForm((previous) => ({ ...previous, jamSelesai }));
                        setError('');
                      }}
                    />
                  </View>
                </View>

                {/* PESAN ERROR MODAL */}
                {error ? (
                  <Text style={styles.modalError}>
                    {error}
                  </Text>
                ) : null}

                {/* TOMBOL MODAL */}
                <View style={styles.modalActions}>
                  <Pressable
                    style={({ pressed }) => [
                      styles.cancelButton,
                      pressed && styles.pressed,
                    ]}
                    onPress={closeModal}
                    disabled={saving}
                  >
                    <Text style={styles.cancelText}>
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
                      <Text style={styles.saveText}>
                        {editingClass ? 'Simpan' : 'Tambah'}
                      </Text>
                    )}
                  </Pressable>
                </View>

              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* =====================================
          MODAL KONFIRMASI HAPUS KELAS
      ===================================== */}

      <Modal
        animationType="fade"
        transparent
        visible={deleteTarget !== null}
        onRequestClose={closeDeleteModal}
        statusBarTranslucent
      >
        <View style={styles.confirmBackdrop}>
          {/* AREA LUAR MODAL */}
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={closeDeleteModal}
            disabled={deleting}
          />

          {/* KARTU KONFIRMASI */}
          <View style={styles.confirmCard}>

            {/* JUDUL */}
            <Text style={styles.confirmTitle}>
              Hapus Kelas?
            </Text>

            <Text style={styles.confirmDescription}>
              Apakah kamu yakin ingin menghapus kelas ini?
              Tindakan ini tidak dapat dibatalkan.
            </Text>

            {/* INFORMASI KELAS */}
            {deleteTarget && (
              <View style={styles.deleteClassInfo}>
                <Text style={styles.deleteClassName}>
                  {deleteTarget.nama}
                </Text>

                <Text style={styles.deleteClassCode}>
                  Kode kelas: {deleteTarget.kode}
                </Text>
              </View>
            )}

            {/* PESAN ERROR */}
            {deleteError ? (
              <Text style={styles.deleteErrorText}>
                {deleteError}
              </Text>
            ) : null}

            {/* TOMBOL KONFIRMASI */}
            <View style={styles.confirmActions}>

              <Pressable
                style={({ pressed }) => [
                  styles.cancelConfirmButton,
                  pressed && styles.pressed,
                ]}
                onPress={closeDeleteModal}
                disabled={deleting}
              >
                <Text style={styles.cancelConfirmText}>
                  Batal
                </Text>
              </Pressable>

              <Pressable
                style={[
                  styles.deleteConfirmButton,
                  deleting && styles.disabledButton,
                ]}
                onPress={confirmDelete}
                disabled={deleting}
              >
                {deleting ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.deleteConfirmText}>
                    Hapus
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
// STYLE MANAJEMEN KELAS
// ==========================================

const styles = StyleSheet.create({

  // HALAMAN UTAMA
  safeArea: {
    backgroundColor: '#FFFFFF',
    flex: 1,
  },

  content: {
    paddingBottom: 40,
  },

  pageContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    gap: 16,
  },

  centered: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    flex: 1,
    justifyContent: 'center',
    padding: 25,
    gap: 10,
  },

  centeredContent: {
    alignItems: 'center',
    padding: 30,
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

  classMeta: {
    gap: 2,
  },
  classMetaText: {
    fontFamily: FONT.regular,
    color: '#FFFFFF',
    fontSize: 13,
  },
  timeRow: {
    flexDirection: 'row',
    gap: 12,
  },
  timeColumn: {
    flex: 1,
  },
  pressed: {
    opacity: 0.65,
  },

  // DAFTAR KELAS
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    marginTop: 8,
  },


  sectionTitle: {
    fontFamily: FONT.extrabold,
    color: '#111014',
    fontSize: 19,
  },




  // KARTU KELAS
  classCard: {
    backgroundColor: '#F47321',
    borderRadius: 26,
    gap: 10,
    padding: 16,
  },

  classInfo: {
    gap: 4,
  },


  className: {
    fontFamily: FONT.extrabold,
    color: '#FFFFFF',
    fontSize: 18,
    letterSpacing: -0.3,
    lineHeight: 22,
  },

  classDescription: {
    fontFamily: FONT.regular,
    color: '#FFFFFF',
    fontSize: 13,
    lineHeight: 18,
  },

  // KELOLA PESERTA



  // EDIT DAN HAPUS





  // KELAS KOSONG
  emptyCard: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    gap: 8,
    borderColor: '#8E8E93',
    borderWidth: 1,
  },

  emptyTitle: {
    fontFamily: FONT.extrabold,
    color: '#111014',
    fontSize: 16,
  },

  mutedText: {
    fontFamily: FONT.regular,
    color: '#5F5F66',
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
  },

  // ERROR
  successBox: {
    backgroundColor: '#F47321',
    borderRadius: 10,
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
    borderRadius: 10,
    padding: 12,
  },

  errorText: {
    fontFamily: FONT.regular,
    color: '#FFFFFF',
    fontSize: 12,
    lineHeight: 18,
  },

  // MODAL TAMBAH / EDIT
  modalKeyboard: {
    flex: 1,
  },

  modalBackdrop: {
    backgroundColor: 'rgba(0,0,0,0.45)',
    flex: 1,
    justifyContent: 'flex-end',
  },

  modalScrollContent: {
    flexGrow: 1,
    justifyContent: 'flex-end',
  },

  modalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    gap: 11,
    padding: 22,
    paddingBottom: 32,
  },

  modalHeader: {
    gap: 5,
    marginBottom: 8,
  },

  modalHeaderRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  modalDeleteButton: {
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


  inputLabel: {
    fontFamily: FONT.bold,
    color: '#111014',
    fontSize: 13,
  },

  input: {
    fontFamily: FONT.regular,
    backgroundColor: '#FFFFFF',
    borderColor: '#8E8E93',
    borderRadius: 11,
    borderWidth: 1,
    color: '#111014',
    fontSize: 14,
    padding: 12,
  },

  descriptionInput: {
    minHeight: 85,
  },

  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 9,
  },

  cancelButton: {
    alignItems: 'center',
    borderColor: '#8E8E93',
    borderRadius: 11,
    borderWidth: 1,
    flex: 1,
    padding: 14,
  },

  cancelText: {
    fontFamily: FONT.bold,
    color: '#111014',
    fontSize: 14,
  },

  saveButton: {
    alignItems: 'center',
    backgroundColor: '#F47321',
    borderRadius: 11,
    flex: 1,
    justifyContent: 'center',
    padding: 14,
  },

  saveText: {
    fontFamily: FONT.bold,
    color: '#FFFFFF',
    fontSize: 14,
  },

  disabledButton: {
    opacity: 0.6,
  },

  modalError: {
    fontFamily: FONT.regular,
    color: '#E00000',
    fontSize: 12,
    lineHeight: 18,
  },

  // ==========================================
  // MODAL KONFIRMASI HAPUS
  // ==========================================

  confirmBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
  },

  confirmCard: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 23,
    gap: 13,
    elevation: 10,
  },

  confirmTitle: {
    fontFamily: FONT.extrabold,
    color: '#111014',
    fontSize: 22,
  },

  confirmDescription: {
    fontFamily: FONT.regular,
    color: '#5F5F66',
    fontSize: 13,
    lineHeight: 20,
  },

  deleteClassInfo: {
    backgroundColor: '#FFFFFF',
    borderRadius: 13,
    padding: 13,
    gap: 5,
    borderColor: '#8E8E93',
    borderWidth: 1,
  },

  deleteClassName: {
    fontFamily: FONT.extrabold,
    color: '#111014',
    fontSize: 14,
  },

  deleteClassCode: {
    fontFamily: FONT.regular,
    color: '#5F5F66',
    fontSize: 12,
  },

  deleteErrorText: {
    fontFamily: FONT.regular,
    color: '#E00000',
    fontSize: 12,
    lineHeight: 18,
  },

  confirmActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 5,
  },

  cancelConfirmButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    flex: 1,
    paddingVertical: 14,
    borderColor: '#8E8E93',
    borderWidth: 1,
  },

  cancelConfirmText: {
    fontFamily: FONT.bold,
    color: '#111014',
    fontSize: 14,
  },

  deleteConfirmButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E00000',
    borderRadius: 12,
    flex: 1,
    paddingVertical: 14,
  },

  deleteConfirmText: {
    fontFamily: FONT.bold,
    color: '#FFFFFF',
    fontSize: 14,
  },

});