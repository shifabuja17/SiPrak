import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
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

import { useAuth } from '@/context/AuthContext';
import {
  createClass,
  deleteClass,
  subscribeClasses,
  updateClass,
  type ClassInput,
  type PracticumClass,
} from '@/features/assistant/services/class-service';

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

  // Mengambil data kelas secara real-time.
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

  // Membuka form tambah kelas.
  function openCreateForm() {
    setEditingClass(null);
    setForm(EMPTY_FORM);
    setError('');
    setModalVisible(true);
  }

  // Membuka form edit kelas.
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

  // Menutup modal dan membersihkan error.
  function closeModal() {
    if (saving) return;

    setModalVisible(false);
    setError('');
  }

  // Menyimpan kelas baru atau perubahan kelas.
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

  // Menghapus kelas dengan konfirmasi.
  function handleDelete(item: PracticumClass) {
    Alert.alert(
      'Hapus Kelas?',
      `Apakah kamu yakin ingin menghapus kelas ${item.nama}?`,
      [
        {
          text: 'Batal',
          style: 'cancel',
        },
        {
          text: 'Hapus',
          style: 'destructive',
          onPress: async () => {
            try {
              setError('');
              await deleteClass(item.id);
            } catch (err) {
              setError(
                err instanceof Error
                  ? err.message
                  : 'Gagal menghapus data kelas.'
              );
            }
          },
        },
      ]
    );
  }

  // Menunggu proses autentikasi.
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

  // Memeriksa pengguna yang belum login.
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

  // Membatasi halaman untuk Asisten.
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

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Text style={styles.backText}>
            ‹ Kembali
          </Text>
        </Pressable>

        <View style={styles.header}>
          <Text style={styles.title}>
            Manajemen Kelas
          </Text>

          <Text style={styles.subtitle}>
            Kelola kelas praktikum yang tersedia.
          </Text>
        </View>

        <Pressable
          style={styles.addButton}
          onPress={openCreateForm}
        >
          <Text style={styles.addButtonText}>
            + Tambah Kelas
          </Text>
        </Pressable>

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>
              {error}
            </Text>
          </View>
        ) : null}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            Daftar Kelas
          </Text>

          <Text style={styles.totalText}>
            {classes.length} kelas
          </Text>
        </View>

        {loading ? (
          <View style={styles.centeredContent}>
            <ActivityIndicator size="large" color="#000000" />
            <Text style={styles.mutedText}>
              Memuat data kelas...
            </Text>
          </View>
        ) : classes.length === 0 ? (
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
          classes.map((item) => (
            <View key={item.id} style={styles.classCard}>
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

              {/* Tombol menuju halaman Kelola Peserta */}
              <Pressable
                style={styles.manageMembersButton}
                onPress={() =>
                  router.push({
                    pathname: '/assistant/class-members/[classId]',
                    params: { classId: item.id },
                  })
                }
              >
                <Text style={styles.manageMembersText}>
                  Kelola Peserta →
                </Text>
              </Pressable>

              <View style={styles.cardActions}>
                <Pressable
                  style={styles.editButton}
                  onPress={() => openEditForm(item)}
                >
                  <Text style={styles.editText}>
                    Edit
                  </Text>
                </Pressable>

                <Pressable
                  style={styles.deleteButton}
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
      </ScrollView>

      {/* Modal form dengan dukungan keyboard */}
      <Modal
        animationType="slide"
        transparent
        visible={modalVisible}
        onRequestClose={closeModal}
      >
        <KeyboardAvoidingView
          style={styles.modalKeyboard}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
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
                <Text style={styles.modalTitle}>
                  {editingClass ? 'Edit Kelas' : 'Tambah Kelas'}
                </Text>

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
                  placeholderTextColor="#888888"
                  style={styles.input}
                  editable={!saving}
                  maxLength={100}
                  returnKeyType="next"
                  blurOnSubmit={false}
                />

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
                  placeholderTextColor="#888888"
                  style={styles.input}
                  editable={!saving}
                  autoCapitalize="characters"
                  maxLength={20}
                  returnKeyType="next"
                  blurOnSubmit={false}
                />

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
                  placeholderTextColor="#888888"
                  style={[
                    styles.input,
                    styles.descriptionInput,
                  ]}
                  multiline
                  textAlignVertical="top"
                  editable={!saving}
                  maxLength={300}
                />

                {error ? (
                  <Text style={styles.modalError}>
                    {error}
                  </Text>
                ) : null}

                <View style={styles.modalActions}>
                  <Pressable
                    style={styles.cancelButton}
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: '#FFFFFF',
    flex: 1,
  },
  content: {
    padding: 20,
    paddingTop: 35,
    paddingBottom: 50,
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
  backButton: {
    alignSelf: 'flex-start',
    paddingVertical: 5,
  },
  backText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '700',
  },
  header: {
    gap: 5,
  },
  title: {
    color: '#000000',
    fontSize: 27,
    fontWeight: '800',
  },
  subtitle: {
    color: '#666666',
    fontSize: 14,
    lineHeight: 21,
  },
  addButton: {
    alignItems: 'center',
    backgroundColor: '#000000',
    borderRadius: 13,
    padding: 15,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 5,
  },
  sectionTitle: {
    color: '#000000',
    fontSize: 19,
    fontWeight: '800',
  },
  totalText: {
    color: '#666666',
    fontSize: 13,
  },
  classCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#D9D9D9',
    borderRadius: 16,
    borderWidth: 1,
    gap: 15,
    padding: 16,
  },
  classInfo: {
    gap: 6,
  },
  classCode: {
    alignSelf: 'flex-start',
    backgroundColor: '#EEEEEE',
    borderRadius: 7,
    color: '#333333',
    fontSize: 11,
    fontWeight: '800',
    overflow: 'hidden',
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  className: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '800',
  },
  classDescription: {
    color: '#666666',
    fontSize: 13,
    lineHeight: 19,
  },

  // Tombol Kelola Peserta
  manageMembersButton: {
    alignItems: 'center',
    backgroundColor: '#F2F2F2',
    borderRadius: 9,
    padding: 11,
  },
  manageMembersText: {
    color: '#000000',
    fontSize: 13,
    fontWeight: '700',
  },

  cardActions: {
    flexDirection: 'row',
    gap: 9,
  },
  editButton: {
    alignItems: 'center',
    borderColor: '#000000',
    borderRadius: 9,
    borderWidth: 1,
    flex: 1,
    padding: 10,
  },
  editText: {
    color: '#000000',
    fontSize: 13,
    fontWeight: '700',
  },
  deleteButton: {
    alignItems: 'center',
    backgroundColor: '#F2F2F2',
    borderRadius: 9,
    flex: 1,
    padding: 10,
  },
  deleteText: {
    color: '#000000',
    fontSize: 13,
    fontWeight: '700',
  },
  emptyCard: {
    alignItems: 'center',
    backgroundColor: '#F2F2F2',
    borderRadius: 15,
    padding: 25,
    gap: 8,
  },
  emptyTitle: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '800',
  },
  mutedText: {
    color: '#666666',
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
  },
  errorBox: {
    backgroundColor: '#FEE2E2',
    borderRadius: 10,
    padding: 12,
  },
  errorText: {
    color: '#991B1B',
    fontSize: 12,
    lineHeight: 18,
  },

  // Keyboard handling
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
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    gap: 11,
    padding: 22,
    paddingBottom: 32,
  },
  modalTitle: {
    color: '#000000',
    fontSize: 21,
    fontWeight: '800',
    marginBottom: 5,
  },
  inputLabel: {
    color: '#000000',
    fontSize: 13,
    fontWeight: '700',
  },
  input: {
    borderColor: '#CCCCCC',
    borderRadius: 11,
    borderWidth: 1,
    color: '#000000',
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
    borderColor: '#CCCCCC',
    borderRadius: 11,
    borderWidth: 1,
    flex: 1,
    padding: 14,
  },
  cancelText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '700',
  },
  saveButton: {
    alignItems: 'center',
    backgroundColor: '#000000',
    borderRadius: 11,
    flex: 1,
    justifyContent: 'center',
    padding: 14,
  },
  saveText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  disabledButton: {
    opacity: 0.6,
  },
  modalError: {
    color: '#B91C1C',
    fontSize: 12,
    lineHeight: 18,
  },
});