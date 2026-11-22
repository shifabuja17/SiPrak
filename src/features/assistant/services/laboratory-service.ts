import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  type DocumentData,
  type QuerySnapshot,
  type Unsubscribe,
} from 'firebase/firestore';

import { authErrorMessage } from '@/context/AuthContext';
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
  id: LaboratoryId;
  name: string;
  latitude: number;
  longitude: number;
  radius: number;
  updatedAt: Date | null;
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

function mapLaboratoryDoc(
  docId: string,
  data: DocumentData,
): LaboratoryLocation {
  const labId = assertValidLaboratoryId(docId);

  if (data.id !== undefined && data.id !== labId) {
    throw new Error(
      `Field "id" pada dokumen laboratorium "${labId}" tidak konsisten.`,
    );
  }

  if (typeof data.name !== 'string' || data.name.trim().length === 0) {
    throw new Error(
      `Dokumen laboratorium "${labId}" tidak memiliki field "name" yang valid.`,
    );
  }

  let validatedCoords: UpdateLaboratoryInput;
  try {
    validatedCoords = validateLaboratoryInput({
      latitude: data.latitude as number,
      longitude: data.longitude as number,
      radius: data.radius as number,
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : 'Data numerik tidak valid.';
    throw new Error(`Data lokasi laboratorium "${labId}" tidak valid: ${detail}`);
  }

  return {
    id: labId,
    name: data.name.trim(),
    latitude: validatedCoords.latitude,
    longitude: validatedCoords.longitude,
    radius: validatedCoords.radius,
    updatedAt: toDateOrNull(data.updatedAt),
  };
}

function sortLaboratories(
  laboratories: LaboratoryLocation[],
): LaboratoryLocation[] {
  return [...laboratories].sort(
    (a, b) =>
      (LABORATORY_ORDER.get(a.id) ?? Number.MAX_SAFE_INTEGER) -
      (LABORATORY_ORDER.get(b.id) ?? Number.MAX_SAFE_INTEGER),
  );
}

function mapLaboratoriesSnapshot(
  snapshot: QuerySnapshot<DocumentData>,
): LaboratoryLocation[] {
  const laboratories: LaboratoryLocation[] = [];

  for (const docSnap of snapshot.docs) {
    if (!isLaboratoryId(docSnap.id)) {
      continue;
    }
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
  const validLabId = assertValidLaboratoryId(labId);
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
  const validLabId = assertValidLaboratoryId(labId);

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
