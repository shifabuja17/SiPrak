
import { useEffect, useMemo, useState } from 'react';
import { useLocalSearchParams, router } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
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

import { useAuth } from '@/context/AuthContext';

import {
  addMember,
  moveMemberToClass,
  removeMember,
  subscribeAvailablePraktikan,
  subscribeClassMembers,
  type AvailablePraktikan,
  type PracticumMember,
} from '@/features/assistant/services/member-service';

import {
  subscribeClasses,
  type PracticumClass,
} from '@/features/assistant/services/class-service';

export default function ClassMembersScreen() {
  const params = useLocalSearchParams<{
    classId: string;
  }>();

  const classId =
    typeof params.classId === 'string' ? params.classId : '';

  const { profile, loading: authLoading } = useAuth();

  const [currentClass, setCurrentClass] =
    useState<PracticumClass | null>(null);

  const [classes, setClasses] =
    useState<PracticumClass[]>([]);

  const [members, setMembers] =
    useState<PracticumMember[]>([]);

  const [availableUsers, setAvailableUsers] =
    useState<AvailablePraktikan[]>([]);

  const [classLoading, setClassLoading] = useState(true);
  const [memberLoading, setMemberLoading] = useState(true);
  const [userLoading, setUserLoading] = useState(true);

  const [error, setError] = useState('');

  const [addModalVisible, setAddModalVisible] =
    useState(false);

  const [moveModalVisible, setMoveModalVisible] =
    useState(false);

  const [selectedUid, setSelectedUid] = useState('');
  const [selectedTargetClass, setSelectedTargetClass] =
    useState('');

  const [movingMember, setMovingMember] =
    useState<PracticumMember | null>(null);

  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);

  // Memuat kelas, daftar anggota, dan akun praktikan.
  useEffect(() => {
    if (authLoading) return;

    if (!profile || profile.role !== 'asisten' || !classId) {
      setClassLoading(false);
      setMemberLoading(false);
      setUserLoading(false);
      return;
    }

    setClassLoading(true);
    setMemberLoading(true);
    setUserLoading(true);
    setError('');

    const unsubscribeClasses = subscribeClasses(
      (data) => {
        setClasses(data);

        const selectedClass = data.find(
          (item) => item.id === classId
        );

        setCurrentClass(selectedClass ?? null);
        setClassLoading(false);
      },
      (err) => {
        setError(err.message);
        setClassLoading(false);
      }
    );

    const unsubscribeMembers = subscribeClassMembers(
      classId,
      (data) => {
        setMembers(data);
        setMemberLoading(false);
      },
      (err) => {
        setError(err.message);
        setMemberLoading(false);
      }
    );

    const unsubscribeUsers = subscribeAvailablePraktikan(
      (data) => {
        setAvailableUsers(data);
        setUserLoading(false);
      },
      (err) => {
        setError(err.message);
        setUserLoading(false);
      }
    );

    return () => {
      unsubscribeClasses();
      unsubscribeMembers();
      unsubscribeUsers();
    };
  }, [profile, authLoading, classId]);

  // UID praktikan yang sudah tergabung di kelas ini.
  const memberIds = useMemo(
    () => new Set(members.map((member) => member.uid)),
    [members]
  );

  // Menampilkan praktikan yang belum tergabung.
  const eligibleUsers = useMemo(() => {
    return availableUsers.filter((user) => {
      const matchesSearch =
        user.nama.toLowerCase().includes(search.toLowerCase()) ||
        (user.nim ?? '').toLowerCase().includes(search.toLowerCase());

      return !memberIds.has(user.uid) && matchesSearch;
    });
  }, [availableUsers, memberIds, search]);

  // Kelas tujuan untuk pemindahan peserta.
  const targetClasses = classes.filter(
    (item) => item.id !== classId
  );

  function openAddModal() {
    setSelectedUid('');
    setSearch('');
    setError('');
    setAddModalVisible(true);
  }

  function openMoveModal(member: PracticumMember) {
    setMovingMember(member);
    setSelectedTargetClass('');
    setError('');
    setMoveModalVisible(true);
  }

  function closeAddModal() {
    if (saving) return;
    setAddModalVisible(false);
    setSelectedUid('');
    setSearch('');
    setError('');
  }

  function closeMoveModal() {
    if (saving) return;
    setMoveModalVisible(false);
    setMovingMember(null);
    setSelectedTargetClass('');
    setError('');
  }

  // Menambahkan anggota ke kelas.
  async function handleAddMember() {
    if (!selectedUid) {
      setError('Pilih praktikan terlebih dahulu.');
      return;
    }

    try {
      setSaving(true);
      setError('');

      await addMember(classId, selectedUid);

      setAddModalVisible(false);
      setSelectedUid('');
      setSearch('');
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Gagal menambahkan peserta.'
      );
    } finally {
      setSaving(false);
    }
  }

  // Mengeluarkan anggota dari kelas.
  function handleRemoveMember(member: PracticumMember) {
    Alert.alert(
      'Keluarkan Peserta?',
      `Keluarkan ${member.nama} dari kelas ${currentClass?.nama}?`,
      [
        {
          text: 'Batal',
          style: 'cancel',
        },
        {
          text: 'Keluarkan',
          style: 'destructive',
          onPress: async () => {
            try {
              setError('');
              await removeMember(classId, member.uid);
            } catch (err) {
              setError(
                err instanceof Error
                  ? err.message
                  : 'Gagal mengeluarkan peserta.'
              );
            }
          },
        },
      ]
    );
  }

  // Memindahkan anggota ke kelas lain.
  async function handleMoveMember() {
    if (!movingMember || !selectedTargetClass) {
      setError('Pilih kelas tujuan terlebih dahulu.');
      return;
    }

    try {
      setSaving(true);
      setError('');

      await moveMemberToClass(
        classId,
        selectedTargetClass,
        movingMember.uid
      );

      setMoveModalVisible(false);
      setMovingMember(null);
      setSelectedTargetClass('');
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Gagal memindahkan peserta.'
      );
    } finally {
      setSaving(false);
    }
  }

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

  if (!profile) {
    return (
      <SafeAreaView style={styles.centered}>
        <Text style={styles.emptyTitle}>Belum Login</Text>
        <Text style={styles.mutedText}>
          Silakan login terlebih dahulu.
        </Text>
      </SafeAreaView>
    );
  }

  if (profile.role !== 'asisten') {
    return (
      <SafeAreaView style={styles.centered}>
        <Text style={styles.emptyTitle}>Akses Ditolak</Text>
        <Text style={styles.mutedText}>
          Halaman ini hanya dapat diakses oleh Asisten.
        </Text>
      </SafeAreaView>
    );
  }

  const loading =
    classLoading || memberLoading || userLoading;

  if (!loading && !currentClass) {
    return (
      <SafeAreaView style={styles.centered}>
        <Text style={styles.emptyTitle}>
          Kelas Tidak Ditemukan
        </Text>

        <Pressable
          style={styles.primaryButton}
          onPress={() => router.back()}
        >
          <Text style={styles.primaryButtonText}>
            Kembali
          </Text>
        </Pressable>
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
            Kelola Peserta
          </Text>

          <Text style={styles.subtitle}>
            {currentClass?.nama ?? 'Memuat kelas...'}
          </Text>
        </View>

        {currentClass ? (
          <View style={styles.classInfo}>
            <View style={styles.classCode}>
              <Text style={styles.classCodeText}>
                {currentClass.kode}
              </Text>
            </View>

            <Text style={styles.classDescription}>
              {currentClass.deskripsi || 'Tidak ada deskripsi.'}
            </Text>
          </View>
        ) : null}

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>
              {error}
            </Text>
          </View>
        ) : null}

        <View style={styles.summary}>
          <View>
            <Text style={styles.summaryNumber}>
              {members.length}
            </Text>
            <Text style={styles.summaryLabel}>
              Total Peserta
            </Text>
          </View>

          <Pressable
            style={styles.primaryButton}
            onPress={openAddModal}
            disabled={loading}
          >
            <Text style={styles.primaryButtonText}>
              + Tambah Peserta
            </Text>
          </Pressable>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            Daftar Anggota
          </Text>

          <Text style={styles.totalText}>
            {members.length} orang
          </Text>
        </View>

        {loading ? (
          <View style={styles.centeredContent}>
            <ActivityIndicator size="large" color="#000000" />
            <Text style={styles.mutedText}>
              Memuat data peserta...
            </Text>
          </View>
        ) : members.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>
              Belum Ada Peserta
            </Text>

            <Text style={styles.mutedText}>
              Tambahkan praktikan agar terdaftar sebagai anggota kelas ini.
            </Text>
          </View>
        ) : (
          members.map((member) => (
            <View key={member.uid} style={styles.memberCard}>
              <View style={styles.memberIdentity}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {member.nama.charAt(0).toUpperCase()}
                  </Text>
                </View>

                <View style={styles.memberDetails}>
                  <Text style={styles.memberName}>
                    {member.nama}
                  </Text>

                  <Text style={styles.memberNim}>
                    {member.nim || 'NIM belum tersedia'}
                  </Text>

                  <Text style={styles.memberDate}>
                    Bergabung: {member.joinedAt
                      ? member.joinedAt.toDate().toLocaleDateString('id-ID')
                      : 'Baru ditambahkan'}
                  </Text>
                </View>
              </View>

              <View style={styles.memberActions}>
                <Pressable
                  style={styles.moveButton}
                  onPress={() => openMoveModal(member)}
                >
                  <Text style={styles.moveText}>
                    Pindah
                  </Text>
                </Pressable>

                <Pressable
                  style={styles.removeButton}
                  onPress={() => handleRemoveMember(member)}
                >
                  <Text style={styles.removeText}>
                    Keluarkan
                  </Text>
                </Pressable>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* Modal tambah peserta */}
      <Modal
        visible={addModalVisible}
        transparent
        animationType="slide"
        onRequestClose={closeAddModal}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              Tambah Peserta
            </Text>

            <Text style={styles.modalSubtitle}>
              Pilih akun praktikan yang akan ditambahkan ke kelas.
            </Text>

            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Cari nama atau NIM..."
              placeholderTextColor="#888888"
              style={styles.input}
              editable={!saving}
            />

            <ScrollView
              style={styles.selectionList}
              keyboardShouldPersistTaps="handled"
            >
              {userLoading ? (
                <ActivityIndicator
                  size="large"
                  color="#000000"
                />
              ) : eligibleUsers.length === 0 ? (
                <Text style={styles.mutedText}>
                  Tidak ada praktikan yang tersedia.
                </Text>
              ) : (
                eligibleUsers.map((user) => {
                  const selected = selectedUid === user.uid;

                  return (
                    <Pressable
                      key={user.uid}
                      style={[
                        styles.userOption,
                        selected && styles.selectedOption,
                      ]}
                      onPress={() => setSelectedUid(user.uid)}
                    >
                      <View style={styles.avatar}>
                        <Text style={styles.avatarText}>
                          {user.nama.charAt(0).toUpperCase()}
                        </Text>
                      </View>

                      <View style={styles.memberDetails}>
                        <Text style={styles.memberName}>
                          {user.nama}
                        </Text>

                        <Text style={styles.memberNim}>
                          {user.nim || user.email || 'NIM tidak tersedia'}
                        </Text>
                      </View>

                      <View style={[
                        styles.radio,
                        selected && styles.radioSelected,
                      ]}>
                        {selected ? (
                          <View style={styles.radioInner} />
                        ) : null}
                      </View>
                    </Pressable>
                  );
                })
              )}
            </ScrollView>

            {error ? (
              <Text style={styles.modalError}>
                {error}
              </Text>
            ) : null}

            <View style={styles.modalActions}>
              <Pressable
                style={styles.cancelButton}
                onPress={closeAddModal}
                disabled={saving}
              >
                <Text style={styles.cancelText}>
                  Batal
                </Text>
              </Pressable>

              <Pressable
                style={[
                  styles.primaryButton,
                  (!selectedUid || saving) && styles.disabledButton,
                ]}
                onPress={handleAddMember}
                disabled={!selectedUid || saving}
              >
                {saving ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.primaryButtonText}>
                    Tambahkan
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal pindah kelas */}
      <Modal
        visible={moveModalVisible}
        transparent
        animationType="slide"
        onRequestClose={closeMoveModal}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              Pindahkan Peserta
            </Text>

            <Text style={styles.modalSubtitle}>
              {movingMember?.nama} akan dipindahkan dari kelas ini ke kelas tujuan.
            </Text>

            <ScrollView style={styles.selectionList}>
              {targetClasses.length === 0 ? (
                <Text style={styles.mutedText}>
                  Belum ada kelas tujuan.
                </Text>
              ) : (
                targetClasses.map((item) => {
                  const selected = selectedTargetClass === item.id;

                  return (
                    <Pressable
                      key={item.id}
                      style={[
                        styles.userOption,
                        selected && styles.selectedOption,
                      ]}
                      onPress={() => setSelectedTargetClass(item.id)}
                    >
                      <View style={styles.memberDetails}>
                        <Text style={styles.memberName}>
                          {item.nama}
                        </Text>

                        <Text style={styles.memberNim}>
                          {item.kode}
                        </Text>
                      </View>

                      <View style={[
                        styles.radio,
                        selected && styles.radioSelected,
                      ]}>
                        {selected ? (
                          <View style={styles.radioInner} />
                        ) : null}
                      </View>
                    </Pressable>
                  );
                })
              )}
            </ScrollView>

            {error ? (
              <Text style={styles.modalError}>
                {error}
              </Text>
            ) : null}

            <View style={styles.modalActions}>
              <Pressable
                style={styles.cancelButton}
                onPress={closeMoveModal}
                disabled={saving}
              >
                <Text style={styles.cancelText}>
                  Batal
                </Text>
              </Pressable>

              <Pressable
                style={[
                  styles.primaryButton,
                  (!selectedTargetClass || saving) && styles.disabledButton,
                ]}
                onPress={handleMoveMember}
                disabled={!selectedTargetClass || saving}
              >
                {saving ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.primaryButtonText}>
                    Pindahkan
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

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: '#FFFFFF',
    flex: 1,
  },
  content: {
    padding: 20,
    paddingTop: 35,
    paddingBottom: 45,
    gap: 16,
  },
  centered: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    flex: 1,
    justifyContent: 'center',
    padding: 25,
    gap: 12,
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
  classInfo: {
    backgroundColor: '#F2F2F2',
    borderRadius: 14,
    padding: 15,
    gap: 8,
  },
  classCode: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderRadius: 7,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  classCodeText: {
    color: '#000000',
    fontSize: 11,
    fontWeight: '800',
  },
  classDescription: {
    color: '#666666',
    fontSize: 13,
    lineHeight: 19,
  },
  summary: {
    alignItems: 'center',
    backgroundColor: '#F2F2F2',
    borderRadius: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 15,
  },
  summaryNumber: {
    color: '#000000',
    fontSize: 25,
    fontWeight: '800',
  },
  summaryLabel: {
    color: '#666666',
    fontSize: 12,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#000000',
    borderRadius: 10,
    justifyContent: 'center',
    paddingHorizontal: 15,
    paddingVertical: 12,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    color: '#000000',
    fontSize: 18,
    fontWeight: '800',
  },
  totalText: {
    color: '#666666',
    fontSize: 12,
  },
  memberCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#D9D9D9',
    borderRadius: 15,
    borderWidth: 1,
    padding: 14,
    gap: 14,
  },
  memberIdentity: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  avatar: {
    alignItems: 'center',
    backgroundColor: '#E5E5E5',
    borderRadius: 20,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  avatarText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '800',
  },
  memberDetails: {
    flex: 1,
    gap: 3,
  },
  memberName: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '700',
  },
  memberNim: {
    color: '#666666',
    fontSize: 12,
  },
  memberDate: {
    color: '#888888',
    fontSize: 11,
  },
  memberActions: {
    flexDirection: 'row',
    gap: 9,
  },
  moveButton: {
    alignItems: 'center',
    borderColor: '#000000',
    borderRadius: 9,
    borderWidth: 1,
    flex: 1,
    padding: 10,
  },
  moveText: {
    color: '#000000',
    fontSize: 12,
    fontWeight: '700',
  },
  removeButton: {
    alignItems: 'center',
    backgroundColor: '#EEEEEE',
    borderRadius: 9,
    flex: 1,
    padding: 10,
  },
  removeText: {
    color: '#000000',
    fontSize: 12,
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
  disabledButton: {
    opacity: 0.5,
  },
  modalBackdrop: {
    backgroundColor: 'rgba(0,0,0,0.45)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    maxHeight: '85%',
    padding: 22,
    paddingBottom: 30,
    gap: 12,
  },
  modalTitle: {
    color: '#000000',
    fontSize: 21,
    fontWeight: '800',
  },
  modalSubtitle: {
    color: '#666666',
    fontSize: 13,
    lineHeight: 19,
  },
  input: {
    borderColor: '#CCCCCC',
    borderRadius: 10,
    borderWidth: 1,
    color: '#000000',
    fontSize: 14,
    padding: 12,
  },
  selectionList: {
    maxHeight: 300,
  },
  userOption: {
    alignItems: 'center',
    borderColor: '#DDDDDD',
    borderRadius: 11,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    marginBottom: 9,
    padding: 12,
  },
  selectedOption: {
    backgroundColor: '#F2F2F2',
    borderColor: '#000000',
  },
  radio: {
    alignItems: 'center',
    borderColor: '#999999',
    borderRadius: 11,
    borderWidth: 1.5,
    height: 22,
    justifyContent: 'center',
    width: 22,
  },
  radioSelected: {
    borderColor: '#000000',
  },
  radioInner: {
    backgroundColor: '#000000',
    borderRadius: 5,
    height: 10,
    width: 10,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
  },
  cancelButton: {
    alignItems: 'center',
    borderColor: '#CCCCCC',
    borderRadius: 10,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    padding: 13,
  },
  cancelText: {
    color: '#000000',
    fontSize: 13,
    fontWeight: '700',
  },
  modalError: {
    color: '#B91C1C',
    fontSize: 12,
    lineHeight: 18,
  },
});