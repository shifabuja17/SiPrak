import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import ConfirmModal from '@/components/common/ConfirmModal';
import { FONT } from '@/constants/fonts';
import { useAuth } from '@/context/AuthContext';
import {
  Chip,
  MetaLine,
  ScreenTitle,
  SoftCard,
  TAB_BAR_SPACE,
  UI,
} from '@/features/praktikan/ui/praktikan-ui';
import {
  createLaboratory,
  deleteLaboratory,
  ensureDefaultLaboratories,
  subscribeLaboratories,
  updateLaboratory,
  updateLatePolicyByCourse,
  type Laboratory,
  type LaboratoryPayload,
  type LatePolicyInput,
} from '@/services/laboratory-service';

import {
  COURSE_FILTER_ALL,
  COURSE_FILTER_UNASSIGNED,
  extractUniqueCourses,
  filterLaboratories,
  formatRupiah,
  formatShortCoordinate,
} from '../utils/laboratory-form';
import LaboratoryFormModal from './laboratory-form-modal';
import LatePolicyModal from './late-policy-modal';

function canManageLaboratories(rawRole: unknown): boolean {
  if (typeof rawRole !== 'string') return false;
  const normalized = rawRole.trim().toUpperCase();
  return normalized === 'ASLAB' || normalized === 'ASISTEN';
}

/**
 * Layar utama Manajemen Laboratorium khusus Aslab (FR-02 & FR-12).
 */
