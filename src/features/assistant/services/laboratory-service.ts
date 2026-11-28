import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  writeBatch,
  type DocumentData,
  type QuerySnapshot,
  type Unsubscribe,
} from 'firebase/firestore';

import { authErrorMessage } from '@/context/AuthContext';
import {
  BULK_MAX_ROWS,
  normalizeLabDuplicateKey,
  type BulkLaboratoryItem,
  type BulkReviewRow,
} from '@/features/bulk';
import { db } from '@/lib/firebase';

// ==========================================
// KONSTANTA & DEFINISI 4 LOKASI TETAP
// ==========================================

export const LABORATORIES_COLLECTION = 'laboratories';

export const DEFAULT_LABORATORY_RADIUS_METERS = 50;

export const LABORATORY_IDS = [
  'lab-b-informatika',
  'lab-c-informatika',
  'lab-d-informatika',
  'lab-gedung-ap',
] as const;

export type LaboratoryId = (typeof LABORATORY_IDS)[number];

export interface LaboratoryPreset {
  id: LaboratoryId;
  name: string;
  latitude: number;
  longitude: number;
  radius: number;
}

/**
 * 4 titik lokasi praktikum tetap beserta koordinat awal area kampus FSM UNDIP
 * dan radius default 50 meter. Koordinat Lab B/C/D diambil dari
 * `koordinat_fsm_undip.json` (titik referensi Gedung E FSM, lantai 2; ketiga lab
 * berbagi titik yang sama). Asisten dapat memperbarui koordinat dan radius
 * masing-masing lokasi kapan saja tanpa tertimpa proses seeding.
 */
export const DEFAULT_LABORATORIES: readonly LaboratoryPreset[] = [
  {
    id: 'lab-b-informatika',
    name: 'Lab B Informatika',
    latitude: -7.0482375,
    longitude: 110.440765625,
    radius: DEFAULT_LABORATORY_RADIUS_METERS,
  },
  {
    id: 'lab-c-informatika',
    name: 'Lab C Informatika',
    latitude: -7.0482375,
    longitude: 110.440765625,
    radius: DEFAULT_LABORATORY_RADIUS_METERS,
  },
  {
    id: 'lab-d-informatika',
    name: 'Lab D Informatika',
    latitude: -7.0482375,
    longitude: 110.440765625,
    radius: DEFAULT_LABORATORY_RADIUS_METERS,
  },
  {
    id: 'lab-gedung-ap',
    name: 'Lab Gedung AP',
    // Dekanat FSM UNDIP (Plus Code 6P4GXC2R+9HQ), dari pembaruan koordinat P2.
    latitude: -7.0490375,
    longitude: 110.441484375,
    radius: DEFAULT_LABORATORY_RADIUS_METERS,
  },
] as const;

const LABORATORY_PRESET_BY_ID = new Map<LaboratoryId, LaboratoryPreset>(
  DEFAULT_LABORATORIES.map((lab) => [lab.id, lab]),
);

const LABORATORY_ORDER = new Map<LaboratoryId, number>(
  LABORATORY_IDS.map((id, index) => [id, index]),
);

// ==========================================
// TIPE DATA LABORATORIUM
// ==========================================

export interface LaboratoryLocation {
  id: string;
  nama: string;
  mataKuliahId: string;
  lokasi: string;
  lat: number;
  lng: number;
  radius: number;
  gracePeriodMenit: number;
  nominalDenda: number;
  updatedAt: Date | null;
  // Alias kompatibilitas Sprint 3
  name: string;
  latitude: number;
  longitude: number;
}

export interface UpdateLaboratoryInput {
  latitude: number;
  longitude: number;
  radius: number;
}

let inFlightSeedPromise: Promise<LaboratoryId[]> | null = null;

// ==========================================
// HELPER VALIDASI & MAPPING
// ==========================================

export function isLaboratoryId(value: unknown): value is LaboratoryId {
  return (
    typeof value === 'string' &&
    LABORATORY_PRESET_BY_ID.has(value as LaboratoryId)
  );
}

export function getLaboratoryPreset(labId: LaboratoryId): LaboratoryPreset {
  const preset = LABORATORY_PRESET_BY_ID.get(labId);
  if (!preset) {
    throw new Error(`Preset laboratorium "${String(labId)}" tidak ditemukan.`);
  }
  return preset;
}

function assertNonEmptyLabId(labId: unknown): string {
  if (typeof labId !== 'string' || labId.trim().length === 0) {
    throw new Error(
      `ID laboratorium tidak valid: "${String(labId ?? '')}".`,
    );
  }
  return labId.trim();
}

