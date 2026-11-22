import { useEffect, useState } from 'react';
import { router } from 'expo-router';

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

import AssistantHeader from '@/components/common/AssistantHeader';

import { useAuth } from '@/context/AuthContext';

import {
  createClass,
  deleteClass,
  subscribeClasses,
  updateClass,
  type ClassInput,
  type PracticumClass,
} from '@/features/assistant/services/class-service';
import { FONT } from '@/constants/fonts';

// Form kosong untuk tambah kelas.
const EMPTY_FORM: ClassInput = {
  nama: '',
  kode: '',
  deskripsi: '',
};

export default function AssistantClassesScreen() {
  const { profile, loading: authLoading } = useAuth();

  const [classes, setClasses] = useState<PracticumClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [modalVisible, setModalVisible] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState<ClassInput>(EMPTY_FORM);
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

    if (!profile || profile.role !== 'asisten') {
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

    return unsubscribe;
  }, [profile, authLoading]);

  // ==========================================
  // FORM TAMBAH KELAS
  // ==========================================

  function openCreateForm() {
    setEditingClass(null);
    setForm(EMPTY_FORM);
    setError('');
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

    try {
      setSaving(true);
      setError('');

      if (editingClass) {
        await updateClass(editingClass.id, form);
      } else {
        await createClass(form, profile.uid);
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
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color="#111014" />

        <Text style={styles.mutedText}>
          Memeriksa akun...
        </Text>
      </SafeAreaView>
    );
  }

  if (!profile) {
    return (
      <SafeAreaView style={styles.centered}>
        <Text style={styles.emptyTitle}>
          Belum Login
        </Text>

        <Text style={styles.mutedText}>
          Silakan login terlebih dahulu untuk mengelola kelas.
        </Text>
      </SafeAreaView>
    );
  }

  if (profile.role !== 'asisten') {
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
  // TAMPILAN MANAJEMEN KELAS
  // ==========================================

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar
        barStyle="dark-content"
      />

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >

        {/* HEADER SIPRAK */}
        <AssistantHeader />

        <View style={styles.pageContent}>

          {/* JUDUL HALAMAN */}
          <View style={styles.header}>
            <Text style={styles.title}>
              Manajemen Kelas
            </Text>

            <Text style={styles.subtitle}>
              Kelola kelas praktikum dan peserta yang terdaftar.
            </Text>
          </View>

          {/* TOMBOL TAMBAH KELAS */}
          <Pressable
            style={({ pressed }) => [
              styles.addButton,
              pressed && styles.pressed,
            ]}
            onPress={openCreateForm}
          >
            <Text style={styles.addButtonText}>
              + Tambah Kelas
            </Text>
          </Pressable>

          {/* PESAN ERROR */}
          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>
                {error}
              </Text>
            </View>
          ) : null}

          {/* HEADER DAFTAR KELAS */}
          <View style={styles.sectionHeader}>
            <View style={styles.sectionInfo}>
              <Text style={styles.sectionTitle}>
                Daftar Kelas
              </Text>

              <Text style={styles.sectionCaption}>
                Pilih kelas untuk mengelola anggotanya.
              </Text>
            </View>

            <View style={styles.totalBadge}>
              <Text style={styles.totalText}>
                {classes.length} kelas
              </Text>
            </View>
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
              <View
                key={item.id}
                style={styles.classCard}
              >

                <View style={styles.classInfo}>
                  <Text style={styles.classCode}>
                    {item.kode}
                  </Text>

                  <Text style={styles.className}>
                    {item.nama}
                  </Text>

                  <Text style={styles.classDescription}>
                    {item.deskripsi || 'Tidak ada deskripsi.'}
                  </Text>
                </View>

                {/* TOMBOL KELOLA PESERTA */}
                <Pressable
                  style={({ pressed }) => [
                    styles.manageMembersButton,
                    pressed && styles.pressed,
                  ]}
                  onPress={() =>
                    router.push({
                      pathname: '/assistant/class-members/[classId]',
                      params: { classId: item.id },
                    })
                  }
                >
                  <Text style={styles.manageMembersText}>
                    Kelola Peserta
                  </Text>

                  <Text style={styles.manageMembersArrow}>
                    ›
                  </Text>
                </Pressable>

                {/* TOMBOL EDIT DAN HAPUS */}
                <View style={styles.cardActions}>
                  <Pressable
                    style={({ pressed }) => [
                      styles.editButton,
                      pressed && styles.pressed,
                    ]}
                    onPress={() => openEditForm(item)}
                  >
                    <Text style={styles.editText}>
                      Edit
                    </Text>
                  </Pressable>

                  <Pressable
                    style={({ pressed }) => [
                      styles.deleteButton,
                      pressed && styles.pressed,
                    ]}
                    onPress={() => handleDelete(item)}
                  >
                    <Text style={styles.deleteText}>
                      Hapus
                    </Text>
                  </Pressable>
                </View>

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
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>
                    {editingClass ? 'Edit Kelas' : 'Tambah Kelas'}
                  </Text>

                  <Text style={styles.modalSubtitle}>
                    Lengkapi informasi kelas praktikum.
                  </Text>
                </View>

                {/* INPUT NAMA KELAS */}
                <Text style={styles.inputLabel}>
                  Nama Kelas
                </Text>

                <TextInput
                  value={form.nama}
                  onChangeText={(value) =>
                    setForm((previous) => ({
                      ...previous,
                      nama: value,
                    }))
                  }
                  placeholder="Contoh: Praktikum Pemrograman Bergerak"
                  placeholderTextColor="#8E8E93"
                  style={styles.input}
                  editable={!saving}
                  maxLength={100}
                  returnKeyType="next"
                  blurOnSubmit={false}
                />

                {/* INPUT KODE KELAS */}
                <Text style={styles.inputLabel}>
                  Kode Kelas
                </Text>

                <TextInput
                  value={form.kode}
                  onChangeText={(value) =>
                    setForm((previous) => ({
                      ...previous,
                      kode: value.toUpperCase(),
                    }))
                  }
                  placeholder="Contoh: PPB-A"
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
    backgroundColor: '#111014',
    borderRadius: 14,
    paddingVertical: 16,
    marginTop: 2,
  },

  addButtonText: {
    fontFamily: FONT.bold,
    color: '#FFFFFF',
    fontSize: 14,
  },

  pressed: {
    opacity: 0.65,
  },

  // DAFTAR KELAS
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

  // KARTU KELAS
  classCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#8E8E93',
    borderRadius: 18,
    borderWidth: 1,
    gap: 14,
    marginBottom: 4,
    padding: 17,
  },

  classInfo: {
    gap: 8,
  },

  classCode: {
    fontFamily: FONT.extrabold,
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderRadius: 7,
    color: '#5F5F66',
    fontSize: 11,
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderColor: '#8E8E93',
    borderWidth: 1,
  },

  className: {
    fontFamily: FONT.extrabold,
    color: '#111014',
    fontSize: 17,
    lineHeight: 23,
  },

  classDescription: {
    fontFamily: FONT.regular,
    color: '#5F5F66',
    fontSize: 13,
    lineHeight: 19,
  },

  // KELOLA PESERTA
  manageMembersButton: {
    alignItems: 'center',
    backgroundColor: '#111014',
    borderRadius: 11,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    paddingVertical: 12,
  },

  manageMembersText: {
    fontFamily: FONT.bold,
    color: '#FFFFFF',
    fontSize: 13,
  },

  manageMembersArrow: {
    fontFamily: FONT.regular,
    color: '#FFFFFF',
    fontSize: 23,
    lineHeight: 25,
  },

  // EDIT DAN HAPUS
  cardActions: {
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

  editText: {
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

  deleteText: {
    fontFamily: FONT.bold,
    color: '#5F5F66',
    fontSize: 13,
  },

  // KELAS KOSONG
  emptyCard: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 17,
    padding: 25,
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

  modalTitle: {
    fontFamily: FONT.extrabold,
    color: '#111014',
    fontSize: 21,
  },

  modalSubtitle: {
    fontFamily: FONT.regular,
    color: '#5F5F66',
    fontSize: 12,
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
    backgroundColor: '#111014',
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
    backgroundColor: '#111014',
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