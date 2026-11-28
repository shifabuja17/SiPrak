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

/**
 * Model dokumen `labMembers/{labId}_{userId}` untuk keanggotaan per laboratorium.
 */
export interface LabMember {
  id: string;
  labId: string;
  userId: string;
  peran: LabMemberRole;
  aktif: boolean;
  transferredTo?: string | null;
  transferredFrom?: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
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