function assertValidLaboratoryId(labId: unknown): LaboratoryId {
  if (!isLaboratoryId(labId)) {
    throw new Error(
      `ID laboratorium tidak valid: "${String(labId ?? '')}".`,
    );
  }
  return labId;
}

function normalizeNumber(value: number): number {
  return value === 0 ? 0 : value;
}

export function validateLaboratoryInput(
  input: UpdateLaboratoryInput,
): UpdateLaboratoryInput {
  if (typeof input !== 'object' || input === null) {
    throw new Error('Data koordinat dan radius laboratorium wajib diisi.');
  }

  const { latitude, longitude, radius } = input;

  if (
    typeof latitude !== 'number' ||
    !Number.isFinite(latitude) ||
    latitude < -90 ||
    latitude > 90
  ) {
    throw new Error('Latitude harus berupa angka antara -90 sampai 90.');
  }

  if (
    typeof longitude !== 'number' ||
    !Number.isFinite(longitude) ||
    longitude < -180 ||
    longitude > 180
  ) {
    throw new Error('Longitude harus berupa angka antara -180 sampai 180.');
  }

  if (
    typeof radius !== 'number' ||
    !Number.isFinite(radius) ||
    radius <= 0
  ) {
    throw new Error('Radius harus berupa angka lebih dari 0 meter.');
  }

  return {
    latitude: normalizeNumber(latitude),
    longitude: normalizeNumber(longitude),
    radius,
  };
}

function toDateOrNull(value: unknown): Date | null {
  if (value == null) return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (
    typeof value === 'object' &&
    'toDate' in value &&
    typeof (value as { toDate?: unknown }).toDate === 'function'
  ) {
    const parsed = (value as { toDate: () => Date }).toDate();
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  return null;
}

function readOptionalNonNegativeNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? value === 0
      ? 0
      : value
    : 0;
}

