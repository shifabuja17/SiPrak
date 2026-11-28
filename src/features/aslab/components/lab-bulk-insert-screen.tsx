import { router } from 'expo-router';
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
import Dropdown from '@/components/common/Dropdown';
import { FONT } from '@/constants/fonts';
import { useAuth } from '@/context/AuthContext';
import {
  BULK_MAX_ROWS,
  BulkReviewList,
  createLabBulkValidationSchema,
  downloadLabTemplate,
  LAB_BULK_FIELDS,
  LAB_BULK_REQUIRED_HEADERS,
  LAB_TEMPLATE_DEFINITION,
  parseBulkFile,
  pickBulkDocument,
  summarizeBulkRows,
  toggleBulkRowStatus,
  acceptAllValidRows,
  denyAllRows,
  updateRowAndRevalidate,
  validateBulkRows,
  type BulkFileFormat,
  type BulkLaboratoryItem,
  type BulkParsedRow,
  type BulkReviewRow,
} from '@/features/bulk';
import {
  BackLink,
  Chip,
  PillButton,
  ScreenTitle,
  SoftCard,
  UI,
} from '@/features/praktikan/ui/praktikan-ui';
import {
  bulkCreateLaboratories,
  getAvailableCourseOptions,
  getExistingLaboratoryKeysByCourse,
  type BulkCreateLaboratoriesResult,
  type CourseOptionItem,
} from '@/services/laboratory-service';

function isAslabRole(rawRole: unknown): boolean {
  return typeof rawRole === 'string' && rawRole.trim().toUpperCase() === 'ASLAB';
}

/**
 * Layar khusus Bulk Insert Laboratorium untuk Aslab (FR-03, FR-08, NFR-02).
 */
