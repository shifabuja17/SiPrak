import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
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

import ConfirmModal from '@/components/common/ConfirmModal';
import Dropdown, { type DropdownOption } from '@/components/common/Dropdown';
import SegmentedTabs from '@/components/common/SegmentedTabs';
import { FONT } from '@/constants/fonts';
import { useAuth } from '@/context/AuthContext';
import {
  ASPRAK_BULK_FIELDS,
  ASPRAK_BULK_REQUIRED_HEADERS,
  ASPRAK_TEMPLATE_DEFINITION,
  BULK_MAX_ROWS,
  BulkReviewList,
  acceptAllValidRows,
  buildUsersLookupMap,
  denyAllRows,
  downloadAsprakTemplate,
  parseBulkFile,
  pickBulkDocument,
  summarizeBulkRows,
  toggleBulkRowStatus,
  updateAsprakRowAndRevalidate,
  validateAsprakRows,
  type BulkAsprakItem,
  type BulkFileFormat,
  type BulkParsedRow,
  type BulkReviewRow,
  type UsersLookupMap,
} from '@/features/bulk';
import {
  BackLink,
  Chip,
  PillButton,
  ScreenTitle,
  SoftCard,
  TAB_BAR_SPACE,
  UI,
} from '@/features/praktikan/ui/praktikan-ui';
import {
  addSingleAsprak,
  bulkInsertAsprak,
  getAllLaboratories,
  getLabMembersForLab,
  loadUsersLookupMap,
  type BulkInsertMembersResult,
  type LabMember,
} from '@/services/lab-members-service';
import type { Laboratory } from '@/types/laboratory';

type AsprakInsertMode = 'single' | 'bulk';

const MODE_OPTIONS: { key: AsprakInsertMode; label: string }[] = [
  { key: 'single', label: 'Single Insert' },
  { key: 'bulk', label: 'Bulk Insert' },
];

const EMPTY_USERS_MAP: UsersLookupMap = buildUsersLookupMap([]);

function isAslabRole(rawRole: unknown): boolean {
  return typeof rawRole === 'string' && rawRole.trim().toUpperCase() === 'ASLAB';
}

/**
 * Layar khusus penugasan/insert Asprak (Single & Bulk CSV/XLSX) untuk Aslab (FR-06).
 */
