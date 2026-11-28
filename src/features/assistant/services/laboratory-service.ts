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
import {
  DEFAULT_FINE_NOMINAL,
  DEFAULT_GRACE_PERIOD_MINUTES,
  DEFAULT_LABORATORY_RADIUS_METERS,
  LABORATORIES_COLLECTION,
  buildLaboratoryDualWritePayload,
  validateLaboratoryCoordinates,
  type Laboratory,
  type LaboratoryLocation,
  type LaboratoryWriteInput,
} from '@/types/laboratory';

export {
  DEFAULT_FINE_NOMINAL,
  DEFAULT_GRACE_PERIOD_MINUTES,
  DEFAULT_LABORATORY_RADIUS_METERS,
  LABORATORIES_COLLECTION,
  buildLaboratoryDualWritePayload,
  type Laboratory,
  type LaboratoryLocation,
  type LaboratoryWriteInput,
};

// ==========================================
// KONSTANTA & DEFINISI 4 LOKASI PRESET SPRINT 3
// ==========================================

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
 * 4 titik lokasi praktikum preset Sprint 3 beserta koordinat awal area kampus FSM UNDIP
 * dan radius default 50 meter.
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
    latitude: -7.0490375,
    longitude: 110.441484375,
    radius: DEFAULT_LABORATORY_RADIUS_METERS,
  },
] as const;

const LABORATORY_PRESET_BY_ID = new Map<LaboratoryId, LaboratoryPreset>(
  DEFAULT_LABORATORIES.map((lab) => [lab.id, lab]),
);

const LABORATORY_ORDER = new Map<string, number>(
  LABORATORY_IDS.map((id, index) => [id, index]),
);

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
  if (typeof labId !== 'string' || labId.trim().length === 0 || labId.includes('/')) {
    throw new Error(
      `ID laboratorium tidak valid: "${String(labId ?? '')}".`,
    );
  }
  return labId.trim();
}

