export const ROLES = {
  ASLAB: 'ASLAB',
  ASPRAK: 'ASPRAK',
  PRAKTIKAN: 'PRAKTIKAN',
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

/** Role legacy dari Sprint 2–3 yang dipetakan setara ASPRAK. */
export const LEGACY_ASISTEN_ROLE = 'ASISTEN';

export interface RoleOption {
  value: Role;
  label: string;
  description: string;
}

export const ROLE_OPTIONS: readonly RoleOption[] = [
  {
    value: ROLES.PRAKTIKAN,
    label: 'Praktikan',
    description: 'Peserta praktikum yang mengikuti jadwal dan presensi.',
  },
  {
    value: ROLES.ASPRAK,
    label: 'Asprak',
    description: 'Asisten praktikum yang mendampingi kelas, sesi, dan izin.',
  },
  {
    value: ROLES.ASLAB,
    label: 'Aslab',
    description: 'Asisten laboratorium yang mengelola lab dan administrasi.',
  },
];

export interface UserProfile {
  uid: string;
  nama: string;
  email: string;
  nim: string | null;
  role: Role;
  /** Nilai role asli dari dokumen Firestore (mis. 'asisten' atau 'ASPRAK'). */
  rawRole?: string;
}

/**
 * Menormalkan string role dari Firestore/input menjadi role kanonik Sprint 4.
 * Akun legacy `asisten` / `ASISTEN` dipetakan setara `ASPRAK`.
 * Mengembalikan `null` bila nilai tidak valid (fail-fast).
 */
export function normalizeRole(value: unknown): Role | null {
  if (typeof value !== 'string') {
    return null;
  }

  switch (value.trim().toUpperCase()) {
    case ROLES.ASLAB:
      return ROLES.ASLAB;
    case ROLES.ASPRAK:
    case LEGACY_ASISTEN_ROLE:
      return ROLES.ASPRAK;
    case ROLES.PRAKTIKAN:
      return ROLES.PRAKTIKAN;
    default:
      return null;
  }
}

export function isValidRole(value: unknown): value is Role {
  return (
    value === ROLES.ASLAB ||
    value === ROLES.ASPRAK ||
    value === ROLES.PRAKTIKAN
  );
}

export function isPraktikanRole(value: unknown): boolean {
  return normalizeRole(value) === ROLES.PRAKTIKAN;
}

export function isAslabRole(value: unknown): boolean {
  return normalizeRole(value) === ROLES.ASLAB;
}

export function isAsprakRole(value: unknown): boolean {
  return normalizeRole(value) === ROLES.ASPRAK;
}

/**
 * Mengembalikan `true` untuk peran pengelola/pendamping praktikum
 * (`ASLAB`, `ASPRAK`, dan akun legacy `ASISTEN`).
 */
export function isAssistantRole(value: unknown): boolean {
  const normalized = normalizeRole(value);
  return normalized === ROLES.ASLAB || normalized === ROLES.ASPRAK;
}

export function getRoleLabel(value: unknown): string {
  switch (normalizeRole(value)) {
    case ROLES.ASLAB:
      return 'Asisten Lab';
    case ROLES.ASPRAK:
      return 'Asisten Praktikum';
    case ROLES.PRAKTIKAN:
      return 'Praktikan';
    default:
      return 'Tidak diketahui';
  }
}

export function getHomeRouteForRole(value: unknown): string {
  switch (normalizeRole(value)) {
    case ROLES.ASLAB:
      return '/aslab';
    case ROLES.ASPRAK:
      return '/assistant/(tabs)';
    case ROLES.PRAKTIKAN:
      return '/(tabs)/schedule';
    default:
      return '/login';
  }
}
