import { LAB_MEMBER_ROLES, type LabMember } from '../../types/laboratory';
import type {
  BulkFieldSpec,
  BulkParsedRow,
  BulkReviewRow,
  BulkRowParseOutput,
  BulkValidationSchema,
} from './types';
import { validateBulkRows } from './validation-engine';

export type CanonicalUserRole = 'ASLAB' | 'ASPRAK' | 'PRAKTIKAN';

export interface LookupUserRecord {
  uid: string;
  nama: string;
  email: string;
  nim: string | null;
  role: CanonicalUserRole;
  rawRole?: string;
}

export interface UsersLookupMap {
  byUid: Map<string, LookupUserRecord>;
  byEmail: Map<string, LookupUserRecord>;
  byNim: Map<string, LookupUserRecord>;
  all: LookupUserRecord[];
}

export interface UserMatchIdentifier {
  userId?: string;
  email?: string;
  nim?: string;
}

export interface UserMatchResult {
  user: LookupUserRecord | null;
  errors: string[];
}

export interface BulkPraktikanItem {
  labId: string;
  userId: string;
  peran: typeof LAB_MEMBER_ROLES.PRAKTIKAN;
  nama: string;
  email: string;
  nim: string;
  catatan: string;
}

export interface BulkAsprakItem {
  labId: string;
  userId: string;
  peran: typeof LAB_MEMBER_ROLES.ASPRAK;
  nama: string;
  email: string;
  nim: string | null;
  catatan: string;
}

export type ExistingMembersInput =
  | readonly LabMember[]
  | ReadonlySet<string>;

export interface ValidatePraktikanRowsOptions {
  /** Anggota aktif pada lab lain di mata kuliah yang sama untuk mencegah praktikan terdaftar ganda di 1 matkul. */
  courseLabMembers?: ExistingMembersInput;
  previousRows?: readonly BulkReviewRow<BulkPraktikanItem>[];
}

