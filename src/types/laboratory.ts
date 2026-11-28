export const LABORATORIES_COLLECTION = 'laboratories';
export const LAB_MEMBERS_COLLECTION = 'labMembers';

export const DEFAULT_LABORATORY_RADIUS_METERS = 50;
export const DEFAULT_GRACE_PERIOD_MINUTES = 0;
export const DEFAULT_FINE_NOMINAL = 0;

/**
 * Model dokumen `laboratories/{labId}` terpadu:
 * - Field kanonik Sprint 4: `nama`, `mataKuliahId`, `lokasi`, `lat`, `lng`, `radius`,
 *   `gracePeriodMenit`, `nominalDenda`, `updatedAt`.
 * - Alias kompatibilitas Sprint 3: `name`, `latitude`, `longitude` (selalu disinkronkan
 *   dengan `nama`, `lat`, `lng` agar modul presensi & Maps Sprint 3 tetap berjalan).
 */
export interface Laboratory {
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

export type LaboratoryLocation = Laboratory;

export interface LaboratoryPayload {
  nama: string;
  mataKuliahId: string;
  lokasi?: string;
  lat: number;
  lng: number;
  radius: number;
  gracePeriodMenit: number;
  nominalDenda: number;
}

export interface LegacyLaboratoryUpdateInput {
  latitude: number;
  longitude: number;
  radius: number;
}

export interface LatePolicyInput {
  gracePeriodMenit: number;
  nominalDenda: number;
}

export interface UpdateLatePolicyResult {
  mataKuliahId: string;
  updatedCount: number;
  labIds: string[];
}

export interface LaboratoryFirestorePayload {
  nama: string;
  name: string;
  mataKuliahId: string;
  lokasi: string;
  lat: number;
  latitude: number;
  lng: number;
  longitude: number;
  radius: number;
  gracePeriodMenit: number;
  nominalDenda: number;
}

function normalizeSignedZero(value: number): number {
  return value === 0 ? 0 : value;
}

export function validateLaboratoryCoordinates(
  lat: number,
  lng: number,
  radius: number,
): { lat: number; lng: number; radius: number } {
  if (typeof lat !== 'number' || !Number.isFinite(lat) || lat < -90 || lat > 90) {
    throw new Error('Latitude harus berupa angka antara -90 sampai 90.');
  }

  if (typeof lng !== 'number' || !Number.isFinite(lng) || lng < -180 || lng > 180) {
    throw new Error('Longitude harus berupa angka antara -180 sampai 180.');
  }

  if (typeof radius !== 'number' || !Number.isFinite(radius) || radius <= 0) {
    throw new Error('Radius harus berupa angka lebih dari 0 meter.');
  }

  return {
    lat: normalizeSignedZero(lat),
    lng: normalizeSignedZero(lng),
    radius,
  };
}

export function validateLatePolicyInput(
  input: LatePolicyInput,
): { gracePeriodMenit: number; nominalDenda: number } {
  if (typeof input !== 'object' || input === null) {
    throw new Error('Kebijakan keterlambatan wajib diisi.');
  }

  const { gracePeriodMenit, nominalDenda } = input;

  if (
    typeof gracePeriodMenit !== 'number' ||
    !Number.isFinite(gracePeriodMenit) ||
    gracePeriodMenit < 0
  ) {
    throw new Error('Grace period harus berupa angka minimal 0 menit.');
  }

  if (
    typeof nominalDenda !== 'number' ||
    !Number.isFinite(nominalDenda) ||
    nominalDenda < 0
  ) {
    throw new Error('Nominal denda harus berupa angka minimal 0 rupiah.');
  }

  return {
    gracePeriodMenit: normalizeSignedZero(gracePeriodMenit),
    nominalDenda: normalizeSignedZero(nominalDenda),
  };
}

/**
 * Memvalidasi seluruh payload CRUD laboratorium secara ketat dan menyusun objek dual-write
 * (field kanonik Sprint 4 + alias Sprint 3).
 */
export function validateLaboratoryPayload(
  payload: LaboratoryPayload,
): LaboratoryFirestorePayload {
  if (typeof payload !== 'object' || payload === null) {
    throw new Error('Data laboratorium wajib diisi.');
  }

  if (typeof payload.nama !== 'string' || payload.nama.trim().length === 0) {
    throw new Error('Nama laboratorium wajib diisi.');
  }
  const nama = payload.nama.trim();
  if (nama.length > 100) {
    throw new Error('Nama laboratorium maksimal 100 karakter.');
  }

  if (
    typeof payload.mataKuliahId !== 'string' ||
    payload.mataKuliahId.trim().length === 0
  ) {
    throw new Error('Mata kuliah laboratorium wajib diisi.');
  }
  const mataKuliahId = payload.mataKuliahId.trim();
  if (mataKuliahId.length > 100) {
    throw new Error('ID mata kuliah maksimal 100 karakter.');
  }

  let lokasi = '';
  if (payload.lokasi !== undefined) {
    if (typeof payload.lokasi !== 'string') {
      throw new Error('Lokasi laboratorium harus berupa teks.');
    }
    lokasi = payload.lokasi.trim();
    if (lokasi.length > 200) {
      throw new Error('Lokasi laboratorium maksimal 200 karakter.');
    }
  }

  const coords = validateLaboratoryCoordinates(
    payload.lat,
    payload.lng,
    payload.radius,
  );
  const latePolicy = validateLatePolicyInput({
    gracePeriodMenit: payload.gracePeriodMenit,
    nominalDenda: payload.nominalDenda,
  });

  return {
    nama,
    name: nama,
    mataKuliahId,
    lokasi,
    lat: coords.lat,
    latitude: coords.lat,
    lng: coords.lng,
    longitude: coords.lng,
    radius: coords.radius,
    gracePeriodMenit: latePolicy.gracePeriodMenit,
    nominalDenda: latePolicy.nominalDenda,
  };
}
