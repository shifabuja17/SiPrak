import type {
  BulkDbDuplicateChecker,
  BulkFieldSpec,
  BulkParsedRow,
  BulkReviewRow,
  BulkReviewSummary,
  BulkRowStatus,
  BulkToggleStatusResult,
  BulkValidationSchema,
} from './types';

function normalizeRowRaw(
  raw: Record<string, string>,
  fields: readonly BulkFieldSpec[],
): Record<string, string> {
  const normalized: Record<string, string> = {};

  for (const [key, value] of Object.entries(raw)) {
    normalized[key] = typeof value === 'string' ? value.trim() : '';
  }

  for (const field of fields) {
    if (!(field.key in normalized)) {
      normalized[field.key] = '';
    }
  }

  return normalized;
}

function appendUniqueError(target: string[], message: string): void {
  const trimmed = message.trim();
  if (!trimmed || target.includes(trimmed)) return;
  target.push(trimmed);
}

async function resolveExistingDuplicateKeys(
  checker: BulkDbDuplicateChecker | undefined,
  candidateKeys: string[],
): Promise<ReadonlySet<string>> {
  if (!checker || candidateKeys.length === 0) {
    return new Set<string>();
  }

  if (typeof checker === 'function') {
    return await checker(candidateKeys);
  }

  return checker;
}

/**
 * Memvalidasi seluruh baris hasil parsing terhadap:
 * 1. Kolom wajib yang kosong.
 * 2. Format/tipe/rentang nilai per field dan `schema.parseRow`.
 * 3. Duplikat antar baris di dalam file yang sama.
 * 4. Duplikat terhadap data yang sudah ada di Cloud Firestore.
 */
export async function validateBulkRows<T>(
  rows: readonly BulkParsedRow[],
  schema: BulkValidationSchema<T>,
  checkDbDuplicates?: BulkDbDuplicateChecker,
  previousRows?: readonly BulkReviewRow<T>[],
): Promise<BulkReviewRow<T>[]> {
  const previousByRowId = new Map<string, BulkReviewRow<T>>();
  for (const prev of previousRows ?? []) {
    previousByRowId.set(prev.rowId, prev);
  }

  const firstOccurrenceByKey = new Map<string, number>();
  const uniqueCandidateKeys = new Set<string>();

  const draftEntries = rows.map((row) => {
    const rowId = `row-${row.rowIndex}`;
    const normalizedRaw = normalizeRowRaw(row.raw, schema.fields);
    const errors: string[] = [];

    for (const field of schema.fields) {
      const value = normalizedRaw[field.key] ?? '';
      if (field.required && value.length === 0) {
        appendUniqueError(errors, `Kolom wajib "${field.label}" kosong.`);
        continue;
      }

      if (value.length > 0 && field.validate) {
        const fieldError = field.validate(value, normalizedRaw);
        if (fieldError) {
          appendUniqueError(errors, fieldError);
        }
      }
    }

    const parsed = schema.parseRow(normalizedRaw);
    for (const parseError of parsed.errors) {
      appendUniqueError(errors, parseError);
    }

    const rawDuplicateKey = schema.getDuplicateKey(normalizedRaw, parsed.data);
    const duplicateKey =
      typeof rawDuplicateKey === 'string' && rawDuplicateKey.trim().length > 0
        ? rawDuplicateKey.trim()
        : null;

    let isDuplicateInFile = false;
    if (duplicateKey) {
      uniqueCandidateKeys.add(duplicateKey);
      const firstRowIndex = firstOccurrenceByKey.get(duplicateKey);
      if (firstRowIndex !== undefined) {
        isDuplicateInFile = true;
        const message = schema.duplicateInFileMessage
          ? schema.duplicateInFileMessage(
              row.rowIndex,
              firstRowIndex,
              duplicateKey,
            )
          : `Duplikat dalam file dengan baris #${firstRowIndex}.`;
        appendUniqueError(errors, message);
      } else {
        firstOccurrenceByKey.set(duplicateKey, row.rowIndex);
      }
    }

    return {
      rowId,
      rowIndex: row.rowIndex,
      raw: normalizedRaw,
      data: parsed.data,
      errors,
      isDuplicateInFile,
      duplicateKey,
    };
  });

  const existingDbKeys = await resolveExistingDuplicateKeys(
    checkDbDuplicates,
    Array.from(uniqueCandidateKeys),
  );

  return draftEntries.map((entry) => {
    const isDuplicateInDb = Boolean(
      entry.duplicateKey && existingDbKeys.has(entry.duplicateKey),
    );

    if (isDuplicateInDb && entry.duplicateKey) {
      const message = schema.duplicateInDbMessage
        ? schema.duplicateInDbMessage(entry.duplicateKey)
        : 'Data sudah terdaftar di database Firestore.';
      appendUniqueError(entry.errors, message);
    }

    const hasErrors = entry.errors.length > 0;
    const previous = previousByRowId.get(entry.rowId);
    const preserveManualDeny =
      !hasErrors &&
      previous !== undefined &&
      previous.errors.length === 0 &&
      previous.status === 'denied';

    const status: BulkRowStatus =
      hasErrors || preserveManualDeny ? 'denied' : 'accepted';

    return {
      rowId: entry.rowId,
      rowIndex: entry.rowIndex,
      raw: entry.raw,
      data: entry.data,
      status,
      errors: entry.errors,
      isDuplicateInFile: entry.isDuplicateInFile,
      isDuplicateInDb,
      duplicateKey: entry.duplicateKey,
      selectedForCommit: status === 'accepted',
    };
  });
}