export interface ValidateAsprakRowsOptions {
  previousRows?: readonly BulkReviewRow<BulkAsprakItem>[];
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeCanonicalUserRole(
  value: unknown,
): CanonicalUserRole | null {
  if (typeof value !== 'string') return null;

  switch (value.trim().toUpperCase()) {
    case 'ASLAB':
      return 'ASLAB';
    case 'ASPRAK':
    case 'ASISTEN':
      return 'ASPRAK';
    case 'PRAKTIKAN':
      return 'PRAKTIKAN';
    default:
      return null;
  }
}

function getRoleDisplayLabel(role: CanonicalUserRole): string {
  switch (role) {
    case 'ASLAB':
      return 'Aslab';
    case 'ASPRAK':
      return 'Asprak';
    case 'PRAKTIKAN':
      return 'Praktikan';
  }
}

/**
 * Membangun indeks O(1) koleksi `users` berdasarkan `uid`, `email`, dan `nim`.
 */
export function buildUsersLookupMap(
  users: readonly LookupUserRecord[],
): UsersLookupMap {
  const byUid = new Map<string, LookupUserRecord>();
  const byEmail = new Map<string, LookupUserRecord>();
  const byNim = new Map<string, LookupUserRecord>();
  const all: LookupUserRecord[] = [];

  for (const user of users) {
    const cleanUid = user.uid.trim();
    if (!cleanUid) continue;

    const cleanEmail = user.email.trim().toLowerCase();
    const cleanNim = user.nim ? user.nim.trim() : null;
    const normalized: LookupUserRecord = {
      ...user,
      uid: cleanUid,
      nama: user.nama.trim(),
      email: cleanEmail,
      nim: cleanNim,
    };

    all.push(normalized);
    byUid.set(cleanUid, normalized);
    if (cleanEmail) {
      byEmail.set(cleanEmail, normalized);
    }
    if (cleanNim) {
      byNim.set(cleanNim.toLowerCase(), normalized);
    }
  }

  return { byUid, byEmail, byNim, all };
}

/**
 * Mencocokkan data unggahan/input (`userId`, `email`, dan/atau `nim`) terhadap indeks
 * koleksi `users` dan memverifikasi kesesuaian role akun.
 */
export function matchUserAccount(
  identifier: UserMatchIdentifier,
  usersMap: UsersLookupMap,
  expectedRole?: CanonicalUserRole,
): UserMatchResult {
  const cleanUid = identifier.userId?.trim() ?? '';
  const cleanEmail = identifier.email?.trim().toLowerCase() ?? '';
  const cleanNim = identifier.nim?.trim() ?? '';

  if (!cleanUid && !cleanEmail && !cleanNim) {
    return {
      user: null,
      errors: ['Minimal userId, email, atau NIM harus disediakan untuk pencocokan akun.'],
    };
  }

  const byUidMatch = cleanUid ? usersMap.byUid.get(cleanUid) : undefined;
  const byEmailMatch = cleanEmail ? usersMap.byEmail.get(cleanEmail) : undefined;
  const byNimMatch = cleanNim
    ? usersMap.byNim.get(cleanNim.toLowerCase())
    : undefined;

  const matchedUsers = [byUidMatch, byEmailMatch, byNimMatch].filter(
    (item): item is LookupUserRecord => item !== undefined,
  );

  if (matchedUsers.length === 0) {
    const roleHint = expectedRole ? ` (${getRoleDisplayLabel(expectedRole)})` : '';
    return {
      user: null,
      errors: [
        `Akun pengguna${roleHint} dengan identitas tersebut tidak ditemukan di database.`,
      ],
    };
  }

  const distinctUids = new Set(matchedUsers.map((item) => item.uid));
  if (distinctUids.size > 1) {
    return {
      user: null,
      errors: [
        'Email dan NIM (atau userId) merujuk pada dua akun pengguna yang berbeda.',
      ],
    };
  }

  const resolvedUser = matchedUsers[0];
  const errors: string[] = [];

  if (
    cleanEmail &&
    resolvedUser.email &&
    resolvedUser.email.toLowerCase() !== cleanEmail
  ) {
    errors.push(
      `Email "${cleanEmail}" tidak cocok dengan email akun terdaftar (${resolvedUser.email}).`,
    );
  }

  if (
    cleanNim &&
    resolvedUser.nim &&
    resolvedUser.nim.toLowerCase() !== cleanNim.toLowerCase()
  ) {
    errors.push(
      `NIM "${cleanNim}" tidak sesuai dengan NIM akun terdaftar (${resolvedUser.nim}).`,
    );
  }

  if (expectedRole && resolvedUser.role !== expectedRole) {
    errors.push(
      `Akun terdaftar memiliki role ${resolvedUser.role}, bukan ${expectedRole}.`,
    );
  }

  return {
    user: errors.length === 0 ? resolvedUser : null,
    errors,
  };
}

function assertValidLabId(labId: string): string {
  const trimmed = labId.trim();
  if (!trimmed || trimmed.includes('/')) {
    throw new Error('ID laboratorium tujuan wajib valid.');
  }
  return trimmed;
}

function indexActiveMembers(input: ExistingMembersInput): {
  activeUserIds: Set<string>;
  memberByUserId: Map<string, LabMember>;
} {
  const activeUserIds = new Set<string>();
  const memberByUserId = new Map<string, LabMember>();

  if (input instanceof Set) {
    for (const userId of input) {
      const cleanId = userId.trim();
      if (cleanId) activeUserIds.add(cleanId);
    }
    return { activeUserIds, memberByUserId };
  }

  for (const member of input as readonly LabMember[]) {
    memberByUserId.set(member.userId, member);
    if (member.aktif) {
      activeUserIds.add(member.userId);
    }
  }

  return { activeUserIds, memberByUserId };
}

function extractUidFromDuplicateKey(key: string): string | null {
  return key.startsWith('uid:') ? key.slice(4) : null;
}

// ==========================================
// VALIDATOR KHUSUS PRAKTIKAN (TERPISAH)
// ==========================================

export const PRAKTIKAN_BULK_REQUIRED_HEADERS: readonly string[] = [
  'nim',
  'email',
  'nama',
];

export const PRAKTIKAN_BULK_FIELDS: readonly BulkFieldSpec[] = [
  {
    key: 'nim',
    label: 'NIM',
    required: true,
    placeholder: 'Contoh: 24060122120001',
    validate: (value) =>
      value.trim().length < 4 ? 'Format NIM minimal 4 karakter.' : null,
  },
  {
    key: 'email',
    label: 'Email',
    required: true,
    placeholder: 'nama@students.undip.ac.id',
    keyboardType: 'email-address',
    validate: (value) =>
      EMAIL_RE.test(value.trim()) ? null : 'Format email tidak valid.',
  },
  {
    key: 'nama',
    label: 'Nama Lengkap',
    required: true,
    placeholder: 'Nama lengkap praktikan',
    validate: (value) =>
      value.trim().length < 2 ? 'Nama minimal 2 karakter.' : null,
  },
  {
    key: 'catatan',
    label: 'Catatan (Opsional)',
    required: false,
    placeholder: 'Shift atau keterangan tambahan',
  },
];

export function createPraktikanBulkSchema(
  labId: string,
  usersMap: UsersLookupMap,
  targetMemberByUserId: ReadonlyMap<string, LabMember>,
  courseMemberByUserId: ReadonlyMap<string, LabMember>,
): BulkValidationSchema<BulkPraktikanItem> {
  const validLabId = assertValidLabId(labId);

  return {
    fields: PRAKTIKAN_BULK_FIELDS,
    parseRow(raw: Record<string, string>): BulkRowParseOutput<BulkPraktikanItem> {
      const nim = (raw.nim ?? '').trim();
      const email = (raw.email ?? '').trim().toLowerCase();
      const nama = (raw.nama ?? '').trim();
      const catatan = (raw.catatan ?? '').trim();

      if (!nim || !email || !nama || !EMAIL_RE.test(email) || nim.length < 4 || nama.length < 2) {
        return { data: null, errors: [] };
      }

      const match = matchUserAccount({ email, nim }, usersMap, 'PRAKTIKAN');
      if (!match.user) {
        return { data: null, errors: match.errors };
      }

      return {
        data: {
          labId: validLabId,
          userId: match.user.uid,
          peran: LAB_MEMBER_ROLES.PRAKTIKAN,
          nama: nama || match.user.nama,
          email: match.user.email || email,
          nim: nim || match.user.nim || '',
          catatan,
        },
        errors: [],
      };
    },
    getDuplicateKey(raw, parsed): string | null {
      if (parsed?.userId) {
        return `uid:${parsed.userId}`;
      }
      const email = (raw.email ?? '').trim().toLowerCase();
      if (email) {
        return `email:${email}`;
      }
      const nim = (raw.nim ?? '').trim().toLowerCase();
      return nim ? `nim:${nim}` : null;
    },
    duplicateInFileMessage: (_rowIndex, firstRowIndex) =>
      `Praktikan duplikat di dalam file dengan baris #${firstRowIndex}.`,
    duplicateInDbMessage: (duplicateKey) => {
      const uid = extractUidFromDuplicateKey(duplicateKey);
      if (uid) {
        const existingTarget = targetMemberByUserId.get(uid);
        if (existingTarget?.aktif) {
          return existingTarget.peran === LAB_MEMBER_ROLES.PRAKTIKAN
            ? 'Praktikan ini sudah terdaftar aktif di laboratorium ini.'
            : `Akun ini sudah terdaftar aktif di laboratorium ini sebagai ${existingTarget.peran}.`;
        }
        const existingCourse = courseMemberByUserId.get(uid);
        if (existingCourse?.aktif) {
          return `Praktikan sudah terdaftar aktif pada lab lain (${existingCourse.labId}) di mata kuliah yang sama.`;
        }
      }
      return 'Praktikan sudah terdaftar aktif di laboratorium ini.';
    },
  };
}

/**
 * Validator khusus alur Bulk Praktikan (kompatibel dengan `validateBulkRows`).
 */
export async function validatePraktikanRows(
  rows: readonly BulkParsedRow[],
  labId: string,
  existingMembers: ExistingMembersInput,
  usersMap: UsersLookupMap,
  options: ValidatePraktikanRowsOptions = {},
): Promise<BulkReviewRow<BulkPraktikanItem>[]> {
  const validLabId = assertValidLabId(labId);
  const targetIndex = indexActiveMembers(existingMembers);
  const courseIndex = indexActiveMembers(options.courseLabMembers ?? []);

  const dbDuplicateKeys = new Set<string>();
  for (const uid of targetIndex.activeUserIds) {
    dbDuplicateKeys.add(`uid:${uid}`);
  }
  for (const uid of courseIndex.activeUserIds) {
    dbDuplicateKeys.add(`uid:${uid}`);
  }

  const schema = createPraktikanBulkSchema(
    validLabId,
    usersMap,
    targetIndex.memberByUserId,
    courseIndex.memberByUserId,
  );

  return validateBulkRows(rows, schema, dbDuplicateKeys, options.previousRows);
}

// ==========================================
// VALIDATOR KHUSUS ASPRAK (TERPISAH)
// ==========================================

export const ASPRAK_BULK_REQUIRED_HEADERS: readonly string[] = [
  'email',
  'nama',
];

export const ASPRAK_BULK_FIELDS: readonly BulkFieldSpec[] = [
  {
    key: 'email',
    label: 'Email',
    required: true,
    placeholder: 'asprak@asprak.undip.ac.id',
    keyboardType: 'email-address',
    validate: (value) =>
      EMAIL_RE.test(value.trim()) ? null : 'Format email tidak valid.',
  },
  {
    key: 'nama',
    label: 'Nama Lengkap',
    required: true,
    placeholder: 'Nama lengkap asprak',
    validate: (value) =>
      value.trim().length < 2 ? 'Nama minimal 2 karakter.' : null,
  },
  {
    key: 'nim',
    label: 'NIM (Opsional)',
    required: false,
    placeholder: 'Opsional untuk asisten',
    validate: (value) =>
      value.trim().length > 0 && value.trim().length < 4
        ? 'Format NIM minimal 4 karakter bila diisi.'
        : null,
  },
  {
    key: 'catatan',
    label: 'Catatan (Opsional)',
    required: false,
    placeholder: 'Koordinator / catatan tugas',
  },
];

export function createAsprakBulkSchema(
  labId: string,
  usersMap: UsersLookupMap,
  targetMemberByUserId: ReadonlyMap<string, LabMember>,
): BulkValidationSchema<BulkAsprakItem> {
  const validLabId = assertValidLabId(labId);

  return {
    fields: ASPRAK_BULK_FIELDS,
    parseRow(raw: Record<string, string>): BulkRowParseOutput<BulkAsprakItem> {
      const email = (raw.email ?? '').trim().toLowerCase();
      const nama = (raw.nama ?? '').trim();
      const nimRaw = (raw.nim ?? '').trim();
      const catatan = (raw.catatan ?? '').trim();

      if (
        !email ||
        !nama ||
        !EMAIL_RE.test(email) ||
        nama.length < 2 ||
        (nimRaw.length > 0 && nimRaw.length < 4)
      ) {
        return { data: null, errors: [] };
      }

      const match = matchUserAccount(
        { email, nim: nimRaw || undefined },
        usersMap,
        'ASPRAK',
      );
      if (!match.user) {
        return { data: null, errors: match.errors };
      }

      return {
        data: {
          labId: validLabId,
          userId: match.user.uid,
          peran: LAB_MEMBER_ROLES.ASPRAK,
          nama: nama || match.user.nama,
          email: match.user.email || email,
          nim: nimRaw || match.user.nim || null,
          catatan,
        },
        errors: [],
      };
    },
    getDuplicateKey(raw, parsed): string | null {
      if (parsed?.userId) {
        return `uid:${parsed.userId}`;
      }
      const email = (raw.email ?? '').trim().toLowerCase();
      return email ? `email:${email}` : null;
    },
    duplicateInFileMessage: (_rowIndex, firstRowIndex) =>
      `Asprak duplikat di dalam file dengan baris #${firstRowIndex}.`,
    duplicateInDbMessage: (duplicateKey) => {
      const uid = extractUidFromDuplicateKey(duplicateKey);
      if (uid) {
        const existingTarget = targetMemberByUserId.get(uid);
        if (existingTarget?.aktif) {
          return existingTarget.peran === LAB_MEMBER_ROLES.ASPRAK
            ? 'Asprak ini sudah terdaftar aktif di laboratorium ini.'
            : `Akun ini sudah terdaftar aktif di laboratorium ini sebagai ${existingTarget.peran}.`;
        }
      }
      return 'Asprak sudah terdaftar aktif di laboratorium ini.';
    },
  };
}

/**
 * Validator khusus alur Bulk Asprak (kompatibel dengan `validateBulkRows`).
 */
export async function validateAsprakRows(
  rows: readonly BulkParsedRow[],
  labId: string,
  existingMembers: ExistingMembersInput,
  usersMap: UsersLookupMap,
  options: ValidateAsprakRowsOptions = {},
): Promise<BulkReviewRow<BulkAsprakItem>[]> {
  const validLabId = assertValidLabId(labId);
  const targetIndex = indexActiveMembers(existingMembers);

  const dbDuplicateKeys = new Set<string>();
  for (const uid of targetIndex.activeUserIds) {
    dbDuplicateKeys.add(`uid:${uid}`);
  }

  const schema = createAsprakBulkSchema(
    validLabId,
    usersMap,
    targetIndex.memberByUserId,
  );

  return validateBulkRows(rows, schema, dbDuplicateKeys, options.previousRows);
}
