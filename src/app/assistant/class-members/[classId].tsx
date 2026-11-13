import { useEffect, useMemo, useState } from 'react';
import { useLocalSearchParams, router } from 'expo-router';

import {
  ActivityIndicator,
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

import AssistantHeader from '@/components/common/AssistantHeader';

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

  // DATA
  const [currentClass, setCurrentClass] =
    useState<PracticumClass | null>(null);

  const [classes, setClasses] =
    useState<PracticumClass[]>([]);

  const [members, setMembers] =
    useState<PracticumMember[]>([]);

  const [availableUsers, setAvailableUsers] =
    useState<AvailablePraktikan[]>([]);

  // LOADING
  const [classLoading, setClassLoading] = useState(true);
  const [memberLoading, setMemberLoading] = useState(true);
  const [userLoading, setUserLoading] = useState(true);

  // ERROR
  const [pageError, setPageError] = useState('');
  const [modalError, setModalError] = useState('');
  const [removeError, setRemoveError] = useState('');

  // MODAL
  const [addModalVisible, setAddModalVisible] =
    useState(false);

  const [moveModalVisible, setMoveModalVisible] =
    useState(false);

  const [selectedUid, setSelectedUid] = useState('');
  const [selectedTargetClass, setSelectedTargetClass] =
    useState('');

  const [movingMember, setMovingMember] =
    useState<PracticumMember | null>(null);

  const [removeTarget, setRemoveTarget] =
    useState<PracticumMember | null>(null);

  // INPUT DAN PROSES
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);

  // ==========================================
  // SUBSCRIBE DATA FIRESTORE REAL-TIME
  // ==========================================

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
    setPageError('');

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
        setPageError(err.message);
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
        setPageError(err.message);
        setMemberLoading(false);
      }
    );

    const unsubscribeUsers = subscribeAvailablePraktikan(
      (data) => {
        setAvailableUsers(data);
        setUserLoading(false);
      },
      (err) => {
        setPageError(err.message);
        setUserLoading(false);
      }
    );

    return () => {
      unsubscribeClasses();
      unsubscribeMembers();
      unsubscribeUsers();
    };
  }, [profile, authLoading, classId]);

  // ==========================================
  // FILTER DATA PESERTA
  // ==========================================

  const memberIds = useMemo(
    () => new Set(members.map((member) => member.uid)),
    [members]
  );

  const eligibleUsers = useMemo(() => {
    return availableUsers.filter((user) => {
      const keyword = search.toLowerCase();

      const matchesSearch =
        user.nama.toLowerCase().includes(keyword) ||
        (user.nim ?? '').toLowerCase().includes(keyword);

      return !memberIds.has(user.uid) && matchesSearch;
    });
  }, [availableUsers, memberIds, search]);

  // KELAS TUJUAN PINDAH PESERTA
  const targetClasses = classes.filter(
    (item) => item.id !== classId
  );

  const loading =
    classLoading || memberLoading || userLoading;

  // ==========================================
  // MODAL TAMBAH PESERTA
  // ==========================================

  function openAddModal() {
    setSelectedUid('');
    setSearch('');
    setModalError('');
    setAddModalVisible(true);
  }

  function closeAddModal() {
    if (saving) return;

    setAddModalVisible(false);
    setSelectedUid('');
    setSearch('');
    setModalError('');
  }

  // ==========================================
  // TAMBAH PESERTA KE KELAS
  // ==========================================

  async function handleAddMember() {
    if (!selectedUid) {
      setModalError('Pilih praktikan terlebih dahulu.');
      return;
    }

    try {
      setSaving(true);
      setModalError('');

      await addMember(classId, selectedUid);

      setAddModalVisible(false);
      setSelectedUid('');
      setSearch('');

    } catch (err) {
      setModalError(
        err instanceof Error
          ? err.message
          : 'Gagal menambahkan peserta.'
      );
    } finally {
      setSaving(false);
    }
  }

  // ==========================================
  // MODAL PINDAH KELAS
  // ==========================================

  function openMoveModal(member: PracticumMember) {
    setMovingMember(member);
    setSelectedTargetClass('');
    setModalError('');
    setMoveModalVisible(true);
  }

  function closeMoveModal() {
    if (saving) return;

    setMoveModalVisible(false);
    setMovingMember(null);
    setSelectedTargetClass('');
    setModalError('');
  }

  // ==========================================
  // PINDAHKAN PESERTA KE KELAS LAIN
  // ==========================================

  async function handleMoveMember() {
    if (!movingMember || !selectedTargetClass) {
      setModalError('Pilih kelas tujuan terlebih dahulu.');
      return;
    }

    try {
      setSaving(true);
      setModalError('');

      await moveMemberToClass(
        classId,
        selectedTargetClass,
        movingMember.uid
      );

      setMoveModalVisible(false);
      setMovingMember(null);
      setSelectedTargetClass('');

    } catch (err) {
      setModalError(
        err instanceof Error
          ? err.message
          : 'Gagal memindahkan peserta.'
      );
    } finally {
      setSaving(false);
    }
  }

  // ==========================================
  // MODAL KONFIRMASI KELUARKAN PESERTA
  // ==========================================

  function handleRemoveMember(member: PracticumMember) {
    setRemoveError('');
    setRemoveTarget(member);
  }

  function closeRemoveModal() {
    if (removing) return;

    setRemoveTarget(null);
    setRemoveError('');
  }

  // ==========================================
  // PROSES KELUARKAN PESERTA
  // ==========================================

  async function confirmRemoveMember() {
    if (!removeTarget) return;

    try {
      setRemoving(true);
      setRemoveError('');

      await removeMember(classId, removeTarget.uid);

      setRemoveTarget(null);
      setRemoveError('');

    } catch (err) {
      setRemoveError(
        err instanceof Error
          ? err.message
          : 'Gagal mengeluarkan peserta.'
      );
    } finally {
      setRemoving(false);
    }
  }

  // ==========================================
  // PEMERIKSAAN AUTENTIKASI
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

  if (!profile) {
    return (
      <SafeAreaView style={styles.centered}>
        <Text style={styles.emptyTitle}>
          Belum Login
        </Text>

        <Text style={styles.mutedText}>
          Silakan login terlebih dahulu.
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

  // ==========================================
  // TAMPILAN UTAMA KELOLA PESERTA
  // ==========================================

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar
        barStyle="light-content"
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
              Kelola Peserta
            </Text>

            <Text style={styles.subtitle}>
              Atur keanggotaan praktikan dalam kelas.
            </Text>
          </View>

          {/* INFORMASI KELAS */}
          {currentClass ? (
            <View style={styles.classInfo}>
              <View style={styles.classInfoHeader}>
                <View style={styles.classCode}>
                  <Text style={styles.classCodeText}>
                    {currentClass.kode}
                  </Text>
                </View>

                <Text style={styles.classInfoLabel}>
                  KELAS PRAKTIKUM
                </Text>
              </View>

              <Text style={styles.className}>
                {currentClass.nama}
              </Text>

              <Text style={styles.classDescription}>
                {currentClass.deskripsi || 'Tidak ada deskripsi.'}
              </Text>
            </View>
          ) : null}

          {/* PESAN ERROR HALAMAN */}
          {pageError ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>
                {pageError}
              </Text>
            </View>
          ) : null}

          {/* RINGKASAN PESERTA */}
          <View style={styles.summary}>
            <View style={styles.summaryInfo}>
              <Text style={styles.summaryNumber}>
                {members.length}
              </Text>

              <Text style={styles.summaryLabel}>
                Total Peserta
              </Text>
            </View>

            <Pressable
              style={({ pressed }) => [
                styles.primaryButton,
                pressed && styles.pressed,
                loading && styles.disabledButton,
              ]}
              onPress={openAddModal}
              disabled={loading}
            >
              <Text style={styles.primaryButtonText}>
                + Tambah Peserta
              </Text>
            </Pressable>
          </View>

          {/* DAFTAR ANGGOTA */}
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>
                Daftar Anggota
              </Text>

              <Text style={styles.sectionCaption}>
                Praktikan yang terdaftar di kelas ini.
              </Text>
            </View>

            <View style={styles.totalBadge}>
              <Text style={styles.totalText}>
                {members.length} orang
              </Text>
            </View>
          </View>

          {/* LOADING */}
          {loading ? (
            <View style={styles.centeredContent}>
              <ActivityIndicator
                size="large"
                color="#000000"
              />

              <Text style={styles.mutedText}>
                Memuat data peserta...
              </Text>
            </View>

          ) : members.length === 0 ? (

            /* PESERTA KOSONG */
            <View style={styles.emptyCard}>
              <View style={styles.emptyIcon}>
                <Text style={styles.emptyIconText}>
                  +
                </Text>
              </View>

              <Text style={styles.emptyTitle}>
                Belum Ada Peserta
              </Text>

              <Text style={styles.mutedText}>
                Tambahkan praktikan agar terdaftar sebagai
                anggota kelas ini.
              </Text>
            </View>

          ) : (

            /* DAFTAR KARTU PESERTA */
            members.map((member) => {
              const initials = member.nama
                .trim()
                .split(/\s+/)
                .slice(0, 2)
                .map((part) => part.charAt(0).toUpperCase())
                .join('');

              const joinedDate = member.joinedAt
                ? member.joinedAt.toDate().toLocaleDateString('id-ID', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })
                : 'Baru ditambahkan';

              return (
                <View
                  key={member.uid}
                  style={styles.memberCard}
                >

                  {/* IDENTITAS PESERTA */}
                  <View style={styles.memberIdentity}>
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>
                        {initials || '?'}
                      </Text>
                    </View>

                    <View style={styles.memberDetails}>
                      <Text
                        style={styles.memberName}
                        numberOfLines={2}
                      >
                        {member.nama}
                      </Text>

                      <Text style={styles.memberNim}>
                        {member.nim || 'NIM belum tersedia'}
                      </Text>

                      <Text style={styles.memberDate}>
                        Bergabung {joinedDate}
                      </Text>
                    </View>
                  </View>

                  {/* TOMBOL AKSI */}
                  <View style={styles.memberActions}>
                    <Pressable
                      style={({ pressed }) => [
                        styles.moveButton,
                        pressed && styles.pressed,
                      ]}
                      onPress={() => openMoveModal(member)}
                    >
                      <Text style={styles.moveText}>
                        Pindah Kelas
                      </Text>
                    </Pressable>

                    <Pressable
                      style={({ pressed }) => [
                        styles.removeButton,
                        pressed && styles.pressed,
                      ]}
                      onPress={() => handleRemoveMember(member)}
                    >
                      <Text style={styles.removeText}>
                        Keluarkan
                      </Text>
                    </Pressable>
                  </View>
                </View>
              );
            })
          )}

        </View>
      </ScrollView>

      {/* =====================================
          MODAL TAMBAH PESERTA
      ===================================== */}

      <Modal
        visible={addModalVisible}
        transparent
        animationType="slide"
        onRequestClose={closeAddModal}
        statusBarTranslucent
      >
        <KeyboardAvoidingView
          style={styles.modalKeyboard}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalBackdrop}>

            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={closeAddModal}
              disabled={saving}
            />

            <View style={styles.modalCard}>

              <View style={styles.modalHandle} />

              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  Tambah Peserta
                </Text>

                <Text style={styles.modalSubtitle}>
                  Pilih akun praktikan yang akan ditambahkan
                  ke kelas ini.
                </Text>
              </View>

              {/* PENCARIAN PRAKTIKAN */}
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Cari nama atau NIM..."
                placeholderTextColor="#888888"
                style={styles.input}
                editable={!saving}
              />

              {/* DAFTAR PRAKTIKAN */}
              <ScrollView
                style={styles.selectionList}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                {userLoading ? (
                  <View style={styles.modalLoading}>
                    <ActivityIndicator
                      size="large"
                      color="#000000"
                    />

                    <Text style={styles.mutedText}>
                      Memuat daftar praktikan...
                    </Text>
                  </View>

                ) : eligibleUsers.length === 0 ? (

                  <View style={styles.modalEmpty}>
                    <Text style={styles.emptyTitle}>
                      Praktikan Tidak Ditemukan
                    </Text>

                    <Text style={styles.mutedText}>
                      Tidak ada praktikan yang tersedia
                      atau cocok dengan pencarian.
                    </Text>
                  </View>

                ) : (

                  eligibleUsers.map((user) => {
                    const selected = selectedUid === user.uid;

                    const initials = user.nama
                      .trim()
                      .split(/\s+/)
                      .slice(0, 2)
                      .map((part) => part.charAt(0).toUpperCase())
                      .join('');

                    return (
                      <Pressable
                        key={user.uid}
                        style={[
                          styles.userOption,
                          selected && styles.selectedOption,
                        ]}
                        onPress={() => {
                          setSelectedUid(user.uid);
                          setModalError('');
                        }}
                      >
                        <View style={styles.avatar}>
                          <Text style={styles.avatarText}>
                            {initials || '?'}
                          </Text>
                        </View>

                        <View style={styles.memberDetails}>
                          <Text
                            style={styles.memberName}
                            numberOfLines={1}
                          >
                            {user.nama}
                          </Text>

                          <Text
                            style={styles.memberNim}
                            numberOfLines={1}
                          >
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

              {modalError ? (
                <Text style={styles.modalError}>
                  {modalError}
                </Text>
              ) : null}

              {/* TOMBOL TAMBAH */}
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
        </KeyboardAvoidingView>
      </Modal>

      {/* =====================================
          MODAL PINDAHKAN PESERTA
      ===================================== */}

      <Modal
        visible={moveModalVisible}
        transparent
        animationType="slide"
        onRequestClose={closeMoveModal}
        statusBarTranslucent
      >
        <View style={styles.modalBackdrop}>

          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={closeMoveModal}
            disabled={saving}
          />

          <View style={styles.modalCard}>

            <View style={styles.modalHandle} />

            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Pindahkan Peserta
              </Text>

              <Text style={styles.modalSubtitle}>
                Pilih kelas tujuan untuk {movingMember?.nama}.
              </Text>
            </View>

            <ScrollView
              style={styles.selectionList}
              showsVerticalScrollIndicator={false}
            >
              {targetClasses.length === 0 ? (
                <View style={styles.modalEmpty}>
                  <Text style={styles.emptyTitle}>
                    Belum Ada Kelas Tujuan
                  </Text>

                  <Text style={styles.mutedText}>
                    Buat kelas lain terlebih dahulu untuk
                    memindahkan peserta.
                  </Text>
                </View>

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
                      onPress={() => {
                        setSelectedTargetClass(item.id);
                        setModalError('');
                      }}
                    >
                      <View style={styles.classOptionIcon}>
                        <Text style={styles.classOptionInitial}>
                          {item.kode.slice(0, 2).toUpperCase()}
                        </Text>
                      </View>

                      <View style={styles.memberDetails}>
                        <Text
                          style={styles.memberName}
                          numberOfLines={2}
                        >
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

            {modalError ? (
              <Text style={styles.modalError}>
                {modalError}
              </Text>
            ) : null}

            {/* TOMBOL PINDAH */}
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

      {/* =====================================
          MODAL KONFIRMASI KELUARKAN PESERTA
      ===================================== */}

      <Modal
        visible={removeTarget !== null}
        transparent
        animationType="fade"
        onRequestClose={closeRemoveModal}
        statusBarTranslucent
      >
        <View style={styles.confirmBackdrop}>

          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={closeRemoveModal}
            disabled={removing}
          />

          <View style={styles.confirmCard}>

            <Text style={styles.confirmTitle}>
              Keluarkan Peserta?
            </Text>

            <Text style={styles.confirmDescription}>
              Apakah kamu yakin ingin mengeluarkan peserta
              ini dari kelas {currentClass?.nama}?
            </Text>

            {removeTarget ? (
              <View style={styles.deleteMemberInfo}>
                <Text style={styles.deleteMemberName}>
                  {removeTarget.nama}
                </Text>

                <Text style={styles.deleteMemberNim}>
                  {removeTarget.nim || 'NIM belum tersedia'}
                </Text>
              </View>
            ) : null}

            {removeError ? (
              <Text style={styles.deleteErrorText}>
                {removeError}
              </Text>
            ) : null}

            <View style={styles.confirmActions}>
              <Pressable
                style={styles.cancelConfirmButton}
                onPress={closeRemoveModal}
                disabled={removing}
              >
                <Text style={styles.cancelConfirmText}>
                  Batal
                </Text>
              </Pressable>

              <Pressable
                style={[
                  styles.deleteConfirmButton,
                  removing && styles.disabledButton,
                ]}
                onPress={confirmRemoveMember}
                disabled={removing}
              >
                {removing ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.deleteConfirmText}>
                    Keluarkan
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
// STYLE KELOLA PESERTA
// ==========================================

const styles = StyleSheet.create({

  // HALAMAN UTAMA
  safeArea: {
    backgroundColor: '#F7F7F9',
    flex: 1,
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
    gap: 12,
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
    color: '#000000',
    fontSize: 27,
    fontWeight: '800',
  },

  subtitle: {
    color: '#666666',
    fontSize: 13,
    lineHeight: 20,
  },

  // INFORMASI KELAS
  classInfo: {
    backgroundColor: '#EEEEF1',
    borderRadius: 18,
    padding: 17,
    gap: 10,
  },

  classInfoHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  classInfoLabel: {
    color: '#777777',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.7,
  },

  classCode: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },

  classCodeText: {
    color: '#000000',
    fontSize: 11,
    fontWeight: '800',
  },

  className: {
    color: '#000000',
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 24,
  },

  classDescription: {
    color: '#666666',
    fontSize: 12,
    lineHeight: 19,
  },

  // RINGKASAN PESERTA
  summary: {
    alignItems: 'center',
    backgroundColor: '#EEEEF1',
    borderRadius: 17,
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 17,
  },

  summaryInfo: {
    gap: 2,
  },

  summaryNumber: {
    color: '#000000',
    fontSize: 29,
    fontWeight: '800',
  },

  summaryLabel: {
    color: '#666666',
    fontSize: 12,
  },

  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#000000',
    borderRadius: 11,
    justifyContent: 'center',
    paddingHorizontal: 15,
    paddingVertical: 13,
  },

  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },

  // DAFTAR ANGGOTA
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

  sectionCaption: {
    color: '#777777',
    fontSize: 11,
    marginTop: 4,
  },

  totalBadge: {
    backgroundColor: '#EAEAEA',
    borderRadius: 20,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },

  totalText: {
    color: '#333333',
    fontSize: 11,
    fontWeight: '700',
  },

  // KARTU PESERTA
  memberCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E5E5E5',
    borderRadius: 17,
    borderWidth: 1,
    gap: 15,
    padding: 16,
  },

  memberIdentity: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },

  avatar: {
    alignItems: 'center',
    backgroundColor: '#E5E5E9',
    borderRadius: 24,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },

  avatarText: {
    color: '#000000',
    fontSize: 17,
    fontWeight: '800',
  },

  memberDetails: {
    flex: 1,
    gap: 4,
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

  // TOMBOL AKSI PESERTA
  memberActions: {
    flexDirection: 'row',
    gap: 10,
  },

  moveButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#CCCCCC',
    borderRadius: 10,
    borderWidth: 1,
    flex: 1,
    padding: 11,
  },

  moveText: {
    color: '#000000',
    fontSize: 12,
    fontWeight: '700',
  },

  removeButton: {
    alignItems: 'center',
    backgroundColor: '#EEEEEE',
    borderRadius: 10,
    flex: 1,
    padding: 11,
  },

  removeText: {
    color: '#333333',
    fontSize: 12,
    fontWeight: '700',
  },

  // KELAS TUJUAN
  classOptionIcon: {
    alignItems: 'center',
    backgroundColor: '#EEEEEE',
    borderRadius: 11,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },

  classOptionInitial: {
    color: '#000000',
    fontSize: 12,
    fontWeight: '800',
  },

  // KONDISI KOSONG
  emptyCard: {
    alignItems: 'center',
    backgroundColor: '#EEEEF1',
    borderRadius: 18,
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

  emptyIconText: {
    color: '#000000',
    fontSize: 28,
    fontWeight: '500',
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

  // ERROR
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

  disabledButton: {
    opacity: 0.5,
  },

  pressed: {
    opacity: 0.65,
  },

  // ==========================================
  // MODAL UMUM
  // ==========================================

  modalKeyboard: {
    flex: 1,
  },

  modalBackdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },

  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 23,
    maxHeight: '85%',
    padding: 21,
    width: '100%',
    gap: 13,
  },

  modalHandle: {
    alignSelf: 'center',
    backgroundColor: '#DDDDDD',
    borderRadius: 5,
    height: 5,
    width: 42,
    marginBottom: 3,
  },

  modalHeader: {
    gap: 6,
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

  // PENCARIAN
  input: {
    backgroundColor: '#F5F5F7',
    borderColor: '#E0E0E0',
    borderRadius: 12,
    borderWidth: 1,
    color: '#000000',
    fontSize: 13,
    padding: 13,
  },

  selectionList: {
    maxHeight: 300,
  },

  modalLoading: {
    alignItems: 'center',
    gap: 10,
    padding: 25,
  },

  modalEmpty: {
    alignItems: 'center',
    backgroundColor: '#F5F5F7',
    borderRadius: 14,
    padding: 20,
    gap: 8,
  },

  // PILIHAN PESERTA DAN KELAS
  userOption: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E0E0E0',
    borderRadius: 13,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 11,
    marginBottom: 9,
    padding: 11,
  },

  selectedOption: {
    backgroundColor: '#F1F1F3',
    borderColor: '#000000',
  },

  // RADIO BUTTON
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

  // TOMBOL MODAL
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },

  cancelButton: {
    alignItems: 'center',
    backgroundColor: '#EEEEEE',
    borderRadius: 11,
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

  // ==========================================
  // MODAL KONFIRMASI KELUARKAN PESERTA
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

  deleteMemberInfo: {
    backgroundColor: '#F4F4F5',
    borderRadius: 13,
    gap: 5,
    padding: 13,
  },

  deleteMemberName: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '800',
  },

  deleteMemberNim: {
    color: '#777777',
    fontSize: 12,
  },

  deleteErrorText: {
    color: '#B91C1C',
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

  deleteConfirmButton: {
    alignItems: 'center',
    backgroundColor: '#000000',
    borderRadius: 11,
    flex: 1,
    justifyContent: 'center',
    paddingVertical: 14,
  },

  deleteConfirmText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },

});