function mapLaboratoryDoc(
  docId: string,
  data: DocumentData,
): LaboratoryLocation {
  const labId = assertNonEmptyLabId(docId);

  if (data.id !== undefined && data.id !== labId) {
    throw new Error(
      `Field "id" pada dokumen laboratorium "${labId}" tidak konsisten.`,
    );
  }

  const resolvedName =
    typeof data.nama === 'string' && data.nama.trim().length > 0
      ? data.nama.trim()
      : typeof data.name === 'string' && data.name.trim().length > 0
        ? data.name.trim()
        : '';

  if (!resolvedName) {
    throw new Error(
      `Dokumen laboratorium "${labId}" tidak memiliki field "nama"/"name" yang valid.`,
    );
  }

  let validatedCoords: UpdateLaboratoryInput;
  try {
    validatedCoords = validateLaboratoryInput({
      latitude: (data.lat ?? data.latitude) as number,
      longitude: (data.lng ?? data.longitude) as number,
      radius: data.radius as number,
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : 'Data numerik tidak valid.';
    throw new Error(`Data lokasi laboratorium "${labId}" tidak valid: ${detail}`);
  }

  return {
    id: labId,
    nama: resolvedName,
    mataKuliahId: typeof data.mataKuliahId === 'string' ? data.mataKuliahId.trim() : '',
    lokasi: typeof data.lokasi === 'string' ? data.lokasi.trim() : '',
    lat: validatedCoords.latitude,
    lng: validatedCoords.longitude,
    radius: validatedCoords.radius,
    gracePeriodMenit: readOptionalNonNegativeNumber(data.gracePeriodMenit),
    nominalDenda: readOptionalNonNegativeNumber(data.nominalDenda),
    updatedAt: toDateOrNull(data.updatedAt),
    name: resolvedName,
    latitude: validatedCoords.latitude,
    longitude: validatedCoords.longitude,
  };
}

function sortLaboratories(
  laboratories: LaboratoryLocation[],
): LaboratoryLocation[] {
  return [...laboratories].sort((a, b) => {
    const orderA = LABORATORY_ORDER.get(a.id as LaboratoryId);
    const orderB = LABORATORY_ORDER.get(b.id as LaboratoryId);
    if (orderA !== undefined && orderB !== undefined) {
      return orderA - orderB;
    }
    if (orderA !== undefined) return -1;
    if (orderB !== undefined) return 1;
    return a.nama.localeCompare(b.nama, 'id');
  });
}

function mapLaboratoriesSnapshot(
  snapshot: QuerySnapshot<DocumentData>,
): LaboratoryLocation[] {
  const laboratories: LaboratoryLocation[] = [];

  for (const docSnap of snapshot.docs) {
    laboratories.push(mapLaboratoryDoc(docSnap.id, docSnap.data()));
  }

  return sortLaboratories(laboratories);
}

function mapLaboratoryError(error: unknown): Error {
  const code = (error as { code?: string })?.code;

  switch (code) {
    case 'not-found':
    case 'firestore/not-found':
      return new Error('Dokumen laboratorium tidak ditemukan.');
    case 'unauthenticated':
    case 'firestore/unauthenticated':
      return new Error('Sesi login berakhir. Silakan masuk kembali.');
    case 'deadline-exceeded':
    case 'firestore/deadline-exceeded':
      return new Error('Koneksi ke server melebihi batas waktu.');
    case 'invalid-argument':
    case 'firestore/invalid-argument':
      return new Error('Format data laboratorium tidak sesuai.');
  }

  if (code) {
    return new Error(authErrorMessage(error));
  }

  if (error instanceof Error && error.message.trim().length > 0) {
    return error;
  }

  return new Error('Terjadi kesalahan saat memproses data laboratorium.');
}

// ==========================================
// SEEDING OTOMATIS & IDEMPOTEN
// ==========================================

/**
 * Menginisialisasi tepat 4 dokumen laboratorium di Firestore jika belum ada.
 * Menggunakan transaksi agar aman terhadap pemanggilan bersamaan dan tidak pernah
 * menimpa dokumen yang sudah dibuat atau diubah oleh Asisten.
 *
 * @returns Daftar `LaboratoryId` yang baru dibuat pada pemanggilan ini.
 */
export async function ensureDefaultLaboratories(): Promise<LaboratoryId[]> {
  if (inFlightSeedPromise) {
    return inFlightSeedPromise;
  }

  inFlightSeedPromise = (async () => {
    try {
      return await runTransaction(db, async (transaction) => {
        const labEntries = DEFAULT_LABORATORIES.map((preset) => ({
          preset,
          ref: doc(db, LABORATORIES_COLLECTION, preset.id),
        }));

        const snapshots = await Promise.all(
          labEntries.map((entry) => transaction.get(entry.ref)),
        );

        const createdIds: LaboratoryId[] = [];

        labEntries.forEach((entry, index) => {
          if (snapshots[index].exists()) {
            return;
          }

          transaction.set(entry.ref, {
            id: entry.preset.id,
            name: entry.preset.name,
            latitude: entry.preset.latitude,
            longitude: entry.preset.longitude,
            radius: entry.preset.radius,
            updatedAt: serverTimestamp(),
          });

          createdIds.push(entry.preset.id);
        });

        return createdIds;
      });
    } catch (error) {
      throw mapLaboratoryError(error);
    } finally {
      inFlightSeedPromise = null;
    }
  })();

  return inFlightSeedPromise;
}

// ==========================================
// READ & REAL-TIME LISTENERS (onSnapshot)
// ==========================================

/**
 * Mendengarkan daftar ke-4 laboratorium secara real-time.
 */
export function subscribeLaboratories(
  onData: (laboratories: LaboratoryLocation[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  let active = true;

  const unsubscribe = onSnapshot(
    collection(db, LABORATORIES_COLLECTION),
    (snapshot) => {
      if (!active) return;

      try {
        onData(mapLaboratoriesSnapshot(snapshot));
      } catch (error) {
        onError(mapLaboratoryError(error));
      }
    },
    (error) => {
      if (!active) return;
      onError(mapLaboratoryError(error));
    },
  );

  return () => {
    active = false;
    unsubscribe();
  };
}

/**
 * Mendengarkan perubahan 1 dokumen laboratorium berdasarkan `labId` secara real-time.
 * Mengirim `null` jika dokumen belum ada di Firestore.
 */
export function subscribeLaboratoryById(
  labId: string,
  onData: (laboratory: LaboratoryLocation | null) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  const validLabId = assertNonEmptyLabId(labId);
  let active = true;

  const unsubscribe = onSnapshot(
    doc(db, LABORATORIES_COLLECTION, validLabId),
    (snapshot) => {
      if (!active) return;

      if (!snapshot.exists()) {
        onData(null);
        return;
      }

      try {
        onData(mapLaboratoryDoc(snapshot.id, snapshot.data()));
      } catch (error) {
        onError(mapLaboratoryError(error));
      }
    },
    (error) => {
      if (!active) return;
      onError(mapLaboratoryError(error));
    },
  );

  return () => {
    active = false;
    unsubscribe();
  };
}

/**
 * Membaca seluruh dokumen laboratorium satu kali (berguna untuk pemeriksaan non-listener).
 */
export async function getLaboratories(): Promise<LaboratoryLocation[]> {
  try {
    const snapshot = await getDocs(collection(db, LABORATORIES_COLLECTION));
    return mapLaboratoriesSnapshot(snapshot);
  } catch (error) {
    throw mapLaboratoryError(error);
  }
}

/**
 * Membaca 1 dokumen laboratorium satu kali berdasarkan `labId`.
 */
export async function getLaboratoryById(
  labId: string,
): Promise<LaboratoryLocation | null> {
  const validLabId = assertNonEmptyLabId(labId);

  try {
    const snapshot = await getDoc(doc(db, LABORATORIES_COLLECTION, validLabId));
    if (!snapshot.exists()) {
      return null;
    }
    return mapLaboratoryDoc(snapshot.id, snapshot.data());
  } catch (error) {
    throw mapLaboratoryError(error);
  }
}

// ==========================================
// UPDATE KOORDINAT & RADIUS LABORATORIUM
// ==========================================

/**
 * Memperbarui koordinat (`latitude`, `longitude`) dan `radius` (meter)
 * untuk salah satu dari 4 laboratorium tetap.
 */
export async function updateLaboratory(
  labId: LaboratoryId | string,
  input: UpdateLaboratoryInput,
): Promise<void> {
  const validLabId = assertValidLaboratoryId(labId);
  const validInput = validateLaboratoryInput(input);
  const preset = getLaboratoryPreset(validLabId);
  const labRef = doc(db, LABORATORIES_COLLECTION, validLabId);

  try {
    await runTransaction(db, async (transaction) => {
      const snapshot = await transaction.get(labRef);

      if (!snapshot.exists()) {
        transaction.set(labRef, {
          id: preset.id,
          name: preset.name,
          latitude: validInput.latitude,
          longitude: validInput.longitude,
          radius: validInput.radius,
          updatedAt: serverTimestamp(),
        });
        return;
      }

      transaction.update(labRef, {
        latitude: validInput.latitude,
        longitude: validInput.longitude,
        radius: validInput.radius,
        updatedAt: serverTimestamp(),
      });
    });
  } catch (error) {
    throw mapLaboratoryError(error);
  }
}

// ==========================================
// BULK INSERT LABORATORIUM (FR-03, NFR-02)
// ==========================================

export type BulkCreateLaboratoryItemStatus = 'saved' | 'skipped' | 'failed';

export interface BulkCreateLaboratoryItemResult {
  rowIndex: number;
  nama: string;
  labId: string | null;
  status: BulkCreateLaboratoryItemStatus;
  reason: string;
}

export interface BulkCreateLaboratoriesResult {
  mataKuliahId: string;
  totalProcessed: number;
  savedCount: number;
  skippedCount: number;
  failedCount: number;
  createdLabIds: string[];
  batchError: string | null;
  items: BulkCreateLaboratoryItemResult[];
}

export interface CourseOptionItem {
  value: string;
  label: string;
  detail?: string;
}

function readOptionalString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Mengambil kunci normalisasi (mataKuliahId::nama) laboratorium yang sudah terdaftar
 * di Firestore untuk kebutuhan pengecekan duplikat sebelum bulk insert.
 */
export async function getExistingLaboratoryKeysByCourse(
  mataKuliahId: string,
): Promise<Set<string>> {
  const courseId = mataKuliahId.trim();
  if (!courseId) {
    throw new Error('Kode mata kuliah wajib diisi untuk mengecek duplikat.');
  }

  try {
    const snapshot = await getDocs(collection(db, LABORATORIES_COLLECTION));
    const keys = new Set<string>();

    for (const docSnap of snapshot.docs) {
      const data = docSnap.data();
      const rawName = readOptionalString(data.nama ?? data.name);
      const docCourseId = readOptionalString(data.mataKuliahId);

      // Cek laboratorium pada mata kuliah yang sama; untuk data legacy tanpa mataKuliahId,
      // tidak menabrak mata kuliah baru kecuali nama + course memang cocok.
      if (!rawName || !docCourseId) continue;

      const key = normalizeLabDuplicateKey(rawName, docCourseId);
      if (key && docCourseId.toLowerCase() === courseId.toLowerCase()) {
        keys.add(key);
      }
    }

    return keys;
  } catch (error) {
    throw mapLaboratoryError(error);
  }
}

/**
 * Mengambil daftar pilihan mata kuliah (`mataKuliahId`) yang tersedia dari koleksi
 * `laboratories` dan `classes` di Firestore.
 */
export async function getAvailableCourseOptions(): Promise<CourseOptionItem[]> {
  try {
    const [labsSnap, classesSnap] = await Promise.all([
      getDocs(collection(db, LABORATORIES_COLLECTION)),
      getDocs(collection(db, 'classes')),
    ]);

    const optionByValue = new Map<string, CourseOptionItem>();

    for (const docSnap of classesSnap.docs) {
      const data = docSnap.data();
      const value = readOptionalString(data.kode ?? docSnap.id);
      if (!value) continue;
      const title = readOptionalString(
        data.nama ?? data.practicumName ?? data.className,
      );
      optionByValue.set(value.toLowerCase(), {
        value,
        label: title ? `${value} — ${title}` : value,
        detail: 'Dari daftar kelas praktikum',
      });
    }

    for (const docSnap of labsSnap.docs) {
      const data = docSnap.data();
      const value = readOptionalString(data.mataKuliahId);
      if (!value) continue;
      const key = value.toLowerCase();
      if (!optionByValue.has(key)) {
        optionByValue.set(key, {
          value,
          label: value,
          detail: 'Sudah digunakan pada laboratorium',
        });
      }
    }

    return Array.from(optionByValue.values()).sort((a, b) =>
      a.value.localeCompare(b.value),
    );
  } catch (error) {
    throw mapLaboratoryError(error);
  }
}

export interface CreateSingleLaboratoryInput {
  nama: string;
  mataKuliahId: string;
  lokasi?: string;
  lat: number;
  lng: number;
  radius: number;
  gracePeriodMenit: number;
  nominalDenda: number;
}

/**
 * Membuat 1 dokumen laboratorium baru dengan skema Sprint 4 + alias Sprint 3.
 */
export async function createLaboratory(
  input: CreateSingleLaboratoryInput,
): Promise<string> {
  const cleanName = input.nama.trim();
  const cleanCourseId = input.mataKuliahId.trim();
  const cleanLocation = (input.lokasi ?? '').trim();

  if (cleanName.length < 2) {
    throw new Error('Nama laboratorium minimal 2 karakter.');
  }
  if (!cleanCourseId) {
    throw new Error('Kode mata kuliah (mataKuliahId) wajib diisi.');
  }

  const coords = validateLaboratoryInput({
    latitude: input.lat,
    longitude: input.lng,
    radius: input.radius,
  });

  if (!Number.isFinite(input.gracePeriodMenit) || input.gracePeriodMenit < 0) {
    throw new Error('Grace period harus berupa angka minimal 0 menit.');
  }
  if (!Number.isFinite(input.nominalDenda) || input.nominalDenda < 0) {
    throw new Error('Nominal denda harus berupa angka minimal 0.');
  }

  const labRef = doc(collection(db, LABORATORIES_COLLECTION));

  try {
    await runTransaction(db, async (transaction) => {
      transaction.set(labRef, {
        id: labRef.id,
        nama: cleanName,
        mataKuliahId: cleanCourseId,
        lokasi: cleanLocation,
        lat: coords.latitude,
        lng: coords.longitude,
        radius: Math.round(coords.radius),
        gracePeriodMenit: Math.round(input.gracePeriodMenit),
        nominalDenda: Math.round(input.nominalDenda),
        updatedAt: serverTimestamp(),
        name: cleanName,
        latitude: coords.latitude,
        longitude: coords.longitude,
      });
    });

    return labRef.id;
  } catch (error) {
    throw mapLaboratoryError(error);
  }
}

/**
 * Menyimpan batch laboratorium tervalidasi untuk satu `mataKuliahId` secara atomik
 * menggunakan Firestore `writeBatch` (maksimal 500 operasi batch per NFR-02).
 */
export async function bulkCreateLaboratories(
  mataKuliahId: string,
  rows: readonly BulkReviewRow<BulkLaboratoryItem>[],
): Promise<BulkCreateLaboratoriesResult> {
  const courseId = mataKuliahId.trim();
  if (!courseId) {
    throw new Error('Mata kuliah tujuan wajib dipilih sebelum menyimpan.');
  }

  const acceptedRows: {
    row: BulkReviewRow<BulkLaboratoryItem>;
    item: BulkLaboratoryItem;
  }[] = [];
  const skippedItems: BulkCreateLaboratoryItemResult[] = [];

  for (const row of rows) {
    const displayName = (row.raw.nama ?? row.data?.nama ?? '').trim() || `Baris #${row.rowIndex}`;

    if (row.status !== 'accepted' || row.errors.length > 0 || !row.data) {
      const reason =
        row.errors.length > 0
          ? row.errors.join('; ')
          : 'Baris ditolak oleh pengguna (Denied).';
      skippedItems.push({
        rowIndex: row.rowIndex,
        nama: displayName,
        labId: null,
        status: 'skipped',
        reason,
      });
      continue;
    }

    acceptedRows.push({
      row,
      item: {
        ...row.data,
        mataKuliahId: courseId,
      },
    });
  }

  if (acceptedRows.length === 0) {
    throw new Error('Tidak ada baris valid berstatus Accepted untuk disimpan.');
  }

  if (acceptedRows.length > BULK_MAX_ROWS) {
    throw new Error(
      `Jumlah baris terpilih (${acceptedRows.length}) melebihi batas atomik Firestore (${BULK_MAX_ROWS} operasi).`,
    );
  }

  // Re-validasi akhir sebelum menulis ke batch atomik agar tidak ada data rusak lolos.
  for (const { row, item } of acceptedRows) {
    validateLaboratoryInput({
      latitude: item.lat,
      longitude: item.lng,
      radius: item.radius,
    });
    if (!item.nama.trim()) {
      throw new Error(`Baris #${row.rowIndex}: nama laboratorium wajib diisi.`);
    }
    if (!Number.isFinite(item.gracePeriodMenit) || item.gracePeriodMenit < 0) {
      throw new Error(`Baris #${row.rowIndex}: gracePeriodMenit tidak valid.`);
    }
    if (!Number.isFinite(item.nominalDenda) || item.nominalDenda < 0) {
      throw new Error(`Baris #${row.rowIndex}: nominalDenda tidak valid.`);
    }
  }

  const batch = writeBatch(db);
  const pendingWrites: {
    rowIndex: number;
    nama: string;
    labId: string;
  }[] = [];

  for (const { row, item } of acceptedRows) {
    const labRef = doc(collection(db, LABORATORIES_COLLECTION));
    const cleanName = item.nama.trim();
    const cleanLocation = item.lokasi.trim();

    batch.set(labRef, {
      id: labRef.id,
      // Field kanonik Sprint 4
      nama: cleanName,
      mataKuliahId: courseId,
      lokasi: cleanLocation,
      lat: item.lat,
      lng: item.lng,
      radius: item.radius,
      gracePeriodMenit: item.gracePeriodMenit,
      nominalDenda: item.nominalDenda,
      updatedAt: serverTimestamp(),
      // Alias kompatibilitas Sprint 3
      name: cleanName,
      latitude: item.lat,
      longitude: item.lng,
    });

    pendingWrites.push({
      rowIndex: row.rowIndex,
      nama: cleanName,
      labId: labRef.id,
    });
  }

  try {
    await batch.commit();

    const savedItems: BulkCreateLaboratoryItemResult[] = pendingWrites.map(
      (entry) => ({
        rowIndex: entry.rowIndex,
        nama: entry.nama,
        labId: entry.labId,
        status: 'saved',
        reason: 'Berhasil disimpan ke Firestore.',
      }),
    );

    const items = [...savedItems, ...skippedItems].sort(
      (a, b) => a.rowIndex - b.rowIndex,
    );

    return {
      mataKuliahId: courseId,
      totalProcessed: rows.length,
      savedCount: savedItems.length,
      skippedCount: skippedItems.length,
      failedCount: 0,
      createdLabIds: pendingWrites.map((entry) => entry.labId),
      batchError: null,
      items,
    };
  } catch (error) {
    const mapped = mapLaboratoryError(error);
    const failedItems: BulkCreateLaboratoryItemResult[] = pendingWrites.map(
      (entry) => ({
        rowIndex: entry.rowIndex,
        nama: entry.nama,
        labId: null,
        status: 'failed',
        reason: `Transaksi batch gagal (dibatalkan atomik): ${mapped.message}`,
      }),
    );

    const items = [...failedItems, ...skippedItems].sort(
      (a, b) => a.rowIndex - b.rowIndex,
    );

    return {
      mataKuliahId: courseId,
      totalProcessed: rows.length,
      savedCount: 0,
      skippedCount: skippedItems.length,
      failedCount: failedItems.length,
      createdLabIds: [],
      batchError: mapped.message,
      items,
    };
  }
}
