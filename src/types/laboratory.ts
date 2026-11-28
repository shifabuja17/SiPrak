export const LABORATORIES_COLLECTION = 'laboratories';
export const LAB_MEMBERS_COLLECTION = 'labMembers';

export const DEFAULT_LABORATORY_RADIUS_METERS = 50;
export const DEFAULT_GRACE_PERIOD_MINUTES = 0;
export const DEFAULT_FINE_NOMINAL = 0;

export const LAB_MEMBER_ROLES = {
  PRAKTIKAN: 'praktikan',
  ASPRAK: 'asprak',
} as const;

export type LabMemberRole = (typeof LAB_MEMBER_ROLES)[keyof typeof LAB_MEMBER_ROLES];

/**
 * Model terpadu dokumen `laboratories/{labId}`:
 * - Field kanonik Sprint 4: `nama`, `mataKuliahId`, `lokasi`, `lat`, `lng`, `radius`,
 *   `gracePeriodMenit`, `nominalDenda`, `updatedAt`.
 * - Alias kompatibilitas Sprint 3: `name`, `latitude`, `longitude` (selalu selaras
 *   dengan `nama`, `lat`, `lng` agar modul presensi & Maps Sprint 3 tetap berjalan).
 */
export interface Laboratory {
  id: string;
  nama: string;
  mataKuliahId: string | null;
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

export interface LaboratoryWriteInput {
  nama: string;
  mataKuliahId?: string | null;
  lokasi?: string;
  lat: number;
  lng: number;
  radius: number;
  gracePeriodMenit?: number;
  nominalDenda?: number;
}

export interface LaboratoryFirestorePayload {
  nama: string;
  name: string;
  mataKuliahId: string | null;
  lokasi: string;
  lat: number;
  lng: number;
  latitude: number;
  longitude: number;
  radius: number;
  gracePeriodMenit: number;
  nominalDenda: number;
}

/**
 * Model dokumen `labMembers/{labId}_{userId}` untuk keanggotaan per laboratorium.
 */
export interface LabMember {
  id: string;
  labId: string;
  userId: string;
  peran: LabMemberRole;
  aktif: boolean;
  createdAt: Date | null;
  updatedAt: Date | null;
}

function normalizeSignedZero(value: number): number {
  return value === 0 ? 0 : value;
}

function assertValidSegment(value: unknown, label: string): string {
  if (typeof value !== 'string') {
    throw new Error(`${label} wajib berupa teks.`);
  }
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`${label} wajib diisi.`);
  }
  if (trimmed.includes('/')) {
    throw new Error(`${label} tidak boleh mengandung karakter '/'.`);
  }
  return trimmed;
}

/**
 * Menghasilkan ID dokumen deterministik `{labId}_{userId}` untuk `labMembers`
 * guna mencegah duplikasi keanggotaan dan memudahkan verifikasi Security Rules.
 */
export function buildLabMemberId(labId: string, userId: string): string {
  const validLabId = assertValidSegment(labId, 'ID laboratorium');
  const validUserId = assertValidSegment(userId, 'ID pengguna');
  return `${validLabId}_${validUserId}`;
}

/**
 * Menormalkan peran anggota lab (`praktikan` | `asprak`), termasuk alias legacy `asisten`.
 * Mengembalikan `null` bila nilai tidak valid (fail-fast).
 */
export function normalizeLabMemberRole(value: unknown): LabMemberRole | null {
  if (typeof value !== 'string') {
    return null;
  }

  switch (value.trim().toLowerCase()) {
    case 'praktikan':
      return LAB_MEMBER_ROLES.PRAKTIKAN;
    case 'asprak':
    case 'asisten':
      return LAB_MEMBER_ROLES.ASPRAK;
    default:
      return null;
  }
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

/**
 * Menyusun payload dual-write untuk `laboratories/{labId}` (field Sprint 4 + alias Sprint 3).
 */
export function buildLaboratoryDualWritePayload(
  input: LaboratoryWriteInput,
): LaboratoryFirestorePayload {
  if (typeof input !== 'object' || input === null) {
    throw new Error('Data laboratorium wajib diisi.');
  }

  if (typeof input.nama !== 'string' || input.nama.trim().length === 0) {
    throw new Error('Nama laboratorium wajib diisi.');
  }
  const nama = input.nama.trim();

  const coords = validateLaboratoryCoordinates(input.lat, input.lng, input.radius);

  const mataKuliahId =
    input.mataKuliahId === undefined || input.mataKuliahId === null
      ? null
      : typeof input.mataKuliahId === 'string'
        ? input.mataKuliahId.trim() || null
        : (() => {
            throw new Error('mataKuliahId harus berupa string atau null.');
          })();

  const lokasi =
    input.lokasi === undefined
      ? ''
      : typeof input.lokasi === 'string'
        ? input.lokasi.trim()
        : (() => {
            throw new Error('Lokasi laboratorium harus berupa teks.');
          })();

  const gracePeriodMenit = input.gracePeriodMenit ?? DEFAULT_GRACE_PERIOD_MINUTES;
  if (
    typeof gracePeriodMenit !== 'number' ||
    !Number.isFinite(gracePeriodMenit) ||
    gracePeriodMenit < 0
  ) {
    throw new Error('Grace period harus berupa angka minimal 0 menit.');
  }

  const nominalDenda = input.nominalDenda ?? DEFAULT_FINE_NOMINAL;
  if (
    typeof nominalDenda !== 'number' ||
    !Number.isFinite(nominalDenda) ||
    nominalDenda < 0
  ) {
    throw new Error('Nominal denda harus berupa angka minimal 0.');
  }

  return {
    nama,
    name: nama,
    mataKuliahId,
    lokasi,
    lat: coords.lat,
    lng: coords.lng,
    latitude: coords.lat,
    longitude: coords.lng,
    radius: coords.radius,
    gracePeriodMenit: normalizeSignedZero(gracePeriodMenit),
    nominalDenda: normalizeSignedZero(nominalDenda),
  };
}
