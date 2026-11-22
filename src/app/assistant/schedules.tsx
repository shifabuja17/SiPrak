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

import AssistantHeader from '@/components/common/AssistantHeader';

import { useAuth } from '@/context/AuthContext';

import {
  createSchedule,
  deleteSchedule,
  subscribeSchedules,
  updateSchedule,
  type PracticumSchedule,
  type ScheduleInput,
} from '@/features/assistant/services/schedule-service';

import {
  subscribeClasses,
  type PracticumClass,
} from '@/features/assistant/services/class-service';
import { FONT } from '@/constants/fonts';
import { withNotificationNote } from '@/features/notifications/utils/dispatch-message';

// ==========================================
// FORM KOSONG
// ==========================================

const EMPTY_FORM: ScheduleInput = {
  classId: '',
  practicumName: '',
  moduleTitle: '',
  classRoom: '',
  scheduleTime: '',
};

// ==========================================
// HALAMAN MANAJEMEN JADWAL
// ==========================================

export default function AssistantSchedulesScreen() {
  const { profile } = useAuth();

  // DATA FIRESTORE
  const [classes, setClasses] = useState<PracticumClass[]>([]);
  const [schedules, setSchedules] = useState<PracticumSchedule[]>([]);

  // LOADING
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [loadingSchedules, setLoadingSchedules] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // ERROR DAN NOTIFIKASI
  const [pageError, setPageError] = useState('');
  const [pageMessage, setPageMessage] = useState('');
  const [modalError, setModalError] = useState('');
  const [deleteError, setDeleteError] = useState('');

  // MODAL TAMBAH / EDIT
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ScheduleInput>(EMPTY_FORM);

  // MODAL HAPUS
  const [deleteTarget, setDeleteTarget] =
    useState<PracticumSchedule | null>(null);

  // ==========================================
  // MENGAMBIL DATA KELAS DAN JADWAL REAL-TIME
  // ==========================================

  useEffect(() => {
    const unsubscribeClasses = subscribeClasses(
      (data) => {
        setClasses(data);
        setLoadingClasses(false);
        setPageError('');
      },
      (error) => {
        console.error('Gagal mengambil kelas:', error);
        setPageError('Tidak dapat mengambil data kelas.');
        setLoadingClasses(false);
      },
    );

    const unsubscribeSchedules = subscribeSchedules(
      (data) => {
        setSchedules(data);
        setLoadingSchedules(false);
      },
      (error) => {
        console.error('Gagal mengambil jadwal:', error);
        setPageError('Tidak dapat mengambil data jadwal.');
        setLoadingSchedules(false);
      },
    );

    return () => {
      unsubscribeClasses();
      unsubscribeSchedules();
    };
  }, []);

  // ==========================================
  // FORM TAMBAH JADWAL
  // ==========================================

  function openCreateModal() {
    setPageMessage('');

    if (classes.length === 0) {
      setPageError(
        'Buat kelas terlebih dahulu sebelum menambahkan jadwal.',
      );
      return;
    }

    setEditingId(null);

    setForm({
      ...EMPTY_FORM,
      classId: classes[0].id,
    });

    setModalError('');
    setModalVisible(true);
  }

  // ==========================================
  // FORM EDIT JADWAL
  // ==========================================

  function openEditModal(item: PracticumSchedule) {
    setEditingId(item.id);

    setForm({
      classId: item.classId,
      practicumName: item.practicumName,
      moduleTitle: item.moduleTitle,
      classRoom: item.classRoom,
      scheduleTime: item.scheduleTime,
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
    setForm(EMPTY_FORM);
    setModalError('');
  }

  // ==========================================
  // MENGUBAH INPUT FORM
  // ==========================================

  function updateField(
    field: keyof ScheduleInput,
    value: string,
  ) {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));

    setModalError('');
  }

  // ==========================================
  // MENYIMPAN JADWAL
  // ==========================================

  async function handleSave() {
    const input: ScheduleInput = {
      classId: form.classId,
      practicumName: form.practicumName.trim(),
      moduleTitle: form.moduleTitle.trim(),
      classRoom: form.classRoom.trim(),
      scheduleTime: form.scheduleTime.trim(),
    };

    if (
      !input.classId ||
      !input.practicumName ||
      !input.moduleTitle ||
      !input.classRoom ||
      !input.scheduleTime
    ) {
      setModalError('Isi seluruh kolom terlebih dahulu.');
      return;
    }

    if (!classes.some((item) => item.id === input.classId)) {
      setModalError('Pilih kelas yang masih tersedia.');
      return;
    }

    if (!editingId && !profile?.uid) {
      setModalError('Identitas akun Asisten tidak ditemukan.');
      return;
    }

    try {
      setSaving(true);
      setModalError('');
      setPageMessage('');

      if (editingId) {
        const notifyResult = await updateSchedule(editingId, input);

        setPageMessage(withNotificationNote('Jadwal berhasil diperbarui.', notifyResult));
      } else {
        await createSchedule(input, profile!.uid);

        setPageMessage('Jadwal berhasil ditambahkan.');
      }

      setModalVisible(false);
      setEditingId(null);
      setForm(EMPTY_FORM);
    } catch (error) {
      console.error('Gagal menyimpan jadwal:', error);

      setModalError(
        error instanceof Error
          ? error.message
          : 'Jadwal tidak berhasil disimpan.',
      );
    } finally {
      setSaving(false);
    }
  }

  // ==========================================
  // MODAL KONFIRMASI HAPUS
  // ==========================================

  function openDeleteModal(item: PracticumSchedule) {
    setDeleteError('');
    setDeleteTarget(item);
  }

  function closeDeleteModal() {
    if (deleting) return;

    setDeleteTarget(null);
    setDeleteError('');
  }

  // ==========================================
  // PROSES HAPUS JADWAL
  // ==========================================

  async function confirmDelete() {
    if (!deleteTarget) return;

    try {
      setDeleting(true);
      setDeleteError('');
      setPageMessage('');

      await deleteSchedule(deleteTarget.id);

      setDeleteTarget(null);
      setPageMessage('Jadwal berhasil dihapus.');
    } catch (error) {
      console.error('Gagal menghapus jadwal:', error);

      setDeleteError(
        error instanceof Error
          ? error.message
          : 'Jadwal tidak berhasil dihapus.',
      );
    } finally {
      setDeleting(false);
    }
  }

  // ==========================================
  // KARTU JADWAL
  // ==========================================

  function renderSchedule({
    item,
  }: {
    item: PracticumSchedule;
  }) {
    const selectedClass = classes.find(
      (kelas) => kelas.id === item.classId,
    );

    return (
      <View style={styles.scheduleItem}>
        <View style={styles.card}>

          {/* NAMA PRAKTIKUM DAN KODE KELAS */}
          <View style={styles.cardHeader}>
            <Text style={styles.scheduleName}>
              {item.practicumName}
            </Text>

            <View style={styles.classCodeBadge}>
              <Text style={styles.classCode}>
                {selectedClass?.kode ?? '-'}
              </Text>
            </View>
          </View>

          {/* INFORMASI KELAS */}
          <View style={styles.detailGroup}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>
                Kelas
              </Text>

              <Text style={styles.detailValue}>
                {selectedClass?.nama ?? 'Kelas tidak ditemukan'}
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
          </View>

          {/* INFORMASI WAKTU */}
          <View style={styles.timeBox}>
            <Text style={styles.timeLabel}>
              HARI DAN WAKTU
            </Text>

            <Text style={styles.time}>
              {item.scheduleTime}
            </Text>
          </View>

          {/* TOMBOL EDIT DAN HAPUS */}
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
              onPress={() => openDeleteModal(item)}
            >
              <Text style={styles.deleteButtonText}>
                Hapus
              </Text>
            </Pressable>
          </View>

        </View>
      </View>
    );
  }

  const isLoading = loadingClasses || loadingSchedules;

  // ==========================================
  // TAMPILAN UTAMA
  // ==========================================

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />

      <FlatList
        data={schedules}
        keyExtractor={(item) => item.id}
        renderItem={renderSchedule}
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
                  Manajemen Jadwal
                </Text>

                <Text style={styles.subtitle}>
                  Atur jadwal praktikum dan informasi pertemuan.
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
                <Text style={styles.addButtonText}>
                  + Tambah Jadwal
                </Text>
              </Pressable>

              {/* NOTIFIKASI */}
              {pageMessage ? (
                <View style={styles.successBox}>
                  <Text style={styles.successText}>
                    {pageMessage}
                  </Text>
                </View>
              ) : null}

              {pageError ? (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>
                    {pageError}
                  </Text>
                </View>
              ) : null}

              {/* JUDUL DAFTAR */}
              <View style={styles.sectionHeader}>
                <View style={styles.sectionInfo}>
                  <Text style={styles.sectionTitle}>
                    Daftar Jadwal
                  </Text>

                  <Text style={styles.sectionCaption}>
                    Jadwal praktikum yang telah dibuat.
                  </Text>
                </View>

                <View style={styles.totalBadge}>
                  <Text style={styles.totalText}>
                    {schedules.length} jadwal
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
                  Memuat data jadwal...
                </Text>
              </>
            ) : (
              <>
                <View style={styles.emptyIcon}>
                  <Text style={styles.emptyIconText}>
                    +
                  </Text>
                </View>

                <Text style={styles.emptyTitle}>
                  Belum Ada Jadwal
                </Text>

                <Text style={styles.emptyText}>
                  Tekan Tambah Jadwal untuk membuat
                  jadwal praktikum pertama.
                </Text>
              </>
            )}
          </View>
        }
      />

      {/* =====================================
          MODAL TAMBAH / EDIT JADWAL
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

              {/* HANDLE MODAL */}
              <View style={styles.modalHandle} />

              {/* JUDUL MODAL */}
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {editingId ? 'Edit Jadwal' : 'Tambah Jadwal'}
                </Text>

                <Text style={styles.modalSubtitle}>
                  Lengkapi informasi jadwal praktikum.
                </Text>
              </View>

              {/* PILIH KELAS */}
              <Text style={styles.label}>
                Pilih Kelas
              </Text>

              <View style={styles.classOptions}>
                {classes.map((item) => {
                  const selected = form.classId === item.id;

                  return (
                    <Pressable
                      key={item.id}
                      style={[
                        styles.classOption,
                        selected && styles.classOptionSelected,
                      ]}
                      onPress={() => updateField('classId', item.id)}
                      disabled={saving}
                    >
                      <Text
                        style={[
                          styles.classOptionText,
                          selected && styles.classOptionTextSelected,
                        ]}
                      >
                        {item.nama} ({item.kode})
                      </Text>

                      {selected ? (
                        <Text style={styles.selectedMark}>
                          ✓
                        </Text>
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>

              {/* NAMA PRAKTIKUM */}
              <Text style={styles.label}>
                Nama Praktikum
              </Text>

              <TextInput
                style={styles.input}
                placeholder="Contoh: Praktikum Pemrograman Mobile"
                placeholderTextColor="#8E8E93"
                value={form.practicumName}
                onChangeText={(value) =>
                  updateField('practicumName', value)
                }
                editable={!saving}
              />

              {/* MODUL */}
              <Text style={styles.label}>
                Modul
              </Text>

              <TextInput
                style={styles.input}
                placeholder="Contoh: Modul 1 - Pengenalan React Native"
                placeholderTextColor="#8E8E93"
                value={form.moduleTitle}
                onChangeText={(value) =>
                  updateField('moduleTitle', value)
                }
                editable={!saving}
              />

              {/* RUANGAN */}
              <Text style={styles.label}>
                Ruangan
              </Text>

              <TextInput
                style={styles.input}
                placeholder="Contoh: Lab Komputasi Dasar"
                placeholderTextColor="#8E8E93"
                value={form.classRoom}
                onChangeText={(value) =>
                  updateField('classRoom', value)
                }
                editable={!saving}
              />

              {/* HARI DAN WAKTU */}
              <Text style={styles.label}>
                Hari dan Waktu
              </Text>

              <TextInput
                style={styles.input}
                placeholder="Contoh: Senin, 08.00 - 10.00 WIB"
                placeholderTextColor="#8E8E93"
                value={form.scheduleTime}
                onChangeText={(value) =>
                  updateField('scheduleTime', value)
                }
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
                  <Text
                    style={styles.cancelButtonText}
                    numberOfLines={1}
                  >
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
                    <Text
                      style={styles.saveButtonText}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.75}
                    >
                      {editingId ? 'Simpan Perubahan' : 'Simpan Jadwal'}
                    </Text>
                  )}
                </Pressable>
              </View>

            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* =====================================
          MODAL KONFIRMASI HAPUS JADWAL
      ===================================== */}

      <Modal
        visible={deleteTarget !== null}
        transparent
        animationType="fade"
        onRequestClose={closeDeleteModal}
        statusBarTranslucent
      >
        <View style={styles.confirmBackdrop}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={closeDeleteModal}
            disabled={deleting}
          />

          <View style={styles.confirmCard}>

            {/* JUDUL */}
            <Text style={styles.confirmTitle}>
              Hapus Jadwal?
            </Text>

            <Text style={styles.confirmDescription}>
              Apakah kamu yakin ingin menghapus jadwal ini?
              Tindakan ini tidak dapat dibatalkan.
            </Text>

            {/* DETAIL JADWAL */}
            {deleteTarget ? (
              <View style={styles.deleteScheduleInfo}>
                <Text style={styles.deleteScheduleName}>
                  {deleteTarget.practicumName}
                </Text>

                <Text style={styles.deleteScheduleDetail}>
                  {classes.find(
                    (item) => item.id === deleteTarget.classId,
                  )?.kode ?? 'Kelas tidak ditemukan'}
                </Text>

                <Text style={styles.deleteScheduleDetail}>
                  {deleteTarget.scheduleTime}
                </Text>
              </View>
            ) : null}

            {/* ERROR HAPUS */}
            {deleteError ? (
              <Text style={styles.deleteErrorText}>
                {deleteError}
              </Text>
            ) : null}

            {/* TOMBOL */}
            <View style={styles.confirmActions}>
              <Pressable
                style={styles.cancelConfirmButton}
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
// STYLE MANAJEMEN JADWAL
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

  separator: {
    height: 12,
  },

  scheduleItem: {
    paddingHorizontal: 20,
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

  // TAMBAH JADWAL
  addButton: {
    alignItems: 'center',
    backgroundColor: '#111014',
    borderRadius: 14,
    marginTop: 2,
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

  // DAFTAR JADWAL
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

  // KARTU JADWAL
  card: {
    backgroundColor: '#FFFFFF',
    borderColor: '#8E8E93',
    borderRadius: 18,
    borderWidth: 1,
    gap: 14,
    padding: 17,
  },

  cardHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },

  scheduleName: {
    fontFamily: FONT.extrabold,
    color: '#111014',
    flex: 1,
    fontSize: 17,
    lineHeight: 23,
  },

  classCodeBadge: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderColor: '#8E8E93',
    borderWidth: 1,
  },

  classCode: {
    fontFamily: FONT.extrabold,
    color: '#5F5F66',
    fontSize: 11,
  },

  // DETAIL JADWAL
  detailGroup: {
    gap: 10,
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

  // WAKTU
  timeBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
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

  time: {
    fontFamily: FONT.extrabold,
    color: '#111014',
    fontSize: 14,
  },

  // TOMBOL EDIT DAN HAPUS
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

  emptyIconText: {
    fontFamily: FONT.regular,
    color: '#111014',
    fontSize: 28,
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

  mutedText: {
    fontFamily: FONT.regular,
    color: '#5F5F66',
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
  },

  // ==========================================
  // MODAL TAMBAH DAN EDIT
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

  modalHeader: {
    gap: 5,
    marginBottom: 5,
  },

  modalHandle: {
    alignSelf: 'center',
    backgroundColor: '#8E8E93',
    borderRadius: 5,
    height: 5,
    marginBottom: 17,
    width: 42,
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

  // LABEL INPUT
  label: {
    fontFamily: FONT.bold,
    color: '#111014',
    fontSize: 13,
    marginBottom: 8,
    marginTop: 15,
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
    paddingHorizontal: 12,
    paddingVertical: 13,
  },

  // PILIHAN KELAS
  classOptions: {
    gap: 8,
  },

  classOption: {
    alignItems: 'center',
    borderColor: '#8E8E93',
    borderRadius: 11,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 13,
  },

  classOptionSelected: {
    backgroundColor: '#FFFFFF',
    borderColor: '#111014',
    borderWidth: 2,
  },

  classOptionText: {
    fontFamily: FONT.regular,
    color: '#5F5F66',
    flex: 1,
    fontSize: 13,
  },

  classOptionTextSelected: {
    fontFamily: FONT.bold,
    color: '#111014',
  },

  selectedMark: {
    fontFamily: FONT.extrabold,
    color: '#111014',
    fontSize: 17,
    marginLeft: 8,
  },

  // ERROR MODAL
  modalError: {
    fontFamily: FONT.regular,
    color: '#E00000',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 10,
  },

  // TOMBOL MODAL
  modalActions: {
    alignItems: 'stretch',
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
    marginBottom: 5,
  },

  cancelButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 11,
    flex: 0.8,
    minHeight: 46,
    paddingHorizontal: 10,
    paddingVertical: 13,
    borderColor: '#8E8E93',
    borderWidth: 1,
  },

  cancelButtonText: {
    fontFamily: FONT.bold,
    color: '#111014',
    fontSize: 13,
    textAlign: 'center',
  },

  saveButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111014',
    borderRadius: 11,
    flex: 1.2,
    minHeight: 46,
    paddingHorizontal: 10,
    paddingVertical: 13,
  },

  saveButtonText: {
    fontFamily: FONT.bold,
    color: '#FFFFFF',
    fontSize: 13,
    flexShrink: 1,
    textAlign: 'center',
    width: '100%',
  },

  // ==========================================
  // MODAL KONFIRMASI HAPUS
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

  deleteScheduleInfo: {
    backgroundColor: '#FFFFFF',
    borderRadius: 13,
    gap: 5,
    padding: 13,
    borderColor: '#8E8E93',
    borderWidth: 1,
  },

  deleteScheduleName: {
    fontFamily: FONT.extrabold,
    color: '#111014',
    fontSize: 14,
  },

  deleteScheduleDetail: {
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

  deleteConfirmButton: {
    alignItems: 'center',
    backgroundColor: '#111014',
    borderRadius: 11,
    flex: 1,
    justifyContent: 'center',
    paddingVertical: 14,
  },

  deleteConfirmText: {
    fontFamily: FONT.bold,
    color: '#FFFFFF',
    fontSize: 13,
  },

});