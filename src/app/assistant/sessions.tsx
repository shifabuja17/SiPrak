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
  subscribeSchedules,
  type PracticumSchedule,
} from '@/features/assistant/services/schedule-service';

import {
  createSession,
  deleteSession,
  subscribeSessions,
  updateSession,
  type SessionRecord,
  type SessionInput,
} from '@/features/assistant/services/session-service';

const EMPTY_FORM = {
  scheduleId: '',
  sessionNote: '',
};

export default function AssistantSessionsScreen() {
  const { profile, loading: authLoading } = useAuth();

  const [schedules, setSchedules] = useState<PracticumSchedule[]>([]);
  const [sessions, setSessions] = useState<SessionRecord[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [form, setForm] = useState(EMPTY_FORM);

  // Mengambil jadwal dan sesi dari Firestore secara real-time.
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

  function resetForm() {
    setForm(EMPTY_FORM);
  }

  function openCreateModal() {
    if (schedules.length === 0) {
      Alert.alert(
        'Jadwal belum tersedia',
        'Buat jadwal praktikum terlebih dahulu sebelum menambahkan sesi.',
      );
      return;
    }

    setEditingId(null);
    setForm({
      scheduleId: schedules[0].id,
      sessionNote: '',
    });

    setModalVisible(true);
  }

  function openEditModal(item: SessionRecord) {
    if (item.status !== 'dijadwalkan') {
      Alert.alert(
        'Sesi tidak dapat diedit',
        'Hanya sesi yang belum dibuka yang dapat diedit.',
      );
      return;
    }

    const scheduleExists = schedules.some(
      (schedule) => schedule.id === item.scheduleId,
    );

    if (!scheduleExists) {
      Alert.alert(
        'Jadwal tidak ditemukan',
        'Jadwal yang terhubung dengan sesi ini sudah tidak tersedia.',
      );
      return;
    }

    setEditingId(item.id);
    setForm({
      scheduleId: item.scheduleId,
      sessionNote: item.sessionNote || '',
    });

    setModalVisible(true);
  }

  function closeModal() {
    if (saving) return;

    setModalVisible(false);
    setEditingId(null);
    resetForm();
  }

  function getSelectedSchedule() {
    return schedules.find(
      (item) => item.id === form.scheduleId,
    );
  }

  async function handleSave() {
    if (!profile?.uid) {
      Alert.alert('Gagal', 'Identitas Asisten tidak ditemukan.');
      return;
    }

    const selectedSchedule = getSelectedSchedule();

    if (!selectedSchedule) {
      Alert.alert('Jadwal belum dipilih', 'Pilih jadwal praktikum.');
      return;
    }

    const input: SessionInput = {
      scheduleId: selectedSchedule.id,
      classId: selectedSchedule.classId,
      practicumName: selectedSchedule.practicumName,
      moduleTitle: selectedSchedule.moduleTitle,
      classRoom: selectedSchedule.classRoom,
      scheduleTime: selectedSchedule.scheduleTime,
      sessionNote: form.sessionNote.trim(),
    };

    try {
      setSaving(true);

      if (editingId) {
        await updateSession(editingId, input);
        Alert.alert('Berhasil', 'Sesi berhasil diperbarui.');
      } else {
        await createSession(input, profile.uid);
        Alert.alert('Berhasil', 'Sesi berhasil ditambahkan.');
      }

      setModalVisible(false);
      setEditingId(null);
      resetForm();
    } catch (firebaseError) {
      console.error('Gagal menyimpan sesi:', firebaseError);

      Alert.alert(
        'Gagal',
        firebaseError instanceof Error
          ? firebaseError.message
          : 'Sesi tidak berhasil disimpan.',
      );
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete(item: SessionRecord) {
    Alert.alert(
      'Hapus Sesi',
      `Yakin ingin menghapus sesi "${item.practicumName}"?`,
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

  async function handleDelete(sessionId: string) {
    try {
      await deleteSession(sessionId);
      Alert.alert('Berhasil', 'Sesi berhasil dihapus.');
    } catch (firebaseError) {
      console.error('Gagal menghapus sesi:', firebaseError);

      Alert.alert(
        'Tidak dapat menghapus sesi',
        firebaseError instanceof Error
          ? firebaseError.message
          : 'Terjadi kesalahan saat menghapus sesi.',
      );
    }
  }

  function renderSession({ item }: { item: SessionRecord }) {
    const selectedSchedule = schedules.find(
      (schedule) => schedule.id === item.scheduleId,
    );

    const isEditable = item.status === 'dijadwalkan';

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
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
            <Text style={styles.statusText}>
              {item.status === 'dijadwalkan'
                ? 'BELUM DIBUKA'
                : item.status === 'dibuka'
                  ? 'BERLANGSUNG'
                  : 'SELESAI'}
            </Text>
          </View>
        </View>

        <Text style={styles.detail}>
          Modul: {item.moduleTitle}
        </Text>

        <Text style={styles.detail}>
          Kelas: {selectedSchedule?.classId === item.classId
            ? item.classRoom
            : item.classRoom}
        </Text>

        <Text style={styles.detail}>
          Jadwal: {item.scheduleTime}
        </Text>

        <Text style={styles.detail}>
          Catatan: {item.sessionNote || '-'}
        </Text>

        {isEditable ? (
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
        ) : (
          <Text style={styles.lockedText}>
            Sesi sudah dimulai atau selesai. Edit dan hapus dinonaktifkan.
          </Text>
        )}
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />

      <FlatList
        data={sessions}
        keyExtractor={(item) => item.id}
        renderItem={renderSession}
        contentContainerStyle={styles.content}
        ItemSeparatorComponent={() => (
          <View style={{ height: 12 }} />
        )}
        ListHeaderComponent={
          <View style={styles.header}>
            <Pressable onPress={() => router.back()}>
              <Text style={styles.backText}>‹ Kembali</Text>
            </Pressable>

            <Text style={styles.title}>Manajemen Sesi</Text>

            <Text style={styles.subtitle}>
              Buat dan kelola sesi berdasarkan jadwal praktikum.
            </Text>

            <Pressable
              style={styles.addButton}
              onPress={openCreateModal}
            >
              <Text style={styles.addButtonText}>
                + Tambah Sesi
              </Text>
            </Pressable>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            {loading ? (
              <ActivityIndicator size="large" color="#000000" />
            ) : (
              <>
                <Text style={styles.emptyTitle}>
                  {error ? 'Terjadi Kesalahan' : 'Belum Ada Sesi'}
                </Text>

                <Text style={styles.emptyText}>
                  {error || 'Tekan Tambah Sesi untuk membuat sesi praktikum.'}
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
                {editingId ? 'Edit Sesi' : 'Tambah Sesi'}
              </Text>

              <Text style={styles.label}>Pilih Jadwal Praktikum</Text>

              <View style={styles.scheduleOptions}>
                {schedules.map((item) => {
                  const selected = form.scheduleId === item.id;

                  return (
                    <Pressable
                      key={item.id}
                      style={[
                        styles.scheduleOption,
                        selected && styles.scheduleOptionSelected,
                      ]}
                      onPress={() =>
                        setForm((previous) => ({
                          ...previous,
                          scheduleId: item.id,
                        }))
                      }
                    >
                      <Text
                        style={[
                          styles.scheduleOptionTitle,
                          selected && styles.scheduleOptionTitleSelected,
                        ]}
                      >
                        {item.practicumName}
                      </Text>

                      <Text style={styles.scheduleOptionDetail}>
                        {item.moduleTitle}
                      </Text>

                      <Text style={styles.scheduleOptionDetail}>
                        {item.scheduleTime}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={styles.label}>Catatan Sesi (Opsional)</Text>

              <TextInput
                style={styles.input}
                placeholder="Contoh: Praktikan wajib membawa laptop."
                value={form.sessionNote}
                onChangeText={(value) =>
                  setForm((previous) => ({
                    ...previous,
                    sessionNote: value,
                  }))
                }
                multiline
                numberOfLines={3}
                textAlignVertical="top"
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
                      {editingId ? 'Simpan Perubahan' : 'Simpan Sesi'}
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
    gap: 9,
  },
  cardHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  sessionName: {
    color: '#000000',
    flex: 1,
    fontSize: 16,
    fontWeight: '800',
  },
  statusBadge: {
    backgroundColor: '#EEEEEE',
    borderRadius: 7,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  openBadge: {
    backgroundColor: '#DCFCE7',
  },
  closedBadge: {
    backgroundColor: '#FEE2E2',
  },
  statusText: {
    color: '#333333',
    fontSize: 10,
    fontWeight: '800',
  },
  detail: {
    color: '#555555',
    fontSize: 13,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 9,
    marginTop: 8,
  },
  editButton: {
    alignItems: 'center',
    backgroundColor: '#EEEEEE',
    borderRadius: 9,
    flex: 1,
    padding: 11,
  },
  editButtonText: {
    color: '#222222',
    fontSize: 13,
    fontWeight: '700',
  },
  deleteButton: {
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    borderRadius: 9,
    flex: 1,
    padding: 11,
  },
  deleteButtonText: {
    color: '#B91C1C',
    fontSize: 13,
    fontWeight: '700',
  },
  lockedText: {
    color: '#777777',
    fontSize: 12,
    marginTop: 5,
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
  scheduleOptions: {
    gap: 9,
  },
  scheduleOption: {
    borderColor: '#DDDDDD',
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    gap: 5,
  },
  scheduleOptionSelected: {
    backgroundColor: '#EEEEEE',
    borderColor: '#000000',
  },
  scheduleOptionTitle: {
    color: '#222222',
    fontSize: 14,
    fontWeight: '700',
  },
  scheduleOptionTitleSelected: {
    color: '#000000',
  },
  scheduleOptionDetail: {
    color: '#666666',
    fontSize: 12,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderColor: '#DDDDDD',
    borderRadius: 10,
    borderWidth: 1,
    color: '#000000',
    fontSize: 14,
    minHeight: 90,
    paddingHorizontal: 12,
    paddingVertical: 12,
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