export default function LaboratoryManagementScreen() {
  const { profile, loading: authLoading } = useAuth();
  const isAuthorized = canManageLaboratories(profile?.role);

  const [laboratories, setLaboratories] = useState<Laboratory[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [retryNonce, setRetryNonce] = useState(0);

  const [searchQuery, setSearchQuery] = useState('');
  const [courseFilter, setCourseFilter] = useState<string>(COURSE_FILTER_ALL);

  const [pageError, setPageError] = useState('');
  const [pageMessage, setPageMessage] = useState('');

  // State modal tambah / edit
  const [formVisible, setFormVisible] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [editingLab, setEditingLab] = useState<Laboratory | null>(null);
  const [formSaving, setFormSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // State modal kebijakan denda per mata kuliah
  const [policyVisible, setPolicyVisible] = useState(false);
  const [policySaving, setPolicySaving] = useState(false);
  const [policyError, setPolicyError] = useState('');

  // State konfirmasi hapus
  const [deleteTarget, setDeleteTarget] = useState<Laboratory | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleRetry = useCallback(() => {
    setPageError('');
    setRetryNonce((prev) => prev + 1);
  }, []);

  useEffect(() => {
    if (authLoading) return;

    if (!profile || !isAuthorized) {
      setLaboratories([]);
      setLoading(false);
      setSeeding(false);
      return;
    }

    let active = true;
    setLoading(true);
    setSeeding(true);
    setPageError('');

    const unsubscribe = subscribeLaboratories(
      (data) => {
        if (!active) return;
        setLaboratories(data);
        setLoading(false);
      },
      (firebaseError) => {
        if (!active) return;
        setPageError(firebaseError.message);
        setLoading(false);
      },
    );

    ensureDefaultLaboratories()
      .then(() => {
        if (!active) return;
        setSeeding(false);
      })
      .catch((seedError: unknown) => {
        if (!active) return;
        setSeeding(false);
        setLoading(false);
        setPageError(
          seedError instanceof Error
            ? seedError.message
            : 'Gagal menginisialisasi data awal laboratorium.',
        );
      });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [authLoading, profile, isAuthorized, retryNonce]);

  const uniqueCourses = useMemo(
    () => extractUniqueCourses(laboratories),
    [laboratories],
  );

  const hasUnassignedLab = useMemo(
    () => laboratories.some((lab) => lab.mataKuliahId.trim().length === 0),
    [laboratories],
  );

  const labCountByCourse = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const lab of laboratories) {
      const course = lab.mataKuliahId.trim();
      if (course) {
        counts[course] = (counts[course] ?? 0) + 1;
      }
    }
    return counts;
  }, [laboratories]);

  const filteredLabs = useMemo(
    () => filterLaboratories(laboratories, searchQuery, courseFilter),
    [laboratories, searchQuery, courseFilter],
  );

  function openCreateModal() {
    setPageError('');
    setPageMessage('');
    setFormError('');
    setFormMode('create');
    setEditingLab(null);
    setFormVisible(true);
  }

  function openEditModal(lab: Laboratory) {
    setPageError('');
    setPageMessage('');
    setFormError('');
    setFormMode('edit');
    setEditingLab(lab);
    setFormVisible(true);
  }

  function openPolicyModal() {
    setPageError('');
    setPageMessage('');
    setPolicyError('');
    setPolicyVisible(true);
  }

  async function handleFormSubmit(
    payload: LaboratoryPayload,
    applyPolicyToCourse: boolean,
  ) {
    try {
      setFormSaving(true);
      setFormError('');

      if (formMode === 'create') {
        await createLaboratory(payload);
      } else if (editingLab) {
        await updateLaboratory(editingLab.id, payload);
      }

      let policySuffix = '';
      if (applyPolicyToCourse) {
        const result = await updateLatePolicyByCourse(payload.mataKuliahId, {
          gracePeriodMenit: payload.gracePeriodMenit,
          nominalDenda: payload.nominalDenda,
        });
        policySuffix = ` Kebijakan denda diterapkan ke ${result.updatedCount} lab pada ${result.mataKuliahId}.`;
      }

      setFormVisible(false);
      setEditingLab(null);
      setPageMessage(
        `${formMode === 'create' ? 'Laboratorium' : 'Perubahan'} "${payload.nama}" berhasil disimpan.${policySuffix}`,
      );
    } catch (err) {
      setFormError(
        err instanceof Error
          ? err.message
          : 'Gagal menyimpan data laboratorium.',
      );
    } finally {
      setFormSaving(false);
    }
  }

  async function handlePolicySubmit(
    mataKuliahId: string,
    policy: LatePolicyInput,
  ) {
    try {
      setPolicySaving(true);
      setPolicyError('');

      const result = await updateLatePolicyByCourse(mataKuliahId, policy);
      setPolicyVisible(false);
      setPageMessage(
        `Grace period (${policy.gracePeriodMenit} mnt) & denda (${formatRupiah(policy.nominalDenda)}) diterapkan ke ${result.updatedCount} lab pada ${result.mataKuliahId}.`,
      );
    } catch (err) {
      setPolicyError(
        err instanceof Error
          ? err.message
          : 'Gagal memperbarui kebijakan denda per mata kuliah.',
      );
    } finally {
      setPolicySaving(false);
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTarget || deleting) return;
    const target = deleteTarget;

    try {
      setDeleting(true);
      setPageError('');
      setPageMessage('');
      await deleteLaboratory(target.id);
      setDeleteTarget(null);
      setPageMessage(`Laboratorium "${target.nama}" berhasil dihapus.`);
    } catch (err) {
      setDeleteTarget(null);
      setPageError(
        err instanceof Error
          ? err.message
          : 'Gagal menghapus laboratorium.',
      );
    } finally {
      setDeleting(false);
    }
  }

  if (authLoading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color={UI.ink} />
        <Text style={styles.mutedText}>Memeriksa akun...</Text>
      </SafeAreaView>
    );
  }

  if (!profile || !isAuthorized) {
    return (
      <SafeAreaView style={styles.centered}>
        <Text style={styles.emptyTitle}>Akses Ditolak</Text>
        <Text style={styles.mutedText}>
          Halaman Manajemen Laboratorium hanya dapat diakses oleh Asisten Lab (Aslab).
        </Text>
      </SafeAreaView>
    );
  }

  const isWaitingInitialData =
    (loading || (seeding && laboratories.length === 0)) && !pageError;
  const hasActiveFilter =
    searchQuery.trim().length > 0 || courseFilter !== COURSE_FILTER_ALL;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar barStyle="dark-content" />

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <ScreenTitle
          title="Manajemen Laboratorium"
          subtitle="Kelola lokasi presensi, radius geofencing, grace period, dan denda keterlambatan."
        />

        {/* AKSI UTAMA */}
        <View style={styles.actionRow}>
          <Pressable
            accessibilityRole="button"
            onPress={openCreateModal}
            style={({ pressed }) => [
              styles.primaryActionBtn,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.primaryActionText}>+ Tambah Laboratorium</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            onPress={openPolicyModal}
            style={({ pressed }) => [
              styles.secondaryActionBtn,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.secondaryActionText}>Atur Denda per Mata Kuliah</Text>
          </Pressable>
        </View>

        {/* PENCARIAN & FILTER MATA KULIAH */}
        <View style={styles.searchSection}>
          <View style={styles.searchBox}>
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Cari nama lab atau lokasi..."
              placeholderTextColor={UI.border}
              style={styles.searchInput}
              autoCorrect={false}
            />
            {searchQuery.length > 0 ? (
              <Pressable
                hitSlop={8}
                onPress={() => setSearchQuery('')}
                style={styles.clearSearchBtn}
              >
                <Text style={styles.clearSearchText}>Hapus</Text>
              </Pressable>
            ) : null}
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterRow}
          >
            <FilterChip
              label={`Semua (${laboratories.length})`}
              active={courseFilter === COURSE_FILTER_ALL}
              onPress={() => setCourseFilter(COURSE_FILTER_ALL)}
            />
            {uniqueCourses.map((course) => (
              <FilterChip
                key={course}
                label={`${course} (${labCountByCourse[course] ?? 0})`}
                active={courseFilter === course}
                onPress={() => setCourseFilter(course)}
              />
            ))}
            {hasUnassignedLab ? (
              <FilterChip
                label="Belum diatur"
                active={courseFilter === COURSE_FILTER_UNASSIGNED}
                onPress={() => setCourseFilter(COURSE_FILTER_UNASSIGNED)}
              />
            ) : null}
          </ScrollView>
        </View>

        {/* FEEDBACK SUKSES / ERROR */}
        {pageMessage ? (
          <View style={styles.successBox}>
            <Text style={styles.successText}>{pageMessage}</Text>
            <Pressable hitSlop={8} onPress={() => setPageMessage('')}>
              <Text style={styles.dismissText}>Tutup</Text>
            </Pressable>
          </View>
        ) : null}

        {pageError ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{pageError}</Text>
            <Pressable
              onPress={handleRetry}
              style={({ pressed }) => [styles.retryBtn, pressed && styles.pressed]}
            >
              <Text style={styles.retryBtnText}>Coba Lagi</Text>
            </Pressable>
          </View>
        ) : null}

        {/* DAFTAR LABORATORIUM */}
        {isWaitingInitialData ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator size="large" color={UI.ink} />
            <Text style={styles.mutedText}>Memuat daftar laboratorium...</Text>
          </View>
        ) : filteredLabs.length === 0 ? (
          <SoftCard style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>
              {hasActiveFilter
                ? 'Laboratorium Tidak Ditemukan'
                : 'Belum Ada Laboratorium'}
            </Text>
            <Text style={styles.mutedText}>
              {hasActiveFilter
                ? 'Tidak ada laboratorium yang cocok dengan kata kunci atau filter mata kuliah.'
                : 'Tekan "+ Tambah Laboratorium" untuk menambahkan data laboratorium baru.'}
            </Text>
            {hasActiveFilter ? (
              <Pressable
                onPress={() => {
                  setSearchQuery('');
                  setCourseFilter(COURSE_FILTER_ALL);
                }}
                style={({ pressed }) => [
                  styles.resetFilterBtn,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.resetFilterText}>Reset Filter</Text>
              </Pressable>
            ) : null}
          </SoftCard>
        ) : (
          <View style={styles.listStack}>
            {filteredLabs.map((lab) => (
              <SoftCard key={lab.id} style={styles.labCard}>
                <View style={styles.cardTopRow}>
                  <Text style={styles.labName} numberOfLines={2}>
                    {lab.nama}
                  </Text>
                  <Chip
                    label={lab.mataKuliahId || 'Belum diatur'}
                    tone={lab.mataKuliahId ? 'accent' : 'soft'}
                  />
                </View>

                <MetaLine
                  icon="place"
                  color={UI.muted}
                  textStyle={styles.locationText}
                  numberOfLines={2}
                >
                  {lab.lokasi || 'Lokasi ruangan belum diisi'}
                </MetaLine>

                <View style={styles.metricsGrid}>
                  <MetricCell
                    label="KOORDINAT"
                    value={formatShortCoordinate(lab.lat, lab.lng)}
                  />
                  <MetricCell label="RADIUS" value={`${lab.radius} m`} />
                  <MetricCell
                    label="GRACE PERIOD"
                    value={`${lab.gracePeriodMenit} menit`}
                  />
                  <MetricCell
                    label="DENDA TETAP"
                    value={formatRupiah(lab.nominalDenda)}
                  />
                </View>

                <View style={styles.cardActions}>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => openEditModal(lab)}
                    style={({ pressed }) => [
                      styles.editBtn,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={styles.editBtnText}>Edit</Text>
                  </Pressable>

                  <Pressable
                    accessibilityRole="button"
                    onPress={() => setDeleteTarget(lab)}
                    style={({ pressed }) => [
                      styles.deleteBtn,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={styles.deleteBtnText}>Hapus</Text>
                  </Pressable>
                </View>
              </SoftCard>
            ))}
          </View>
        )}
      </ScrollView>

      {/* MODAL TAMBAH / EDIT LABORATORIUM */}
      <LaboratoryFormModal
        visible={formVisible}
        mode={formMode}
        initialLab={editingLab}
        existingCourses={uniqueCourses}
        saving={formSaving}
        submitError={formError}
        onClose={() => {
          if (!formSaving) {
            setFormVisible(false);
            setEditingLab(null);
            setFormError('');
          }
        }}
        onSubmit={handleFormSubmit}
      />

      {/* MODAL ATUR DENDA PER MATA KULIAH */}
      <LatePolicyModal
        visible={policyVisible}
        courses={uniqueCourses}
        labCountByCourse={labCountByCourse}
        saving={policySaving}
        submitError={policyError}
        onClose={() => {
          if (!policySaving) {
            setPolicyVisible(false);
            setPolicyError('');
          }
        }}
        onSubmit={handlePolicySubmit}
      />

      {/* MODAL KONFIRMASI HAPUS */}
      <ConfirmModal
        visible={deleteTarget !== null}
        title="Hapus Laboratorium?"
        message={
          deleteTarget
            ? `Laboratorium "${deleteTarget.nama}" akan dihapus permanen. Penghapusan dibatalkan otomatis bila masih terhubung ke sesi, jadwal, atau anggota aktif.`
            : ''
        }
        confirmText={deleting ? 'Menghapus...' : 'Hapus'}
        cancelText="Batal"
        destructive
        onConfirm={() => void handleConfirmDelete()}
        onCancel={() => {
          if (!deleting) setDeleteTarget(null);
        }}
      />
    </SafeAreaView>
  );
}

function FilterChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.filterChip,
        active && styles.filterChipActive,
        pressed && !active && styles.pressed,
      ]}
    >
      <Text
        style={[
          styles.filterChipText,
          active && styles.filterChipTextActive,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function MetricCell({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metricCell}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: UI.page,
    flex: 1,
  },
  content: {
    gap: 16,
    paddingBottom: TAB_BAR_SPACE,
    paddingHorizontal: UI.padding,
    paddingTop: 16,
  },
  centered: {
    alignItems: 'center',
    backgroundColor: UI.page,
    flex: 1,
    gap: 10,
    justifyContent: 'center',
    padding: 24,
  },
  actionRow: {
    gap: 10,
  },
  primaryActionBtn: {
    alignItems: 'center',
    backgroundColor: UI.accent,
    borderRadius: 999,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  primaryActionText: {
    fontFamily: FONT.bold,
    color: UI.onColor,
    fontSize: 14,
  },
  secondaryActionBtn: {
    alignItems: 'center',
    backgroundColor: UI.page,
    borderColor: UI.ink,
    borderRadius: 999,
    borderWidth: 1.5,
    justifyContent: 'center',
    minHeight: 46,
    paddingHorizontal: 18,
    paddingVertical: 11,
  },
  secondaryActionText: {
    fontFamily: FONT.bold,
    color: UI.ink,
    fontSize: 14,
  },
  searchSection: {
    gap: 10,
  },
  searchBox: {
    alignItems: 'center',
    backgroundColor: UI.soft,
    borderColor: UI.line,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    paddingHorizontal: 14,
  },
  searchInput: {
    fontFamily: FONT.regular,
    color: UI.ink,
    flex: 1,
    fontSize: 14,
    paddingVertical: 11,
  },
  clearSearchBtn: {
    paddingLeft: 8,
    paddingVertical: 4,
  },
  clearSearchText: {
    fontFamily: FONT.bold,
    color: UI.accent,
    fontSize: 12,
  },
  filterRow: {
    gap: 8,
  },
  filterChip: {
    backgroundColor: UI.page,
    borderColor: UI.line,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 13,
    paddingVertical: 7,
  },
  filterChipActive: {
    backgroundColor: UI.ink,
    borderColor: UI.ink,
  },
  filterChipText: {
    fontFamily: FONT.semibold,
    color: UI.ink,
    fontSize: 12,
  },
  filterChipTextActive: {
    color: UI.onColor,
  },
  successBox: {
    alignItems: 'center',
    backgroundColor: UI.ink,
    borderRadius: 14,
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  successText: {
    fontFamily: FONT.semibold,
    color: UI.onColor,
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
  },
  dismissText: {
    fontFamily: FONT.bold,
    color: UI.accent,
    fontSize: 12,
  },
  errorBox: {
    backgroundColor: UI.danger,
    borderRadius: 14,
    gap: 10,
    padding: 14,
  },
  errorText: {
    fontFamily: FONT.regular,
    color: UI.onColor,
    fontSize: 12,
    lineHeight: 18,
  },
  retryBtn: {
    alignSelf: 'flex-start',
    backgroundColor: UI.page,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  retryBtnText: {
    fontFamily: FONT.bold,
    color: UI.ink,
    fontSize: 12,
  },
  loadingCard: {
    alignItems: 'center',
    gap: 10,
    paddingVertical: 36,
  },
  emptyCard: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 24,
  },
  emptyTitle: {
    fontFamily: FONT.extrabold,
    color: UI.ink,
    fontSize: 16,
    textAlign: 'center',
  },
  mutedText: {
    fontFamily: FONT.regular,
    color: UI.muted,
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
  },
  resetFilterBtn: {
    backgroundColor: UI.ink,
    borderRadius: 999,
    marginTop: 6,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  resetFilterText: {
    fontFamily: FONT.bold,
    color: UI.onColor,
    fontSize: 12,
  },
  listStack: {
    gap: 12,
  },
  labCard: {
    gap: 10,
  },
  cardTopRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  labName: {
    fontFamily: FONT.extrabold,
    color: UI.ink,
    flex: 1,
    fontSize: 17,
    lineHeight: 22,
  },
  locationText: {
    fontFamily: FONT.regular,
    color: UI.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  metricsGrid: {
    backgroundColor: UI.soft,
    borderRadius: 14,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    padding: 12,
  },
  metricCell: {
    minWidth: '45%',
    flex: 1,
    gap: 2,
  },
  metricLabel: {
    fontFamily: FONT.bold,
    color: UI.muted,
    fontSize: 10,
    letterSpacing: 0.4,
  },
  metricValue: {
    fontFamily: FONT.extrabold,
    color: UI.ink,
    fontSize: 13,
  },
  cardActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 2,
  },
  editBtn: {
    alignItems: 'center',
    backgroundColor: UI.ink,
    borderRadius: 999,
    flex: 1,
    justifyContent: 'center',
    minHeight: 40,
    paddingVertical: 9,
  },
  editBtnText: {
    fontFamily: FONT.bold,
    color: UI.onColor,
    fontSize: 13,
  },
  deleteBtn: {
    alignItems: 'center',
    backgroundColor: UI.page,
    borderColor: UI.danger,
    borderRadius: 999,
    borderWidth: 1.2,
    flex: 1,
    justifyContent: 'center',
    minHeight: 40,
    paddingVertical: 9,
  },
  deleteBtnText: {
    fontFamily: FONT.bold,
    color: UI.danger,
    fontSize: 13,
  },
  pressed: {
    opacity: 0.72,
  },
});
