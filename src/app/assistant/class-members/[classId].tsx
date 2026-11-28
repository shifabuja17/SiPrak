import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';

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
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

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

import PersonIcon from '@/components/common/person-icon';
import { FONT } from '@/constants/fonts';
import {
  subscribeClasses,
  type PracticumClass,
} from '@/features/assistant/services/class-service';
import {
  subscribeSchedules,
  type PracticumSchedule,
} from '@/features/assistant/services/schedule-service';
import { classLabel } from '@/features/assistant/utils/class-label';
import { MetaLine } from '@/features/praktikan/ui/praktikan-ui';
import { BORDER_COLOR, PAGE_BG } from '@/constants/colors';


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
  const insets = useSafeAreaInsets();

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
  // Jadwal tetap kelas ini (diatur dari form Edit kelas).
  const [classSchedule, setClassSchedule] = useState<PracticumSchedule | null>(null);
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

    const unsubscribeSchedules = subscribeSchedules(
      (data) => {
        setClassSchedule(data.find((item) => item.classId === classId) ?? null);
      },
      (err) => {
        setPageError(err.message);
      }
    );

    return () => {
      unsubscribeSchedules();
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

  // KELAS TUJUAN PINDAH PESERTA: hanya kelas lain dari praktikum yang sama
  // (mis. Sistem Operasi E1 -> Sistem Operasi E2), bukan praktikum lain.
  const samePracticum = (nama: string) =>
    nama.trim().toLowerCase() === (currentClass?.nama ?? '').trim().toLowerCase();
  const targetClasses = classes.filter(
    (item) => item.id !== classId && samePracticum(item.nama)
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
          Silakan login terlebih dahulu.
        </Text>
      </SafeAreaView>
    );
  }

  if (profile.role !== 'asisten') {
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

  if (!loading && !currentClass) {
    return (
      <SafeAreaView style={styles.centered} edges={['top']}>
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
    <SafeAreaView style={styles.safeArea} edges={['top']}>
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
              Kelola Peserta
            </Text>

            <Text style={styles.subtitle}>
              Atur peserta yang terdaftar di kelas praktikum ini.
            </Text>
          </View>

          {/* INFORMASI KELAS: baris per baris */}
          {currentClass ? (
            <View style={styles.infoList}>
              <Text style={styles.practicumTitle}>{classLabel(currentClass)}</Text>
              <MetaLine icon="time" color="#111014" textStyle={styles.infoMetaText}>
                {classSchedule?.scheduleTime ?? 'Jadwal belum diatur'}
              </MetaLine>
              <MetaLine icon="place" color="#111014" textStyle={styles.infoMetaText}>
                {classSchedule?.classRoom ?? 'Lab belum diatur'}
              </MetaLine>
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

          {/* DAFTAR ANGGOTA + TOMBOL TAMBAH */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              Daftar Anggota
            </Text>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Tambah peserta"
              style={({ pressed }) => [
                styles.addButton,
                pressed && styles.pressed,
                loading && styles.disabledButton,
              ]}
              onPress={openAddModal}
              disabled={loading}
            >
              <Text style={styles.addButtonText}>+ Tambah Peserta</Text>
            </Pressable>
          </View>

          {/* LOADING */}
          {loading ? (
            <View style={styles.centeredContent}>
              <ActivityIndicator
                size="large"
                color="#111014"
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
                      <PersonIcon size={22} color="#111014" />
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
          behavior="padding"
        >
          <View style={styles.sheetBackdrop}>

            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={closeAddModal}
              disabled={saving}
            />

            <View style={[styles.sheetCard, { paddingBottom: Math.max(insets.bottom, 12) + 12 }]}>

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
                placeholderTextColor="#8E8E93"
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
                      color="#111014"
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
                          <PersonIcon size={22} color="#111014" />
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
                  style={[styles.cancelButton, styles.equalButton]}
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
                    styles.equalButton,
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
        <View style={styles.sheetBackdrop}>

          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={closeMoveModal}
            disabled={saving}
          />

          <View style={[styles.sheetCard, { paddingBottom: Math.max(insets.bottom, 12) + 12 }]}>

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
                    Peserta hanya bisa dipindahkan ke kelas lain dari{' '}
                    {currentClass?.nama ?? 'praktikum yang sama'}.
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
                style={[styles.cancelButton, styles.equalButton]}
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
                  styles.equalButton,
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
        animationType="slide"
        onRequestClose={closeRemoveModal}
        statusBarTranslucent
      >
        <View style={styles.sheetBackdrop}>

          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={closeRemoveModal}
            disabled={removing}
          />

          <View style={[styles.sheetCard, { paddingBottom: Math.max(insets.bottom, 12) + 12 }]}>
            <View style={styles.modalHandle} />


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
    backgroundColor: PAGE_BG,
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
    backgroundColor: PAGE_BG,
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

  // INFORMASI KELAS







  // RINGKASAN PESERTA




  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#F47321',
    borderRadius: 11,
    justifyContent: 'center',
    paddingHorizontal: 15,
    paddingVertical: 13,
  },

  primaryButtonText: {
    fontFamily: FONT.bold,
    color: '#FFFFFF',
    fontSize: 12,
  },

  // DAFTAR ANGGOTA





  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
    marginTop: 5,
  },

  sectionTitle: {
    fontFamily: FONT.extrabold,
    color: '#111014',
    fontSize: 19,
  },




  // KARTU PESERTA
  memberCard: {
    backgroundColor: '#FFFFFF',
    borderColor: BORDER_COLOR,
    borderRadius: 26,
    borderWidth: 1,
    gap: 15,
    padding: 18,
  },

  memberIdentity: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },

  avatar: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    height: 48,
    justifyContent: 'center',
    width: 48,
    borderColor: BORDER_COLOR,
    borderWidth: 1,
  },


  memberDetails: {
    flex: 1,
    gap: 4,
  },

  memberName: {
    fontFamily: FONT.bold,
    color: '#111014',
    fontSize: 14,
  },

  memberNim: {
    fontFamily: FONT.regular,
    color: '#5F5F66',
    fontSize: 12,
  },


  // TOMBOL AKSI PESERTA
  memberActions: {
    flexDirection: 'row',
    gap: 10,
  },

  moveButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: BORDER_COLOR,
    borderRadius: 10,
    borderWidth: 1,
    flex: 1,
    padding: 11,
  },

  moveText: {
    fontFamily: FONT.bold,
    color: '#111014',
    fontSize: 12,
  },

  removeButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    flex: 1,
    padding: 11,
    borderColor: BORDER_COLOR,
    borderWidth: 1,
  },

  removeText: {
    fontFamily: FONT.bold,
    color: '#5F5F66',
    fontSize: 12,
  },

  // KELAS TUJUAN
  classOptionIcon: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 11,
    height: 44,
    justifyContent: 'center',
    width: 44,
    borderColor: BORDER_COLOR,
    borderWidth: 1,
  },

  classOptionInitial: {
    fontFamily: FONT.extrabold,
    color: '#111014',
    fontSize: 12,
  },

  // KONDISI KOSONG
  emptyCard: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
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

  emptyIconText: {
    fontFamily: FONT.medium,
    color: '#111014',
    fontSize: 28,
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
    borderRadius: 11,
    padding: 12,
  },

  errorText: {
    fontFamily: FONT.regular,
    color: '#FFFFFF',
    fontSize: 12,
    lineHeight: 18,
  },

  disabledButton: {
    opacity: 0.5,
  },

  practicumTitle: {
    fontFamily: FONT.extrabold,
    color: '#111014',
    fontSize: 20,
    letterSpacing: -0.3,
    lineHeight: 26,
    marginBottom: 2,
  },
  infoMetaText: {
    fontFamily: FONT.regular,
    color: '#111014',
    fontSize: 14,
    lineHeight: 20,
  },
  infoList: {
    gap: 6,
  },
  addButton: {
    alignItems: 'center',
    backgroundColor: '#F47321',
    borderRadius: 999,
    justifyContent: 'center',
    minHeight: 40,
    paddingHorizontal: 16,
  },
  addButtonText: {
    fontFamily: FONT.bold,
    color: '#FFFFFF',
    fontSize: 13,
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

  sheetBackdrop: {
    backgroundColor: 'rgba(0,0,0,0.55)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheetCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    gap: 13,
    maxHeight: '85%',
    paddingHorizontal: 21,
    paddingTop: 12,
    width: '100%',
  },
  equalButton: {
    // Batal & Pindahkan selalu sama lebar.
    flex: 1,
    minHeight: 48,
  },


  modalHandle: {
    alignSelf: 'center',
    backgroundColor: '#8E8E93',
    borderRadius: 5,
    height: 5,
    width: 42,
    marginBottom: 3,
  },

  modalHeader: {
    gap: 6,
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

  // PENCARIAN
  input: {
    fontFamily: FONT.regular,
    backgroundColor: '#FFFFFF',
    borderColor: BORDER_COLOR,
    borderRadius: 12,
    borderWidth: 1,
    color: '#111014',
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
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 20,
    gap: 8,
    borderColor: BORDER_COLOR,
    borderWidth: 1,
  },

  // PILIHAN PESERTA DAN KELAS
  userOption: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: BORDER_COLOR,
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 11,
    marginBottom: 9,
    padding: 11,
  },

  selectedOption: {
    backgroundColor: '#FFFFFF',
    borderColor: '#111014',
    borderWidth: 2,
  },

  // RADIO BUTTON
  radio: {
    alignItems: 'center',
    borderColor: BORDER_COLOR,
    borderRadius: 11,
    borderWidth: 1.5,
    height: 22,
    justifyContent: 'center',
    width: 22,
  },

  radioSelected: {
    borderColor: '#111014',
  },

  radioInner: {
    backgroundColor: '#111014',
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
    backgroundColor: '#FFFFFF',
    borderRadius: 11,
    flex: 1,
    justifyContent: 'center',
    padding: 13,
    borderColor: BORDER_COLOR,
    borderWidth: 1,
  },

  cancelText: {
    fontFamily: FONT.bold,
    color: '#111014',
    fontSize: 13,
  },

  modalError: {
    fontFamily: FONT.regular,
    color: '#E00000',
    fontSize: 12,
    lineHeight: 18,
  },

  // ==========================================
  // MODAL KONFIRMASI KELUARKAN PESERTA
  // ==========================================



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

  deleteMemberInfo: {
    backgroundColor: '#FFFFFF',
    borderRadius: 13,
    gap: 5,
    padding: 13,
    borderColor: BORDER_COLOR,
    borderWidth: 1,
  },

  deleteMemberName: {
    fontFamily: FONT.extrabold,
    color: '#111014',
    fontSize: 14,
  },

  deleteMemberNim: {
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
    borderColor: BORDER_COLOR,
    borderWidth: 1,
  },

  cancelConfirmText: {
    fontFamily: FONT.bold,
    color: '#111014',
    fontSize: 13,
  },

  deleteConfirmButton: {
    alignItems: 'center',
    backgroundColor: '#E00000',
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