export function validateLaboratoryInput(
  input: UpdateLaboratoryInput,
): UpdateLaboratoryInput {
  if (typeof input !== 'object' || input === null) {
    throw new Error('Data koordinat dan radius laboratorium wajib diisi.');
  }

  const coords = validateLaboratoryCoordinates(
    input.latitude,
    input.longitude,
    input.radius,
  );

  return {
    latitude: coords.lat,
    longitude: coords.lng,
    radius: coords.radius,
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

function readOptionalNonNegativeNumber(
  value: unknown,
  defaultValue: number,
  fieldLabel: string,
  labId: string,
): number {
  if (value === undefined || value === null) {
    return defaultValue;
  }
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new Error(`Field "${fieldLabel}" pada laboratorium "${labId}" tidak valid.`);
  }
  return value === 0 ? 0 : value;
}

function mapLaboratoryDoc(
  docId: string,
  data: DocumentData,
): Laboratory {
  const labId = assertNonEmptyLabId(docId);

  if (data.id !== undefined && data.id !== labId) {
    throw new Error(
      `Field "id" pada dokumen laboratorium "${labId}" tidak konsisten.`,
    );
  }

  const rawName =
    typeof data.nama === 'string' && data.nama.trim().length > 0
      ? data.nama
      : typeof data.name === 'string' && data.name.trim().length > 0
        ? data.name
        : null;

  if (!rawName) {
    throw new Error(
      `Dokumen laboratorium "${labId}" tidak memiliki field "nama" / "name" yang valid.`,
    );
  }
  const nama = rawName.trim();

  const rawLat = data.lat !== undefined ? data.lat : data.latitude;
  const rawLng = data.lng !== undefined ? data.lng : data.longitude;

  let validatedCoords: UpdateLaboratoryInput;
  try {
    validatedCoords = validateLaboratoryInput({
      latitude: rawLat as number,
      longitude: rawLng as number,
      radius: data.radius as number,
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : 'Data numerik tidak valid.';
    throw new Error(`Data lokasi laboratorium "${labId}" tidak valid: ${detail}`);
  }

  let mataKuliahId: string | null = null;
  if (data.mataKuliahId !== undefined && data.mataKuliahId !== null) {
    if (typeof data.mataKuliahId !== 'string') {
      throw new Error(`Field "mataKuliahId" pada laboratorium "${labId}" tidak valid.`);
    }
    mataKuliahId = data.mataKuliahId.trim() || null;
  }

  let lokasi = '';
  if (data.lokasi !== undefined && data.lokasi !== null) {
    if (typeof data.lokasi !== 'string') {
      throw new Error(`Field "lokasi" pada laboratorium "${labId}" tidak valid.`);
    }
    lokasi = data.lokasi.trim();
  }

  const gracePeriodMenit = readOptionalNonNegativeNumber(
    data.gracePeriodMenit,
    DEFAULT_GRACE_PERIOD_MINUTES,
    'gracePeriodMenit',
    labId,
  );

  const nominalDenda = readOptionalNonNegativeNumber(
    data.nominalDenda,
    DEFAULT_FINE_NOMINAL,
    'nominalDenda',
    labId,
  );

  return {
    id: labId,
    nama,
    mataKuliahId,
    lokasi,
    lat: validatedCoords.latitude,
    lng: validatedCoords.longitude,
    radius: validatedCoords.radius,
    gracePeriodMenit,
    nominalDenda,
    updatedAt: toDateOrNull(data.updatedAt),
    // Alias kompatibilitas Sprint 3
    name: nama,
    latitude: validatedCoords.latitude,
    longitude: validatedCoords.longitude,
  };
}

function sortLaboratories(
  laboratories: Laboratory[],
): Laboratory[] {
  return [...laboratories].sort((a, b) => {
    const orderA = LABORATORY_ORDER.get(a.id);
    const orderB = LABORATORY_ORDER.get(b.id);
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
): Laboratory[] {
  const laboratories = snapshot.docs.map((docSnap) =>
    mapLaboratoryDoc(docSnap.id, docSnap.data()),
  );

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
 * Menginisialisasi tepat 4 dokumen laboratorium preset di Firestore jika belum ada.
 * Menggunakan dual-write Sprint 4 + Sprint 3 dan tidak pernah menimpa dokumen yang sudah ada.
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

          const payload = buildLaboratoryDualWritePayload({
            nama: entry.preset.name,
            mataKuliahId: null,
            lokasi: '',
            lat: entry.preset.latitude,
            lng: entry.preset.longitude,
            radius: entry.preset.radius,
            gracePeriodMenit: DEFAULT_GRACE_PERIOD_MINUTES,
            nominalDenda: DEFAULT_FINE_NOMINAL,
          });

          transaction.set(entry.ref, {
            id: entry.preset.id,
            ...payload,
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
 * Mendengarkan daftar seluruh laboratorium secara real-time.
 */
export function subscribeLaboratories(
  onData: (laboratories: Laboratory[]) => void,
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
  onData: (laboratory: Laboratory | null) => void,
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
 * Membaca seluruh dokumen laboratorium satu kali.
 */
export async function getLaboratories(): Promise<Laboratory[]> {
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
): Promise<Laboratory | null> {
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

/**
 * Membaca beberapa dokumen laboratorium sekaligus berdasarkan daftar `labIds`.
 * Dokumen yang sudah tidak ada dilewati agar daftar tetap konsisten.
 */
export async function getLaboratoriesByIds(
  labIds: string[],
): Promise<Laboratory[]> {
  const uniqueIds = Array.from(
    new Set(labIds.map((id) => assertNonEmptyLabId(id))),
  );

  if (uniqueIds.length === 0) {
    return [];
  }

  try {
    const snapshots = await Promise.all(
      uniqueIds.map((id) => getDoc(doc(db, LABORATORIES_COLLECTION, id))),
    );

    const laboratories: Laboratory[] = [];
    for (const snapshot of snapshots) {
      if (!snapshot.exists()) {
        continue;
      }
      laboratories.push(mapLaboratoryDoc(snapshot.id, snapshot.data()));
    }

    return sortLaboratories(laboratories);
  } catch (error) {
    throw mapLaboratoryError(error);
  }
}

// ==========================================
// UPDATE KOORDINAT & RADIUS LABORATORIUM
// ==========================================

/**
 * Memperbarui koordinat (`lat`/`latitude`, `lng`/`longitude`) dan `radius` (meter)
 * dengan menjaga sinkronisasi field Sprint 4 dan Sprint 3.
 */
export async function updateLaboratory(
  labId: LaboratoryId | string,
  input: UpdateLaboratoryInput,
): Promise<void> {
  const validLabId = assertNonEmptyLabId(labId);
  const validInput = validateLaboratoryInput(input);
  const labRef = doc(db, LABORATORIES_COLLECTION, validLabId);

  try {
    await runTransaction(db, async (transaction) => {
      const snapshot = await transaction.get(labRef);

      if (!snapshot.exists()) {
        if (!isLaboratoryId(validLabId)) {
          throw new Error('Dokumen laboratorium tidak ditemukan.');
        }

        const preset = getLaboratoryPreset(validLabId);
        const payload = buildLaboratoryDualWritePayload({
          nama: preset.name,
          mataKuliahId: null,
          lokasi: '',
          lat: validInput.latitude,
          lng: validInput.longitude,
          radius: validInput.radius,
          gracePeriodMenit: DEFAULT_GRACE_PERIOD_MINUTES,
          nominalDenda: DEFAULT_FINE_NOMINAL,
        });

        transaction.set(labRef, {
          id: preset.id,
          ...payload,
          updatedAt: serverTimestamp(),
        });
        return;
      }

      transaction.update(labRef, {
        lat: validInput.latitude,
        lng: validInput.longitude,
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
