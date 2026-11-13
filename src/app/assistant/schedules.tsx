import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  FlatList,
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

const EMPTY_FORM: ScheduleInput = {
  classId: '',
  practicumName: '',
  moduleTitle: '',
  classRoom: '',
  scheduleTime: '',
};

export default function AssistantSchedulesScreen() {
  const { profile } = useAuth();

  const [classes, setClasses] = useState<PracticumClass[]>([]);
  const [schedules, setSchedules] = useState<PracticumSchedule[]>([]);

  const [loadingClasses, setLoadingClasses] = useState(true);
  const [loadingSchedules, setLoadingSchedules] = useState(true);
  const [saving, setSaving] = useState(false);

  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ScheduleInput>(EMPTY_FORM);

  // Mengambil data kelas dan jadwal secara real-time.
  useEffect(() => {
    const unsubscribeClasses = subscribeClasses(
        (data) => {
        setClasses(data);
        setLoadingClasses(false);
      },
      (error) => {
        console.error('Gagal mengambil jadwal:', error);
        Alert.alert('Gagal', 'Tidak dapat mengambil data jadwal.');
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
        Alert.alert('Gagal', 'Tidak dapat mengambil data jadwal.');
        setLoadingSchedules(false);
      },
    );

    return () => {
      unsubscribeClasses();
      unsubscribeSchedules();
    };
  }, []);

  function openCreateModal() {
    if (classes.length === 0) {
      Alert.alert(
        'Kelas belum tersedia',
        'Buat kelas terlebih dahulu sebelum menambahkan jadwal.',
      );
      return;
    }

    setEditingId(null);
    setForm({
      ...EMPTY_FORM,
      classId: classes[0].id,
    });
    setModalVisible(true);
  }

  function openEditModal(item: PracticumSchedule) {
    setEditingId(item.id);

    setForm({
      classId: item.classId,
      practicumName: item.practicumName,
      moduleTitle: item.moduleTitle,
      classRoom: item.classRoom,
      scheduleTime: item.scheduleTime,
    });

    setModalVisible(true);
  }

  function closeModal() {
    if (saving) return;

    setModalVisible(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  function updateField(
    field: keyof ScheduleInput,
    value: string,
  ) {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));
  }

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
      Alert.alert('Data belum lengkap', 'Isi seluruh kolom terlebih dahulu.');
      return;
    }

    if (!classes.some((item) => item.id === input.classId)) {
      Alert.alert('Kelas tidak valid', 'Pilih kelas yang masih tersedia.');
      return;
    }

    if (!editingId && !profile?.uid) {
      Alert.alert('Gagal', 'Identitas akun Asisten tidak ditemukan.');
      return;
    }

    try {
      setSaving(true);

      if (editingId) {
        await updateSchedule(editingId, input);
        Alert.alert('Berhasil', 'Jadwal berhasil diperbarui.');
      } else {
        await createSchedule(input, profile!.uid);
        Alert.alert('Berhasil', 'Jadwal berhasil ditambahkan.');
      }

      setModalVisible(false);
      setEditingId(null);
      setForm(EMPTY_FORM);
    } catch (error) {
      console.error('Gagal menyimpan jadwal:', error);
      Alert.alert('Gagal', 'Jadwal tidak berhasil disimpan.');
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete(item: PracticumSchedule) {
    Alert.alert(
      'Hapus Jadwal',
      `Yakin ingin menghapus jadwal "${item.practicumName}"?`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus',
          style: 'destructive',
          onPress: () => {
            void handleDelete(item.id);
          },
        },
      ],
    );
  }

  async function handleDelete(scheduleId: string) {
    try {
      await deleteSchedule(scheduleId);
      Alert.alert('Berhasil', 'Jadwal berhasil dihapus.');
    } catch (error) {
      console.error('Gagal menghapus jadwal:', error);
      Alert.alert('Gagal', 'Jadwal tidak berhasil dihapus.');
    }
  }

  function renderSchedule({ item }: { item: PracticumSchedule }) {
    const selectedClass = classes.find(
      (kelas) => kelas.id === item.classId,
    );

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.scheduleName}>
            {item.practicumName}
          </Text>

          <Text style={styles.classCode}>
            {selectedClass?.kode ?? 'Kelas tidak ditemukan'}
          </Text>
        </View>

        <Text style={styles.detail}>
          Kelas: {selectedClass?.nama ?? '-'}
        </Text>

        <Text style={styles.detail}>
          Modul: {item.moduleTitle}
        </Text>

        <Text style={styles.detail}>
          Ruangan: {item.classRoom}
        </Text>

        <Text style={styles.time}>
          {item.scheduleTime}
        </Text>

        <View style={styles.actionRow}>
          <Pressable
            style={styles.editButton}
            onPress={() => openEditModal(item)}
          >
            <Text style={styles.editButtonText}>Edit</Text>
          </Pressable>

          <Pressable
            style={styles.deleteButton}
            onPress={() => confirmDelete(item)}
          >
            <Text style={styles.deleteButtonText}>Hapus</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const isLoading = loadingClasses || loadingSchedules;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />

      <FlatList
        data={schedules}
        keyExtractor={(item) => item.id}
        renderItem={renderSchedule}
        contentContainerStyle={styles.content}
        ItemSeparatorComponent={() => (
          <View style={{ height: 12 }} />
        )}
        ListHeaderComponent={
          <View style={styles.header}>
            <Pressable onPress={() => router.back()}>
              <Text style={styles.backText}>‹ Kembali</Text>
            </Pressable>

            <Text style={styles.title}>Manajemen Jadwal</Text>

            <Text style={styles.subtitle}>
              Tambah, lihat, ubah, dan hapus jadwal praktikum.
            </Text>

            <Pressable
              style={styles.addButton}
              onPress={openCreateModal}
            >
              <Text style={styles.addButtonText}>
                + Tambah Jadwal
              </Text>
            </Pressable>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            {isLoading ? (
              <ActivityIndicator size="large" color="#000000" />
            ) : (
              <>
                <Text style={styles.emptyTitle}>
                  Belum Ada Jadwal
                </Text>
                <Text style={styles.emptyText}>
                  Tekan Tambah Jadwal untuk membuat jadwal praktikum pertama.
                </Text>
              </>
            )}
          </View>
        }
      />

      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={closeModal}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalContainer}>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.modalTitle}>
                {editingId ? 'Edit Jadwal' : 'Tambah Jadwal'}
              </Text>

              <Text style={styles.label}>Pilih Kelas</Text>

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
                    >
                      <Text
                        style={[
                          styles.classOptionText,
                          selected && styles.classOptionTextSelected,
                        ]}
                      >
                        {item.nama} ({item.kode})
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={styles.label}>Nama Praktikum</Text>
              <TextInput
                style={styles.input}
                placeholder="Contoh: Praktikum Pemrograman Mobile"
                value={form.practicumName}
                onChangeText={(value) =>
                  updateField('practicumName', value)
                }
              />

              <Text style={styles.label}>Modul</Text>
              <TextInput
                style={styles.input}
                placeholder="Contoh: Modul 1 - Pengenalan React Native"
                value={form.moduleTitle}
                onChangeText={(value) =>
                  updateField('moduleTitle', value)
                }
              />

              <Text style={styles.label}>Ruangan</Text>
              <TextInput
                style={styles.input}
                placeholder="Contoh: Lab Komputasi Dasar"
                value={form.classRoom}
                onChangeText={(value) =>
                  updateField('classRoom', value)
                }
              />

              <Text style={styles.label}>Hari dan Waktu</Text>
              <TextInput
                style={styles.input}
                placeholder="Contoh: Senin, 08.00 - 10.00 WIB"
                value={form.scheduleTime}
                onChangeText={(value) =>
                  updateField('scheduleTime', value)
                }
              />

              <View style={styles.modalActions}>
                <Pressable
                  style={styles.cancelButton}
                  onPress={closeModal}
                  disabled={saving}
                >
                  <Text style={styles.cancelButtonText}>Batal</Text>
                </Pressable>

                <Pressable
                  style={styles.saveButton}
                  onPress={handleSave}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.saveButtonText}>
                      {editingId ? 'Simpan Perubahan' : 'Simpan Jadwal'}
                    </Text>
                  )}
                </Pressable>
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
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    padding: 20,
    paddingTop: 30,
    paddingBottom: 40,
    flexGrow: 1,
  },
  header: {
    marginBottom: 20,
    gap: 9,
  },
  backText: {
    color: '#555555',
    fontSize: 15,
    fontWeight: '600',
  },
  title: {
    color: '#000000',
    fontSize: 27,
    fontWeight: '800',
    marginTop: 8,
  },
  subtitle: {
    color: '#666666',
    fontSize: 14,
    lineHeight: 21,
  },
  addButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#000000',
    borderRadius: 11,
    marginTop: 8,
    paddingHorizontal: 17,
    paddingVertical: 13,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 50,
  },
  emptyTitle: {
    color: '#222222',
    fontSize: 17,
    fontWeight: '700',
  },
  emptyText: {
    color: '#777777',
    fontSize: 13,
    lineHeight: 20,
    marginTop: 7,
    textAlign: 'center',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderColor: '#DDDDDD',
    borderRadius: 15,
    borderWidth: 1,
    padding: 16,
    gap: 8,
  },
  cardHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  scheduleName: {
    color: '#000000',
    flex: 1,
    fontSize: 16,
    fontWeight: '800',
  },
  classCode: {
    backgroundColor: '#EEEEEE',
    borderRadius: 7,
    color: '#333333',
    fontSize: 11,
    fontWeight: '700',
    overflow: 'hidden',
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  detail: {
    color: '#555555',
    fontSize: 13,
  },
  time: {
    color: '#000000',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 3,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 9,
    marginTop: 8,
  },
  editButton: {
    backgroundColor: '#EEEEEE',
    borderRadius: 9,
    flex: 1,
    alignItems: 'center',
    padding: 11,
  },
  editButtonText: {
    color: '#222222',
    fontSize: 13,
    fontWeight: '700',
  },
  deleteButton: {
    backgroundColor: '#FEE2E2',
    borderRadius: 9,
    flex: 1,
    alignItems: 'center',
    padding: 11,
  },
  deleteButtonText: {
    color: '#B91C1C',
    fontSize: 13,
    fontWeight: '700',
  },
  modalOverlay: {
    backgroundColor: 'rgba(0,0,0,0.45)',
    flex: 1,
    justifyContent: 'center',
    padding: 18,
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    maxHeight: '90%',
    padding: 20,
  },
  modalTitle: {
    color: '#000000',
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 18,
  },
  label: {
    color: '#222222',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
    marginTop: 13,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderColor: '#DDDDDD',
    borderRadius: 10,
    borderWidth: 1,
    color: '#000000',
    fontSize: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  classOptions: {
    gap: 8,
  },
  classOption: {
    borderColor: '#DDDDDD',
    borderRadius: 9,
    borderWidth: 1,
    padding: 12,
  },
  classOptionSelected: {
    backgroundColor: '#EEEEEE',
    borderColor: '#000000',
  },
  classOptionText: {
    color: '#444444',
    fontSize: 13,
  },
  classOptionTextSelected: {
    color: '#000000',
    fontWeight: '700',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 22,
    marginBottom: 5,
  },
  cancelButton: {
    alignItems: 'center',
    backgroundColor: '#EEEEEE',
    borderRadius: 10,
    flex: 1,
    padding: 13,
  },
  cancelButtonText: {
    color: '#222222',
    fontWeight: '700',
  },
  saveButton: {
    alignItems: 'center',
    backgroundColor: '#000000',
    borderRadius: 10,
    flex: 1,
    padding: 13,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
});