export default function AsprakInsertScreen() {
  const { labId: routeLabIdParam } = useLocalSearchParams<{ labId?: string }>();
  const initialLabId =
    (Array.isArray(routeLabIdParam) ? routeLabIdParam[0] : routeLabIdParam)?.trim() ??
    '';

  const { profile, loading: authLoading } = useAuth();
  const isAuthorized = isAslabRole(profile?.role);

  const [mode, setMode] = useState<AsprakInsertMode>('single');

  // Data laboratorium tujuan & konteks anggota
  const [laboratories, setLaboratories] = useState<Laboratory[]>([]);
  const [selectedLabId, setSelectedLabId] = useState<string>(initialLabId);
  const [loadingContext, setLoadingContext] = useState(false);
  const [contextError, setContextError] = useState<string | null>(null);

  const [usersMap, setUsersMap] = useState<UsersLookupMap>(EMPTY_USERS_MAP);
  const [existingMembers, setExistingMembers] = useState<LabMember[]>([]);

  // Mode Single Insert Asprak
  const [searchQuery, setSearchQuery] = useState('');
  const [savingSingleUserId, setSavingSingleUserId] = useState<string | null>(
    null,
  );
  const [singleSuccess, setSingleSuccess] = useState<string | null>(null);
  const [singleError, setSingleError] = useState<string | null>(null);

  // Mode Bulk Insert Asprak
  const [downloadingFormat, setDownloadingFormat] =
    useState<BulkFileFormat | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [bulkMessage, setBulkMessage] = useState<string | null>(null);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [uploadedFileMeta, setUploadedFileMeta] = useState<{
    fileName: string;
    format: BulkFileFormat;
    totalRows: number;
  } | null>(null);
  const [parsedRows, setParsedRows] = useState<BulkParsedRow[]>([]);
  const [reviewRows, setReviewRows] = useState<BulkReviewRow<BulkAsprakItem>[]>(
    [],
  );
  const [confirmBulkVisible, setConfirmBulkVisible] = useState(false);
  const [committingBulk, setCommittingBulk] = useState(false);
  const [commitResult, setCommitResult] =
    useState<BulkInsertMembersResult | null>(null);

  const selectedLab = useMemo(
    () => laboratories.find((lab) => lab.id === selectedLabId) ?? null,
    [laboratories, selectedLabId],
  );

  const labOptions: DropdownOption[] = useMemo(
    () =>
      laboratories.map((lab) => ({
        value: lab.id,
        label: lab.nama,
        detail: lab.mataKuliahId
          ? `Mata Kuliah: ${lab.mataKuliahId}${lab.lokasi ? ` • ${lab.lokasi}` : ''}`
          : lab.lokasi || undefined,
      })),
    [laboratories],
  );

  const loadInitialData = useCallback(async () => {
    setLoadingContext(true);
    setContextError(null);
    try {
      const [labs, loadedUsers] = await Promise.all([
        getAllLaboratories(),
        loadUsersLookupMap(),
      ]);
      setLaboratories(labs);
      setUsersMap(loadedUsers);

      setSelectedLabId((current: string) => {
        if (current && labs.some((lab) => lab.id === current)) {
          return current;
        }
        return labs[0]?.id ?? '';
      });
    } catch (error) {
      setContextError(
        error instanceof Error
          ? error.message
          : 'Gagal memuat daftar laboratorium dan akun Asprak.',
      );
    } finally {
      setLoadingContext(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading || !isAuthorized) return;
    loadInitialData();
  }, [authLoading, isAuthorized, loadInitialData]);

  const refreshLabMembers = useCallback(async (labId: string) => {
    if (!labId) {
      setExistingMembers([]);
      return [] as LabMember[];
    }

    const members = await getLabMembersForLab(labId);
    setExistingMembers(members);
    return members;
  }, []);

  useEffect(() => {
    if (authLoading || !isAuthorized || !selectedLab) {
      setExistingMembers([]);
      return;
    }

    let active = true;
    setContextError(null);

    refreshLabMembers(selectedLab.id)
      .then(async (members) => {
        if (!active || parsedRows.length === 0) return;
        const revalidated = await validateAsprakRows(
          parsedRows,
          selectedLab.id,
          members,
          usersMap,
          { previousRows: reviewRows },
        );
        if (!active) return;
        setReviewRows(revalidated);
      })
      .catch((error) => {
        if (!active) return;
        setContextError(
          error instanceof Error
            ? error.message
            : 'Gagal memuat daftar anggota laboratorium.',
        );
      });

    return () => {
      active = false;
    };
    // Sengaja hanya dijalankan ulang saat `selectedLab.id` atau `usersMap` berubah.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, isAuthorized, selectedLab?.id, usersMap]);

  const existingMemberByUserId = useMemo(() => {
    const map = new Map<string, LabMember>();
    for (const member of existingMembers) {
      map.set(member.userId, member);
    }
    return map;
  }, [existingMembers]);

  // Daftar kandidat akun khusus role ASPRAK (termasuk akun legacy ASISTEN yang telah dinormalisasi)
  const asprakCandidates = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return usersMap.all
      .filter((user) => user.role === 'ASPRAK')
      .filter((user) => {
        if (!q) return true;
        return (
          user.nama.toLowerCase().includes(q) ||
          (user.nim ?? '').toLowerCase().includes(q) ||
          user.email.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => a.nama.localeCompare(b.nama, 'id'));
  }, [usersMap, searchQuery]);

  const bulkSummary = useMemo(() => summarizeBulkRows(reviewRows), [reviewRows]);

  const handleAddSingleAsprak = useCallback(
    async (userId: string, nama: string) => {
      if (!selectedLab) {
        setSingleError('Pilih laboratorium tujuan terlebih dahulu.');
        return;
      }

      setSingleError(null);
      setSingleSuccess(null);

      const existing = existingMemberByUserId.get(userId);
      if (existing?.aktif) {
        setSingleError(
          `"${nama}" sudah terdaftar aktif sebagai ${existing.peran} di laboratorium ${selectedLab.nama}.`,
        );
        return;
      }

      setSavingSingleUserId(userId);
      try {
        await addSingleAsprak(selectedLab.id, userId);
        await refreshLabMembers(selectedLab.id);
        setSingleSuccess(
          `Asprak "${nama}" berhasil ditugaskan ke ${selectedLab.nama} (ID: ${selectedLab.id}_${userId}).`,
        );
      } catch (error) {
        setSingleError(
          error instanceof Error
            ? error.message
            : 'Gagal menugaskan Asprak ke laboratorium.',
        );
      } finally {
        setSavingSingleUserId(null);
      }
    },
    [selectedLab, existingMemberByUserId, refreshLabMembers],
  );

  const handleDownloadTemplate = useCallback(async (format: BulkFileFormat) => {
    setDownloadingFormat(format);
    setBulkError(null);
    setBulkMessage(null);
    try {
      const res = await downloadAsprakTemplate(format);
      setBulkMessage(
        `Template "${res.fileName}" siap disimpan atau dibagikan.`,
      );
    } catch (error) {
      setBulkError(
        error instanceof Error
          ? error.message
          : 'Gagal menyiapkan file template Asprak.',
      );
    } finally {
      setDownloadingFormat(null);
    }
  }, []);

  const handleUploadBulkFile = useCallback(async () => {
    setBulkError(null);
    setBulkMessage(null);

    if (!selectedLab) {
      setBulkError(
        'Pilih laboratorium tujuan terlebih dahulu sebelum mengunggah file.',
      );
      return;
    }

    setUploadingFile(true);
    try {
      const picked = await pickBulkDocument();
      if (!picked) return;

      const parsed = await parseBulkFile(picked, {
        requiredHeaders: ASPRAK_BULK_REQUIRED_HEADERS,
        expectedHeaders: ASPRAK_TEMPLATE_DEFINITION.headers,
        maxRows: BULK_MAX_ROWS,
      });

      const members = await refreshLabMembers(selectedLab.id);
      const validated = await validateAsprakRows(
        parsed.rows,
        selectedLab.id,
        members,
        usersMap,
      );

      setUploadedFileMeta({
        fileName: parsed.fileName,
        format: parsed.format,
        totalRows: parsed.totalRows,
      });
      setParsedRows(parsed.rows);
      setReviewRows(validated);
      setBulkMessage(
        `Berhasil memuat ${parsed.totalRows} baris dari "${parsed.fileName}". Silakan review sebelum menyimpan.`,
      );
    } catch (error) {
      setBulkError(
        error instanceof Error
          ? error.message
          : 'Gagal membaca atau memvalidasi file unggahan Asprak.',
      );
    } finally {
      setUploadingFile(false);
    }
  }, [selectedLab, refreshLabMembers, usersMap]);

  const handleToggleBulkRow = useCallback(
    (rowId: string) => {
      const result = toggleBulkRowStatus(reviewRows, rowId);
      if (result.changed) {
        setReviewRows(result.rows);
      }
      return { rejectedReason: result.rejectedReason };
    },
    [reviewRows],
  );

  const handleEditBulkRow = useCallback(
    async (rowId: string, updatedRaw: Record<string, string>) => {
      if (!selectedLab) {
        throw new Error('Laboratorium tujuan belum dipilih.');
      }

      const nextRows = await updateAsprakRowAndRevalidate(
        reviewRows,
        rowId,
        updatedRaw,
        selectedLab.id,
        existingMembers,
        usersMap,
      );

      setReviewRows(nextRows);
      setParsedRows(
        nextRows.map((item) => ({
          rowIndex: item.rowIndex,
          raw: item.raw,
        })),
      );
    },
    [selectedLab, reviewRows, existingMembers, usersMap],
  );

  const handleConfirmBulkSave = useCallback(async () => {
    if (!selectedLab || bulkSummary.accepted === 0) {
      setConfirmBulkVisible(false);
      return;
    }

    setConfirmBulkVisible(false);
    setCommittingBulk(true);
    setBulkError(null);
    setBulkMessage(null);

    try {
      const result = await bulkInsertAsprak(selectedLab.id, reviewRows);
      setCommitResult(result);
      await refreshLabMembers(selectedLab.id);
    } catch (error) {
      setBulkError(
        error instanceof Error
          ? error.message
          : 'Gagal menyimpan batch Asprak ke Firestore.',
      );
    } finally {
      setCommittingBulk(false);
    }
  }, [selectedLab, bulkSummary.accepted, reviewRows, refreshLabMembers]);

  const handleCloseResultModal = useCallback(() => {
    const saved = (commitResult?.savedCount ?? 0) > 0;
    setCommitResult(null);
    if (saved) {
      setParsedRows([]);
      setReviewRows([]);
      setUploadedFileMeta(null);
      setBulkMessage(
        'Penugasan Asprak berhasil disimpan ke labMembers dan langsung aktif sesuai Security Rules.',
      );
    }
  }, [commitResult]);

  if (authLoading) {
    return (
      <SafeAreaView style={styles.centered}>
        <StatusBar barStyle="dark-content" />
        <ActivityIndicator size="large" color={UI.ink} />
        <Text style={styles.mutedText}>Memeriksa akses akun...</Text>
      </SafeAreaView>
    );
  }

  if (!profile || !isAuthorized) {
    return (
      <SafeAreaView style={styles.centered}>
        <StatusBar barStyle="dark-content" />
        <Text style={styles.deniedTitle}>Akses Ditolak</Text>
        <Text style={styles.mutedText}>
          Halaman Insert Asprak hanya dapat diakses oleh Asisten Lab (Aslab).
        </Text>
        <PillButton label="Kembali" onPress={() => router.back()} />
      </SafeAreaView>
    );
  }

  const topControlsSection = (
    <View style={styles.topStack}>
      <BackLink label="Kembali" onPress={() => router.back()} />

      <ScreenTitle
        title="Tambah Asprak"
        subtitle="Tugaskan akun ber-role Asprak ke laboratorium tujuan via Single Insert atau Bulk CSV/XLSX."
      />

      <SoftCard style={styles.selectorCard}>
        <Text style={styles.sectionLabel}>Laboratorium Tujuan</Text>
        {loadingContext ? (
          <View style={styles.inlineLoading}>
            <ActivityIndicator size="small" color={UI.ink} />
            <Text style={styles.mutedSmall}>
              Memuat laboratorium dan daftar akun Asprak...
            </Text>
          </View>
        ) : (
          <Dropdown
            value={selectedLabId}
            options={labOptions}
            onChange={(nextId) => {
              setSelectedLabId(nextId);
              setSingleSuccess(null);
              setSingleError(null);
            }}
            placeholder="Pilih laboratorium tujuan"
            accessibilityLabel="Pilih laboratorium tujuan"
          />
        )}

        {selectedLab ? (
          <View style={styles.labMetaRow}>
            <Chip
              label={`${existingMembers.filter((m) => m.aktif && m.peran === 'asprak').length} Asprak Aktif`}
              tone="soft"
            />
            {selectedLab.mataKuliahId ? (
              <Chip label={selectedLab.mataKuliahId} tone="accent" />
            ) : null}
          </View>
        ) : null}

        {contextError ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>{contextError}</Text>
            <Pressable onPress={loadInitialData}>
              <Text style={styles.retryLink}>Muat ulang data</Text>
            </Pressable>
          </View>
        ) : null}
      </SoftCard>

      <SegmentedTabs
        options={MODE_OPTIONS}
        value={mode}
        onChange={(nextMode) => {
          setMode(nextMode);
          setSingleError(null);
          setSingleSuccess(null);
          setBulkError(null);
          setBulkMessage(null);
        }}
      />

      {mode === 'bulk' ? (
        <SoftCard style={styles.bulkActionCard}>
          <Text style={styles.sectionLabel}>Unggah File Asprak</Text>
          <Text style={styles.helperText}>
            Kolom wajib: `email`, `nama` (opsional: `nim`, `catatan`). Maksimal{' '}
            {BULK_MAX_ROWS} baris per unggahan.
          </Text>

          <View style={styles.templateRow}>
            <PillButton
              label="Unduh Template (.xlsx)"
              variant="outline"
              loading={downloadingFormat === 'xlsx'}
              disabled={downloadingFormat !== null || committingBulk}
              onPress={() => handleDownloadTemplate('xlsx')}
              style={styles.halfButton}
            />
            <PillButton
              label="Unduh Template (.csv)"
              variant="outline"
              loading={downloadingFormat === 'csv'}
              disabled={downloadingFormat !== null || committingBulk}
              onPress={() => handleDownloadTemplate('csv')}
              style={styles.halfButton}
            />
          </View>

          <PillButton
            label={
              uploadedFileMeta
                ? 'Unggah File CSV/XLSX Baru'
                : 'Unggah File CSV/XLSX'
            }
            variant="dark"
            loading={uploadingFile}
            disabled={!selectedLab || committingBulk}
            onPress={handleUploadBulkFile}
          />

          {uploadedFileMeta ? (
            <View style={styles.fileMetaBox}>
              <Text style={styles.fileMetaName}>{uploadedFileMeta.fileName}</Text>
              <Text style={styles.fileMetaDetail}>
                Format: {uploadedFileMeta.format.toUpperCase()} •{' '}
                {uploadedFileMeta.totalRows} baris
              </Text>
            </View>
          ) : null}

          {bulkMessage ? (
            <View style={styles.successBanner}>
              <Text style={styles.successBannerText}>{bulkMessage}</Text>
            </View>
          ) : null}

          {bulkError ? (
            <View style={styles.errorBanner}>
              <Text style={styles.errorBannerText}>{bulkError}</Text>
            </View>
          ) : null}
        </SoftCard>
      ) : null}
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar barStyle="dark-content" />

      {mode === 'bulk' && reviewRows.length > 0 ? (
        <View style={styles.bulkReviewRoot}>
          <View style={styles.bulkReviewListWrap}>
            <BulkReviewList
              rows={reviewRows}
              fields={ASPRAK_BULK_FIELDS}
              summary={bulkSummary}
              headerExtra={topControlsSection}
              onToggleRowStatus={handleToggleBulkRow}
              onEditRow={handleEditBulkRow}
              onAcceptAllValid={() =>
                setReviewRows((prev) => acceptAllValidRows(prev))
              }
              onDenyAll={() => setReviewRows((prev) => denyAllRows(prev))}
            />
          </View>

          <View style={styles.bottomBar}>
            <View style={styles.bottomInfo}>
              <Text style={styles.bottomLab}>
                {selectedLab?.nama ?? 'Pilih Lab'}
              </Text>
              <Text style={styles.bottomStats}>
                {bulkSummary.accepted} diterima • {bulkSummary.denied} ditolak
              </Text>
            </View>
            <PillButton
              label={`Simpan Asprak Terpilih (${bulkSummary.accepted} Baris)`}
              variant="accent"
              loading={committingBulk}
              disabled={bulkSummary.accepted === 0 || !selectedLab || committingBulk}
              onPress={() => setConfirmBulkVisible(true)}
            />
          </View>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {topControlsSection}

          {mode === 'single' ? (
            <View style={styles.singleSection}>
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Cari Asprak berdasarkan nama, NIM, atau email..."
                placeholderTextColor="#9CA3AF"
                autoCorrect={false}
                autoCapitalize="none"
                style={styles.searchInput}
              />

              {singleSuccess ? (
                <View style={styles.successBanner}>
                  <Text style={styles.successBannerText}>{singleSuccess}</Text>
                </View>
              ) : null}

              {singleError ? (
                <View style={styles.errorBanner}>
                  <Text style={styles.errorBannerText}>{singleError}</Text>
                </View>
              ) : null}

              {asprakCandidates.length === 0 ? (
                <SoftCard style={styles.emptyCard}>
                  <Text style={styles.emptyTitle}>
                    {searchQuery.trim()
                      ? 'Asprak Tidak Ditemukan'
                      : 'Belum Ada Akun Asprak'}
                  </Text>
                  <Text style={styles.mutedText}>
                    {searchQuery.trim()
                      ? 'Coba kata kunci nama, NIM, atau email lain.'
                      : 'Belum ada pengguna terdaftar dengan role ASPRAK di Firestore.'}
                  </Text>
                </SoftCard>
              ) : (
                asprakCandidates.map((candidate) => {
                  const existing = existingMemberByUserId.get(candidate.uid);
                  const isActiveHere = Boolean(existing?.aktif);
                  const isInactivePreviously = Boolean(
                    existing && !existing.aktif,
                  );
                  const isSavingThis = savingSingleUserId === candidate.uid;

                  return (
                    <SoftCard key={candidate.uid} style={styles.candidateCard}>
                      <View style={styles.candidateTop}>
                        <View style={styles.candidateIdentity}>
                          <Text style={styles.candidateName}>
                            {candidate.nama || 'Tanpa Nama'}
                          </Text>
                          <Text style={styles.candidateMeta}>
                            {candidate.email}
                            {candidate.nim ? ` • NIM: ${candidate.nim}` : ''}
                          </Text>
                        </View>

                        {isActiveHere ? (
                          <Chip
                            label={`Aktif (${existing?.peran ?? 'asprak'})`}
                            tone="dark"
                          />
                        ) : isInactivePreviously ? (
                          <Chip label="Nonaktif" tone="soft" />
                        ) : (
                          <Chip label="Siap Ditugaskan" tone="accent" />
                        )}
                      </View>

                      {isActiveHere ? (
                        <Text style={styles.blockedReason}>
                          Sudah terdaftar aktif sebagai {existing?.peran} di
                          laboratorium ini.
                        </Text>
                      ) : null}

                      <PillButton
                        label={
                          isActiveHere
                            ? 'Sudah Terdaftar di Lab Ini'
                            : isInactivePreviously
                              ? 'Aktifkan Kembali Asprak'
                              : '+ Tugaskan Sebagai Asprak'
                        }
                        variant={isActiveHere ? 'outline' : 'accent'}
                        loading={isSavingThis}
                        disabled={
                          isActiveHere ||
                          !selectedLab ||
                          savingSingleUserId !== null
                        }
                        onPress={() =>
                          handleAddSingleAsprak(
                            candidate.uid,
                            candidate.nama || candidate.email,
                          )
                        }
                        style={styles.singleAddButton}
                      />
                    </SoftCard>
                  );
                })
              )}
            </View>
          ) : (
            <SoftCard style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>Menunggu File Unggahan Asprak</Text>
              <Text style={styles.mutedText}>
                Unduh template Asprak di atas, isi daftar email & nama (NIM
                opsional), lalu unggah file `.csv` atau `.xlsx` untuk direview
                sebelum disimpan.
              </Text>
            </SoftCard>
          )}
        </ScrollView>
      )}

      {/* MODAL KONFIRMASI BULK */}
      <ConfirmModal
        visible={confirmBulkVisible}
        title="Simpan Asprak Terpilih?"
        message={`Sebanyak ${bulkSummary.accepted} Asprak berstatus Accepted akan ditugaskan aktif ke "${selectedLab?.nama ?? ''}" (dokumen labMembers dengan peran "asprak") secara atomik.${bulkSummary.denied > 0 ? ` ${bulkSummary.denied} baris Denied/bermasalah akan dilewati.` : ''}`}
        confirmText="Ya, Simpan Semua"
        cancelText="Periksa Lagi"
        onConfirm={handleConfirmBulkSave}
        onCancel={() => setConfirmBulkVisible(false)}
      />

      {/* MODAL RINGKASAN HASIL AKHIR BULK */}
      <Modal
        visible={commitResult !== null}
        transparent
        animationType="slide"
        onRequestClose={handleCloseResultModal}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.resultSheet}>
            <View style={styles.resultHandle} />

            {commitResult ? (
              <>
                <Text style={styles.resultTitle}>
                  {commitResult.batchError
                    ? 'Penyimpanan Batch Gagal'
                    : 'Penugasan Bulk Asprak Selesai'}
                </Text>
                <Text style={styles.resultSubtitle}>
                  Laboratorium: {selectedLab?.nama ?? commitResult.labId}
                </Text>

                {commitResult.batchError ? (
                  <View style={styles.errorBanner}>
                    <Text style={styles.errorBannerText}>
                      {commitResult.batchError}
                    </Text>
                  </View>
                ) : null}

                <View style={styles.resultStatsRow}>
                  <View style={[styles.resultStat, styles.resultStatAccent]}>
                    <Text style={styles.resultStatValOnColor}>
                      {commitResult.savedCount}
                    </Text>
                    <Text style={styles.resultStatLblOnColor}>Berhasil</Text>
                  </View>
                  <View style={styles.resultStat}>
                    <Text style={styles.resultStatVal}>
                      {commitResult.skippedCount}
                    </Text>
                    <Text style={styles.resultStatLbl}>Dilewati</Text>
                  </View>
                  <View
                    style={[
                      styles.resultStat,
                      commitResult.failedCount > 0 && styles.resultStatDanger,
                    ]}
                  >
                    <Text
                      style={[
                        styles.resultStatVal,
                        commitResult.failedCount > 0 &&
                          styles.resultStatValDanger,
                      ]}
                    >
                      {commitResult.failedCount}
                    </Text>
                    <Text style={styles.resultStatLbl}>Gagal</Text>
                  </View>
                </View>

                <ScrollView
                  style={styles.resultItemsScroll}
                  contentContainerStyle={styles.resultItemsContent}
                  showsVerticalScrollIndicator={false}
                >
                  {commitResult.items.map((item) => (
                    <View
                      key={`res-a-${item.rowIndex}-${item.email}`}
                      style={styles.resultItemCard}
                    >
                      <View style={styles.resultItemTop}>
                        <Text style={styles.resultItemTitle}>
                          Baris #{item.rowIndex} — {item.nama}
                        </Text>
                        <Chip
                          label={
                            item.status === 'saved'
                              ? 'BERHASIL'
                              : item.status === 'failed'
                                ? 'GAGAL'
                                : 'DILEWATI'
                          }
                          tone={
                            item.status === 'saved'
                              ? 'accent'
                              : item.status === 'failed'
                                ? 'dark'
                                : 'soft'
                          }
                        />
                      </View>
                      <Text style={styles.resultItemReason}>{item.reason}</Text>
                    </View>
                  ))}
                </ScrollView>

                <PillButton
                  label="Tutup Ringkasan"
                  variant="dark"
                  onPress={handleCloseResultModal}
                />
              </>
            ) : null}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: UI.page,
    flex: 1,
  },
  centered: {
    alignItems: 'center',
    backgroundColor: UI.page,
    flex: 1,
    gap: 12,
    justifyContent: 'center',
    padding: 24,
  },
  deniedTitle: {
    color: UI.ink,
    fontFamily: FONT.extrabold,
    fontSize: 20,
  },
  mutedText: {
    color: UI.muted,
    fontFamily: FONT.regular,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
  mutedSmall: {
    color: UI.muted,
    fontFamily: FONT.regular,
    fontSize: 12,
  },
  scrollContent: {
    gap: 14,
    paddingBottom: TAB_BAR_SPACE,
    paddingHorizontal: UI.padding,
    paddingTop: 12,
  },
  topStack: {
    gap: 14,
  },
  selectorCard: {
    gap: 10,
    padding: 16,
  },
  sectionLabel: {
    color: UI.ink,
    fontFamily: FONT.extrabold,
    fontSize: 15,
  },
  inlineLoading: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  labMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  bulkActionCard: {
    gap: 10,
    padding: 16,
  },
  helperText: {
    color: UI.muted,
    fontFamily: FONT.regular,
    fontSize: 12,
    lineHeight: 18,
  },
  templateRow: {
    flexDirection: 'row',
    gap: 8,
  },
  halfButton: {
    flex: 1,
    minHeight: 44,
    paddingHorizontal: 10,
  },
  fileMetaBox: {
    backgroundColor: UI.soft,
    borderRadius: 12,
    gap: 2,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  fileMetaName: {
    color: UI.ink,
    fontFamily: FONT.bold,
    fontSize: 13,
  },
  fileMetaDetail: {
    color: UI.muted,
    fontFamily: FONT.regular,
    fontSize: 12,
  },
  singleSection: {
    gap: 12,
  },
  searchInput: {
    backgroundColor: UI.page,
    borderColor: UI.border,
    borderRadius: 14,
    borderWidth: 1,
    color: UI.ink,
    fontFamily: FONT.regular,
    fontSize: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  candidateCard: {
    gap: 10,
    padding: 16,
  },
  candidateTop: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  candidateIdentity: {
    flex: 1,
    gap: 3,
  },
  candidateName: {
    color: UI.ink,
    fontFamily: FONT.extrabold,
    fontSize: 15,
  },
  candidateMeta: {
    color: UI.muted,
    fontFamily: FONT.regular,
    fontSize: 12,
  },
  blockedReason: {
    color: '#9A3412',
    fontFamily: FONT.medium,
    fontSize: 12,
  },
  singleAddButton: {
    minHeight: 42,
  },
  emptyCard: {
    alignItems: 'center',
    gap: 6,
    paddingVertical: 24,
  },
  emptyTitle: {
    color: UI.ink,
    fontFamily: FONT.bold,
    fontSize: 15,
  },
  successBanner: {
    backgroundColor: '#FFF7ED',
    borderColor: UI.accent,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
  },
  successBannerText: {
    color: '#9A3412',
    fontFamily: FONT.semibold,
    fontSize: 12,
    lineHeight: 18,
  },
  errorBanner: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FCA5A5',
    borderRadius: 12,
    borderWidth: 1,
    gap: 4,
    padding: 12,
  },
  errorBannerText: {
    color: '#991B1B',
    fontFamily: FONT.semibold,
    fontSize: 12,
    lineHeight: 18,
  },
  retryLink: {
    color: UI.ink,
    fontFamily: FONT.bold,
    fontSize: 12,
    textDecorationLine: 'underline',
  },
  bulkReviewRoot: {
    flex: 1,
  },
  bulkReviewListWrap: {
    flex: 1,
    paddingHorizontal: UI.padding,
    paddingTop: 12,
  },
  bottomBar: {
    backgroundColor: UI.page,
    borderTopColor: UI.line,
    borderTopWidth: 1,
    gap: 8,
    paddingBottom: 16,
    paddingHorizontal: UI.padding,
    paddingTop: 12,
  },
  bottomInfo: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  bottomLab: {
    color: UI.ink,
    fontFamily: FONT.bold,
    fontSize: 13,
  },
  bottomStats: {
    color: UI.muted,
    fontFamily: FONT.medium,
    fontSize: 12,
  },
  modalBackdrop: {
    backgroundColor: 'rgba(17, 16, 20, 0.55)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  resultSheet: {
    backgroundColor: UI.page,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    gap: 12,
    maxHeight: '84%',
    paddingBottom: 24,
    paddingHorizontal: UI.padding,
    paddingTop: 12,
  },
  resultHandle: {
    alignSelf: 'center',
    backgroundColor: '#D4D4D8',
    borderRadius: 999,
    height: 4,
    width: 44,
  },
  resultTitle: {
    color: UI.ink,
    fontFamily: FONT.extrabold,
    fontSize: 20,
  },
  resultSubtitle: {
    color: UI.muted,
    fontFamily: FONT.medium,
    fontSize: 13,
  },
  resultStatsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  resultStat: {
    alignItems: 'center',
    backgroundColor: UI.soft,
    borderRadius: 16,
    flex: 1,
    gap: 2,
    paddingVertical: 10,
  },
  resultStatAccent: {
    backgroundColor: UI.accent,
  },
  resultStatDanger: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FCA5A5',
    borderWidth: 1,
  },
  resultStatVal: {
    color: UI.ink,
    fontFamily: FONT.extrabold,
    fontSize: 18,
  },
  resultStatValOnColor: {
    color: UI.onColor,
    fontFamily: FONT.extrabold,
    fontSize: 18,
  },
  resultStatValDanger: {
    color: UI.danger,
  },
  resultStatLbl: {
    color: UI.muted,
    fontFamily: FONT.medium,
    fontSize: 11,
  },
  resultStatLblOnColor: {
    color: UI.onColorMuted,
    fontFamily: FONT.medium,
    fontSize: 11,
  },
  resultItemsScroll: {
    maxHeight: 280,
  },
  resultItemsContent: {
    gap: 8,
    paddingBottom: 6,
  },
  resultItemCard: {
    backgroundColor: '#FAFAFA',
    borderColor: UI.line,
    borderRadius: 14,
    borderWidth: 1,
    gap: 4,
    padding: 12,
  },
  resultItemTop: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
  },
  resultItemTitle: {
    color: UI.ink,
    flex: 1,
    fontFamily: FONT.bold,
    fontSize: 13,
  },
  resultItemReason: {
    color: UI.muted,
    fontFamily: FONT.regular,
    fontSize: 12,
    lineHeight: 17,
  },
});