export default function LabBulkInsertScreen() {
  const { profile, loading: authLoading } = useAuth();
  const isAuthorized = isAslabRole(profile?.role);

  // Langkah 1: Mata Kuliah tujuan (`mataKuliahId`)
  const [courseOptions, setCourseOptions] = useState<CourseOptionItem[]>([]);
  const [loadingCourses, setLoadingCourses] = useState(false);
  const [courseLoadError, setCourseLoadError] = useState<string | null>(null);
  const [selectedCourseId, setSelectedCourseId] = useState('');

  // Langkah 2: Template & Upload File
  const [downloadingFormat, setDownloadingFormat] =
    useState<BulkFileFormat | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [uploadedFileMeta, setUploadedFileMeta] = useState<{
    fileName: string;
    format: BulkFileFormat;
    totalRows: number;
  } | null>(null);

  // Langkah 3: Review & Validasi Baris
  const [parsedRows, setParsedRows] = useState<BulkParsedRow[]>([]);
  const [reviewRows, setReviewRows] = useState<BulkReviewRow<BulkLaboratoryItem>[]>([]);
  const [revalidating, setRevalidating] = useState(false);

  // Langkah 4: Konfirmasi & Simpan Atomik
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [commitResult, setCommitResult] =
    useState<BulkCreateLaboratoriesResult | null>(null);

  const cleanCourseId = selectedCourseId.trim();

  const loadCourseOptions = useCallback(async () => {
    setLoadingCourses(true);
    setCourseLoadError(null);
    try {
      const options = await getAvailableCourseOptions();
      setCourseOptions(options);
    } catch (error) {
      setCourseLoadError(
        error instanceof Error
          ? error.message
          : 'Gagal memuat daftar mata kuliah dari Firestore.',
      );
    } finally {
      setLoadingCourses(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading || !isAuthorized) return;
    loadCourseOptions();
  }, [authLoading, isAuthorized, loadCourseOptions]);

  const checkDbDuplicatesForCourse = useCallback(
    async (courseId: string) => {
      return await getExistingLaboratoryKeysByCourse(courseId);
    },
    [],
  );

  const summary = useMemo(() => summarizeBulkRows(reviewRows), [reviewRows]);

  const handleSelectCourseFromDropdown = useCallback(
    async (value: string) => {
      setSelectedCourseId(value);
      setActionMessage(null);
      setFileError(null);

      if (parsedRows.length === 0) return;

      const trimmed = value.trim();
      if (!trimmed) return;

      setRevalidating(true);
      try {
        const schema = createLabBulkValidationSchema(trimmed);
        const existingKeys = await checkDbDuplicatesForCourse(trimmed);
        const nextReviewed = await validateBulkRows(
          parsedRows,
          schema,
          existingKeys,
          reviewRows,
        );
        setReviewRows(nextReviewed);
      } catch (error) {
        setFileError(
          error instanceof Error
            ? error.message
            : 'Gagal memvalidasi ulang data untuk mata kuliah terpilih.',
        );
      } finally {
        setRevalidating(false);
      }
    },
    [parsedRows, reviewRows, checkDbDuplicatesForCourse],
  );

  const handleRevalidateCourseManual = useCallback(async () => {
    if (!cleanCourseId || parsedRows.length === 0) return;
    setRevalidating(true);
    setFileError(null);
    try {
      const schema = createLabBulkValidationSchema(cleanCourseId);
      const existingKeys = await checkDbDuplicatesForCourse(cleanCourseId);
      const nextReviewed = await validateBulkRows(
        parsedRows,
        schema,
        existingKeys,
        reviewRows,
      );
      setReviewRows(nextReviewed);
      setActionMessage(
        `Validasi ulang selesai untuk mata kuliah ${cleanCourseId}.`,
      );
    } catch (error) {
      setFileError(
        error instanceof Error
          ? error.message
          : 'Gagal memvalidasi ulang data terhadap Firestore.',
      );
    } finally {
      setRevalidating(false);
    }
  }, [cleanCourseId, parsedRows, reviewRows, checkDbDuplicatesForCourse]);

  const handleDownloadTemplate = useCallback(async (format: BulkFileFormat) => {
    setDownloadingFormat(format);
    setFileError(null);
    setActionMessage(null);
    try {
      const res = await downloadLabTemplate(format);
      setActionMessage(
        `Template "${res.fileName}" siap dibagikan atau disimpan.`,
      );
    } catch (error) {
      setFileError(
        error instanceof Error
          ? error.message
          : 'Gagal menyiapkan file template laboratorium.',
      );
    } finally {
      setDownloadingFormat(null);
    }
  }, []);

  const handleUploadAndParse = useCallback(async () => {
    setFileError(null);
    setActionMessage(null);

    if (!cleanCourseId) {
      setFileError(
        'Pilih atau isi Kode Mata Kuliah tujuan (Langkah 1) terlebih dahulu sebelum mengunggah file.',
      );
      return;
    }

    setUploadingFile(true);
    try {
      const picked = await pickBulkDocument();
      if (!picked) {
        return;
      }

      const parsed = await parseBulkFile(picked, {
        requiredHeaders: LAB_BULK_REQUIRED_HEADERS,
        expectedHeaders: LAB_TEMPLATE_DEFINITION.headers,
        maxRows: BULK_MAX_ROWS,
      });

      const schema = createLabBulkValidationSchema(cleanCourseId);
      const existingKeys = await checkDbDuplicatesForCourse(cleanCourseId);
      const validated = await validateBulkRows(
        parsed.rows,
        schema,
        existingKeys,
      );

      setUploadedFileMeta({
        fileName: parsed.fileName,
        format: parsed.format,
        totalRows: parsed.totalRows,
      });
      setParsedRows(parsed.rows);
      setReviewRows(validated);
      setActionMessage(
        `Berhasil memuat ${parsed.totalRows} baris dari "${parsed.fileName}". Silakan review sebelum menyimpan.`,
      );
    } catch (error) {
      setFileError(
        error instanceof Error
          ? error.message
          : 'Gagal membaca atau memvalidasi file unggahan.',
      );
    } finally {
      setUploadingFile(false);
    }
  }, [cleanCourseId, checkDbDuplicatesForCourse]);

  const handleToggleRowStatus = useCallback(
    (rowId: string) => {
      const result = toggleBulkRowStatus(reviewRows, rowId);
      if (result.changed) {
        setReviewRows(result.rows);
      }
      return { rejectedReason: result.rejectedReason };
    },
    [reviewRows],
  );

  const handleEditRow = useCallback(
    async (rowId: string, updatedRaw: Record<string, string>) => {
      if (!cleanCourseId) {
        throw new Error('Kode mata kuliah tujuan belum dipilih.');
      }

      const schema = createLabBulkValidationSchema(cleanCourseId);
      const existingKeys = await checkDbDuplicatesForCourse(cleanCourseId);
      const nextRows = await updateRowAndRevalidate(
        reviewRows,
        rowId,
        updatedRaw,
        schema,
        existingKeys,
      );

      setReviewRows(nextRows);
      setParsedRows(
        nextRows.map((item) => ({
          rowIndex: item.rowIndex,
          raw: item.raw,
        })),
      );
    },
    [cleanCourseId, reviewRows, checkDbDuplicatesForCourse],
  );

  const handleAcceptAllValid = useCallback(() => {
    setReviewRows((prev) => acceptAllValidRows(prev));
  }, []);

  const handleDenyAll = useCallback(() => {
    setReviewRows((prev) => denyAllRows(prev));
  }, []);

  const handleConfirmSave = useCallback(async () => {
    if (!cleanCourseId || summary.accepted === 0) {
      setConfirmVisible(false);
      return;
    }

    setConfirmVisible(false);
    setCommitting(true);
    setFileError(null);
    setActionMessage(null);

    try {
      const result = await bulkCreateLaboratories(cleanCourseId, reviewRows);
      setCommitResult(result);
    } catch (error) {
      setFileError(
        error instanceof Error
          ? error.message
          : 'Gagal menyimpan batch laboratorium ke Firestore.',
      );
    } finally {
      setCommitting(false);
    }
  }, [cleanCourseId, summary.accepted, reviewRows]);

  const handleCloseResultModal = useCallback(() => {
    const saved = (commitResult?.savedCount ?? 0) > 0;
    setCommitResult(null);
    if (saved) {
      setParsedRows([]);
      setReviewRows([]);
      setUploadedFileMeta(null);
      setActionMessage(
        'Import bulk laboratorium selesai disimpan. Anda dapat mengunggah file berikutnya.',
      );
      loadCourseOptions();
    }
  }, [commitResult, loadCourseOptions]);

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
          Halaman Bulk Insert Laboratorium hanya dapat diakses oleh Asisten Lab
          (Aslab).
        </Text>
        <PillButton label="Kembali" onPress={() => router.back()} />
      </SafeAreaView>
    );
  }

  const stepsHeaderContent = (
    <View style={styles.stepsStack}>
      <BackLink label="Kembali" onPress={() => router.back()} />

      <ScreenTitle
        title="Bulk Insert Laboratorium"
        subtitle="Tambah banyak titik laboratorium sekaligus untuk satu mata kuliah dengan validasi sebelum simpan."
      />

      {/* LANGKAH 1: PILIH MATA KULIAH TUJUAN */}
      <SoftCard style={styles.stepCard}>
        <View style={styles.stepHeader}>
          <Chip label="LANGKAH 1" tone="dark" />
          <Text style={styles.stepTitle}>Pilih Mata Kuliah Tujuan</Text>
        </View>
        <Text style={styles.stepDesc}>
          Pilih satu mata kuliah dari daftar atau ketik kode mata kuliah tujuan
          (wajib diisi sebelum mengunggah file).
        </Text>

        {loadingCourses ? (
          <View style={styles.inlineLoading}>
            <ActivityIndicator size="small" color={UI.ink} />
            <Text style={styles.mutedSmall}>Memuat daftar mata kuliah...</Text>
          </View>
        ) : courseLoadError ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>{courseLoadError}</Text>
            <Pressable onPress={loadCourseOptions}>
              <Text style={styles.retryLink}>Muat ulang daftar</Text>
            </Pressable>
          </View>
        ) : courseOptions.length > 0 ? (
          <Dropdown
            value={selectedCourseId}
            options={courseOptions}
            onChange={handleSelectCourseFromDropdown}
            placeholder="Pilih dari mata kuliah terdaftar (opsional)"
            accessibilityLabel="Pilih mata kuliah tujuan"
          />
        ) : null}

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Kode Mata Kuliah (`mataKuliahId`) *</Text>
          <View style={styles.courseInputRow}>
            <TextInput
              value={selectedCourseId}
              onChangeText={setSelectedCourseId}
              placeholder="Contoh: IF201-PBO"
              placeholderTextColor="#9CA3AF"
              autoCapitalize="characters"
              autoCorrect={false}
              editable={!committing && !uploadingFile}
              style={styles.courseInput}
            />
            {parsedRows.length > 0 && cleanCourseId.length > 0 ? (
              <Pressable
                accessibilityRole="button"
                disabled={revalidating}
                onPress={handleRevalidateCourseManual}
                style={({ pressed }) => [
                  styles.revalidateChipButton,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.revalidateChipText}>
                  {revalidating ? 'Mengecek...' : 'Cek Ulang'}
                </Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </SoftCard>

      {/* LANGKAH 2: UNDUH TEMPLATE & UNGGAH FILE */}
      <SoftCard style={styles.stepCard}>
        <View style={styles.stepHeader}>
          <Chip label="LANGKAH 2" tone="dark" />
          <Text style={styles.stepTitle}>Unduh Template & Unggah File</Text>
        </View>
        <Text style={styles.stepDesc}>
          Format didukung: `.xlsx` dan `.csv` (maksimal {BULK_MAX_ROWS} baris
          data per unggahan).
        </Text>

        <View style={styles.templateRow}>
          <PillButton
            label="Unduh Template (.xlsx)"
            variant="outline"
            loading={downloadingFormat === 'xlsx'}
            disabled={downloadingFormat !== null || committing}
            onPress={() => handleDownloadTemplate('xlsx')}
            style={styles.halfButton}
          />
          <PillButton
            label="Unduh Template (.csv)"
            variant="outline"
            loading={downloadingFormat === 'csv'}
            disabled={downloadingFormat !== null || committing}
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
          disabled={committing || revalidating}
          onPress={handleUploadAndParse}
        />

        {uploadedFileMeta ? (
          <View style={styles.fileMetaBox}>
            <Text style={styles.fileMetaName}>{uploadedFileMeta.fileName}</Text>
            <Text style={styles.fileMetaDetail}>
              Format: {uploadedFileMeta.format.toUpperCase()} •{' '}
              {uploadedFileMeta.totalRows} baris data
            </Text>
          </View>
        ) : null}

        {actionMessage ? (
          <View style={styles.successBanner}>
            <Text style={styles.successBannerText}>{actionMessage}</Text>
          </View>
        ) : null}

        {fileError ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>{fileError}</Text>
          </View>
        ) : null}
      </SoftCard>

      {reviewRows.length > 0 ? (
        <View style={styles.step3Intro}>
          <Chip label="LANGKAH 3" tone="accent" />
          <Text style={styles.stepTitle}>Review, Edit, & Validasi Data</Text>
        </View>
      ) : null}
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar barStyle="dark-content" />

      {reviewRows.length === 0 ? (
        <ScrollView
          contentContainerStyle={styles.emptyScrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {stepsHeaderContent}
          <SoftCard style={styles.placeholderCard}>
            <Text style={styles.placeholderTitle}>
              Menunggu Unggahan File Laboratorium
            </Text>
            <Text style={styles.placeholderDesc}>
              Setelah file `.csv` atau `.xlsx` diunggah, daftar baris beserta
              hasil pengecekan format dan duplikat Firestore akan muncul di
              sini untuk direview sebelum disimpan.
            </Text>
          </SoftCard>
        </ScrollView>
      ) : (
        <View style={styles.reviewContainer}>
          <View style={styles.reviewListWrapper}>
            <BulkReviewList
              rows={reviewRows}
              fields={LAB_BULK_FIELDS}
              summary={summary}
              headerExtra={stepsHeaderContent}
              onToggleRowStatus={handleToggleRowStatus}
              onEditRow={handleEditRow}
              onAcceptAllValid={handleAcceptAllValid}
              onDenyAll={handleDenyAll}
            />
          </View>

          {/* LANGKAH 4: BAR AKSI SIMPAN ATOMIK */}
          <View style={styles.bottomBar}>
            <View style={styles.bottomInfo}>
              <Text style={styles.bottomLabel}>
                Mata Kuliah: {cleanCourseId || '-'}
              </Text>
              <Text style={styles.bottomCount}>
                {summary.accepted} diterima • {summary.denied} ditolak
              </Text>
            </View>
            <PillButton
              label={`Simpan Laboratorium Terpilih (${summary.accepted} Baris)`}
              variant="accent"
              loading={committing}
              disabled={
                summary.accepted === 0 ||
                !cleanCourseId ||
                committing ||
                revalidating
              }
              onPress={() => setConfirmVisible(true)}
            />
          </View>
        </View>
      )}

      {/* MODAL KONFIRMASI SIMPAN */}
      <ConfirmModal
        visible={confirmVisible}
        title="Simpan Batch Laboratorium?"
        message={`Sebanyak ${summary.accepted} laboratorium valid untuk mata kuliah "${cleanCourseId}" akan disimpan secara atomik ke Firestore. ${summary.denied > 0 ? `${summary.denied} baris berstatus Denied/bermasalah akan dilewati.` : ''}`}
        confirmText="Ya, Simpan Semua"
        cancelText="Periksa Lagi"
        onConfirm={handleConfirmSave}
        onCancel={() => setConfirmVisible(false)}
      />

      {/* MODAL RINGKASAN HASIL AKHIR */}
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
                    : 'Import Bulk Laboratorium Selesai'}
                </Text>
                <Text style={styles.resultSubtitle}>
                  Mata Kuliah: {commitResult.mataKuliahId}
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
                        commitResult.failedCount > 0 && styles.resultStatValDanger,
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
                      key={`res-${item.rowIndex}-${item.nama}`}
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
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  mutedSmall: {
    color: UI.muted,
    fontFamily: FONT.regular,
    fontSize: 12,
  },
  emptyScrollContent: {
    gap: 16,
    paddingBottom: 40,
    paddingHorizontal: UI.padding,
    paddingTop: 12,
  },
  reviewContainer: {
    flex: 1,
  },
  reviewListWrapper: {
    flex: 1,
    paddingHorizontal: UI.padding,
    paddingTop: 12,
  },
  stepsStack: {
    gap: 14,
  },
  stepCard: {
    gap: 10,
    padding: 16,
  },
  stepHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  stepTitle: {
    color: UI.ink,
    fontFamily: FONT.extrabold,
    fontSize: 16,
  },
  stepDesc: {
    color: UI.muted,
    fontFamily: FONT.regular,
    fontSize: 13,
    lineHeight: 18,
  },
  step3Intro: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingTop: 4,
  },
  inlineLoading: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  inputGroup: {
    gap: 6,
  },
  inputLabel: {
    color: UI.ink,
    fontFamily: FONT.semibold,
    fontSize: 13,
  },
  courseInputRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  courseInput: {
    backgroundColor: UI.page,
    borderColor: UI.border,
    borderRadius: 14,
    borderWidth: 1,
    color: UI.ink,
    flex: 1,
    fontFamily: FONT.medium,
    fontSize: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  revalidateChipButton: {
    backgroundColor: UI.ink,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  revalidateChipText: {
    color: UI.onColor,
    fontFamily: FONT.bold,
    fontSize: 12,
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
  placeholderCard: {
    alignItems: 'center',
    gap: 6,
    paddingVertical: 24,
  },
  placeholderTitle: {
    color: UI.ink,
    fontFamily: FONT.bold,
    fontSize: 15,
  },
  placeholderDesc: {
    color: UI.muted,
    fontFamily: FONT.regular,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
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
  bottomLabel: {
    color: UI.ink,
    fontFamily: FONT.bold,
    fontSize: 13,
  },
  bottomCount: {
    color: UI.muted,
    fontFamily: FONT.medium,
    fontSize: 12,
  },
  pressed: {
    opacity: 0.72,
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