/**
 * Menghitung ringkasan dinamis dari daftar baris review.
 */
export function summarizeBulkRows<T>(
  rows: readonly BulkReviewRow<T>[],
): BulkReviewSummary {
  let accepted = 0;
  let denied = 0;
  let withErrors = 0;
  let duplicateInFile = 0;
  let duplicateInDb = 0;
  let selectedForCommit = 0;

  for (const row of rows) {
    if (row.status === 'accepted') accepted += 1;
    else denied += 1;

    if (row.errors.length > 0) withErrors += 1;
    if (row.isDuplicateInFile) duplicateInFile += 1;
    if (row.isDuplicateInDb) duplicateInDb += 1;
    if (row.selectedForCommit) selectedForCommit += 1;
  }

  return {
    total: rows.length,
    accepted,
    denied,
    withErrors,
    duplicateInFile,
    duplicateInDb,
    selectedForCommit,
  };
}

/**
 * Mengubah status Accept/Deny satu baris. Baris yang masih memiliki error tidak
 * diizinkan berubah menjadi `accepted` hingga diperbaiki.
 */
export function toggleBulkRowStatus<T>(
  rows: readonly BulkReviewRow<T>[],
  rowId: string,
  nextStatus?: BulkRowStatus,
): BulkToggleStatusResult<T> {
  const target = rows.find((row) => row.rowId === rowId);
  if (!target) {
    throw new Error(`Baris review dengan ID "${rowId}" tidak ditemukan.`);
  }

  const desiredStatus: BulkRowStatus =
    nextStatus ?? (target.status === 'accepted' ? 'denied' : 'accepted');

  if (desiredStatus === 'accepted' && target.errors.length > 0) {
    return {
      rows: [...rows],
      changed: false,
      rejectedReason: `Baris #${target.rowIndex} masih memiliki ${target.errors.length} kesalahan validasi. Perbaiki melalui Edit sebelum di-Accept.`,
    };
  }

  if (target.status === desiredStatus) {
    return {
      rows: [...rows],
      changed: false,
      rejectedReason: null,
    };
  }

  const updated = rows.map((row) =>
    row.rowId === rowId
      ? {
          ...row,
          status: desiredStatus,
          selectedForCommit: desiredStatus === 'accepted',
        }
      : row,
  );

  return {
    rows: updated,
    changed: true,
    rejectedReason: null,
  };
}

/**
 * Mengubah semua baris valid (`errors.length === 0`) menjadi `accepted`.
 */
export function acceptAllValidRows<T>(
  rows: readonly BulkReviewRow<T>[],
): BulkReviewRow<T>[] {
  return rows.map((row) => {
    if (row.errors.length > 0) {
      return row;
    }
    return {
      ...row,
      status: 'accepted',
      selectedForCommit: true,
    };
  });
}

/**
 * Mengubah seluruh baris menjadi `denied`.
 */
export function denyAllRows<T>(
  rows: readonly BulkReviewRow<T>[],
): BulkReviewRow<T>[] {
  return rows.map((row) => ({
    ...row,
    status: 'denied',
    selectedForCommit: false,
  }));
}

/**
 * Memperbarui data mentah satu baris lalu menjalankan validasi ulang ke seluruh baris
 * (termasuk pengecekan ulang duplikat di dalam file dan di Firestore).
 */
export async function updateRowAndRevalidate<T>(
  rows: readonly BulkReviewRow<T>[],
  rowId: string,
  updatedRaw: Record<string, string>,
  schema: BulkValidationSchema<T>,
  checkDbDuplicates?: BulkDbDuplicateChecker,
): Promise<BulkReviewRow<T>[]> {
  const targetExists = rows.some((row) => row.rowId === rowId);
  if (!targetExists) {
    throw new Error(`Baris review dengan ID "${rowId}" tidak ditemukan.`);
  }

  const parsedRows: BulkParsedRow[] = rows.map((row) => ({
    rowIndex: row.rowIndex,
    raw: row.rowId === rowId ? { ...row.raw, ...updatedRaw } : row.raw,
  }));

  const preservedOthers = rows.filter((row) => row.rowId !== rowId);
  return validateBulkRows(parsedRows, schema, checkDbDuplicates, preservedOthers);
}
