import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  where,
  writeBatch,
  type DocumentData,
  type QueryConstraint,
  type Timestamp,
  type Unsubscribe,
} from 'firebase/firestore';

import { authErrorMessage } from '@/context/AuthContext';
import {
  BULK_MAX_ROWS,
  buildUsersLookupMap,
  matchUserAccount,
  normalizeCanonicalUserRole,
  type BulkAsprakItem,
  type BulkPraktikanItem,
  type BulkReviewRow,
  type CanonicalUserRole,
  type LookupUserRecord,
  type UserMatchIdentifier,
  type UsersLookupMap,
} from '@/features/bulk';
import { db } from '@/lib/firebase';
import {
  DEFAULT_FINE_NOMINAL,
  DEFAULT_GRACE_PERIOD_MINUTES,
  DEFAULT_LABORATORY_RADIUS_METERS,
  LAB_MEMBERS_COLLECTION,
  LAB_MEMBER_ROLES,
  LABORATORIES_COLLECTION,
  buildLabMemberId,
  normalizeLabMemberRole,
  type LabMember,
  type LabMemberRole,
  type Laboratory,
} from '@/types/laboratory';

export {
  LAB_MEMBERS_COLLECTION,
  LAB_MEMBER_ROLES,
  buildLabMemberId,
  normalizeLabMemberRole,
  type LabMember,
  type LabMemberRole,
};
export {
  ASPRAK_BULK_FIELDS,
  ASPRAK_BULK_REQUIRED_HEADERS,
  PRAKTIKAN_BULK_FIELDS,
  PRAKTIKAN_BULK_REQUIRED_HEADERS,
  buildUsersLookupMap,
  matchUserAccount,
  normalizeCanonicalUserRole,
  validateAsprakRows,
  validatePraktikanRows,
  type BulkAsprakItem,
  type BulkPraktikanItem,
  type CanonicalUserRole,
  type LookupUserRecord,
  type UsersLookupMap,
} from '@/features/bulk';

const USERS_COLLECTION = 'users';

export interface BulkMemberItemResult {
  rowIndex: number;
  userId: string | null;
  memberId: string | null;
  nama: string;
  email: string;
  status: 'saved' | 'skipped' | 'failed';
  reason: string;
}

export interface BulkInsertMembersResult {
  labId: string;
  peran: LabMemberRole;
  totalProcessed: number;
  savedCount: number;
  skippedCount: number;
  failedCount: number;
  savedMemberIds: string[];
  batchError: string | null;
  items: BulkMemberItemResult[];
}

function assertNonEmptyId(value: unknown, label: string): string {
  if (
    typeof value !== 'string' ||
    value.trim().length === 0 ||
    value.includes('/')
  ) {
    throw new Error(`${label} tidak valid.`);
  }
  return value.trim();
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

function readFirstNonEmptyString(...values: unknown[]): string {
  for (const val of values) {
    if (typeof val === 'string' && val.trim().length > 0) {
      return val.trim();
    }
  }
  return '';
}

function readOptionalNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function mapLabMemberDoc(docId: string, data: DocumentData): LabMember {
  const labId = assertNonEmptyId(data.labId, 'Field "labId" pada labMembers');
  const userId = assertNonEmptyId(
    data.userId,
    'Field "userId" pada labMembers',
  );

  const peran = normalizeLabMemberRole(data.peran);
  if (!peran) {
    throw new Error(
      `Field "peran" pada dokumen labMembers "${docId}" tidak valid (${String(data.peran)}).`,
    );
  }

  if (typeof data.aktif !== 'boolean') {
    throw new Error(
      `Field "aktif" pada dokumen labMembers "${docId}" harus berupa boolean.`,
    );
  }

  return {
    id: docId,
    labId,
    userId,
    peran,
    aktif: data.aktif,
    createdAt: toDateOrNull(data.createdAt),
    updatedAt: toDateOrNull(data.updatedAt),
  };
}

function mapLaboratoryDocSummary(docId: string, data: DocumentData): Laboratory {
  const nama = readFirstNonEmptyString(data.nama, data.name);
  if (!nama) {
    throw new Error(`Dokumen laboratorium "${docId}" tidak memiliki nama.`);
  }
  const lat = readOptionalNumber(data.lat ?? data.latitude, 0);
  const lng = readOptionalNumber(data.lng ?? data.longitude, 0);

  return {
    id: docId,
    nama,
    name: nama,
    mataKuliahId:
      typeof data.mataKuliahId === 'string' && data.mataKuliahId.trim().length > 0
        ? data.mataKuliahId.trim()
        : null,
    lokasi: typeof data.lokasi === 'string' ? data.lokasi.trim() : '',
    lat,
    lng,
    latitude: lat,
    longitude: lng,
    radius: readOptionalNumber(data.radius, DEFAULT_LABORATORY_RADIUS_METERS),
    gracePeriodMenit: readOptionalNumber(
      data.gracePeriodMenit,
      DEFAULT_GRACE_PERIOD_MINUTES,
    ),
    nominalDenda: readOptionalNumber(data.nominalDenda, DEFAULT_FINE_NOMINAL),
    updatedAt: toDateOrNull(data.updatedAt),
  };
}

function mapUserDoc(uid: string, data: DocumentData): LookupUserRecord | null {
  const role = normalizeCanonicalUserRole(data.role);
  if (!role) return null;

  const nama = readFirstNonEmptyString(data.nama, data.name, data.displayName);
  const email = readFirstNonEmptyString(data.email).toLowerCase();
  const nim = readFirstNonEmptyString(data.nim) || null;
  const rawRole = readFirstNonEmptyString(data.role) || undefined;

  return {
    uid,
    nama,
    email,
    nim,
    role,
    rawRole,
  };
}

function mapLabMemberError(error: unknown): Error {
  const code = (error as { code?: string })?.code;

  if (code) {
    return new Error(authErrorMessage(error));
  }

  if (error instanceof Error && error.message.trim().length > 0) {
    return error;
  }

  return new Error(
    'Terjadi kesalahan saat memproses data anggota laboratorium.',
  );
}

function resolveOptionalRoleFilter(
  peran?: LabMemberRole,
): LabMemberRole | undefined {
  if (peran === undefined) {
    return undefined;
  }

  const normalized = normalizeLabMemberRole(peran);
  if (!normalized) {
    throw new Error(`Peran anggota lab tidak valid: "${String(peran)}".`);
  }
  return normalized;
}

function sortMembers(members: LabMember[]): LabMember[] {
  return [...members].sort((a, b) => a.userId.localeCompare(b.userId));
}

// ==========================================
// HELPER PENCARIAN & PENCOCOKAN KOLEKSI USERS
// ==========================================

/**
 * Memuat seluruh pengguna valid pada koleksi `users` menjadi `UsersLookupMap`
 * untuk kebutuhan pencocokan bulk maupun single member.
 */
export async function loadUsersLookupMap(
  roleFilter?: CanonicalUserRole,
): Promise<UsersLookupMap> {
  try {
    const snapshot = await getDocs(collection(db, USERS_COLLECTION));
    const records: LookupUserRecord[] = [];

    for (const docSnap of snapshot.docs) {
      const mapped = mapUserDoc(docSnap.id, docSnap.data());
      if (!mapped) continue;
      if (roleFilter && mapped.role !== roleFilter) continue;
      records.push(mapped);
    }

    return buildUsersLookupMap(records);
  } catch (error) {
    throw mapLabMemberError(error);
  }
}

/**
 * Mencari 1 akun pengguna pada koleksi `users` berdasarkan `userId`, `email`,
 * dan/atau `nim`, lalu memverifikasi apakah role-nya sesuai.
 */
export async function findUserByIdentifier(
  identifier: UserMatchIdentifier,
  expectedRole?: CanonicalUserRole,
): Promise<LookupUserRecord> {
  const cleanUid = identifier.userId?.trim() ?? '';
  const cleanEmail = identifier.email?.trim().toLowerCase() ?? '';
  const cleanNim = identifier.nim?.trim() ?? '';

  if (!cleanUid && !cleanEmail && !cleanNim) {
    throw new Error('Minimal userId, email, atau NIM harus diisi.');
  }

  try {
    const candidates: LookupUserRecord[] = [];

    if (cleanUid) {
      const snap = await getDoc(doc(db, USERS_COLLECTION, cleanUid));
      if (snap.exists()) {
        const mapped = mapUserDoc(snap.id, snap.data());
        if (mapped) candidates.push(mapped);
      }
    }

    if (cleanEmail) {
      const snap = await getDocs(
        query(collection(db, USERS_COLLECTION), where('email', '==', cleanEmail)),
      );
      for (const docSnap of snap.docs) {
        const mapped = mapUserDoc(docSnap.id, docSnap.data());
        if (mapped) candidates.push(mapped);
      }
    }

    if (cleanNim) {
      const snap = await getDocs(
        query(collection(db, USERS_COLLECTION), where('nim', '==', cleanNim)),
      );
      for (const docSnap of snap.docs) {
        const mapped = mapUserDoc(docSnap.id, docSnap.data());
        if (mapped) candidates.push(mapped);
      }
    }

    const lookup = buildUsersLookupMap(candidates);
    const result = matchUserAccount(identifier, lookup, expectedRole);
    if (!result.user) {
      throw new Error(
        result.errors[0] ?? 'Akun pengguna tidak valid atau tidak ditemukan.',
      );
    }

    return result.user;
  } catch (error) {
    throw mapLabMemberError(error);
  }
}

// ==========================================
// HELPER BACA DASAR & QUERY LAB MEMBERS
// ==========================================

/**
 * Mengambil 1 dokumen keanggotaan lab secara O(1) dengan ID deterministik `{labId}_{userId}`.
 */
export async function getLabMember(
  labId: string,
  userId: string,
): Promise<LabMember | null> {
  const memberId = buildLabMemberId(labId, userId);

  try {
    const snapshot = await getDoc(doc(db, LAB_MEMBERS_COLLECTION, memberId));
    if (!snapshot.exists()) {
      return null;
    }
    return mapLabMemberDoc(snapshot.id, snapshot.data());
  } catch (error) {
    throw mapLabMemberError(error);
  }
}

/**
 * Memeriksa apakah `userId` terdaftar aktif pada `labId` (opsional per `peran`).
 */
export async function isActiveLabMember(
  labId: string,
  userId: string,
  peran?: LabMemberRole,
): Promise<boolean> {
  const roleFilter = resolveOptionalRoleFilter(peran);
  const member = await getLabMember(labId, userId);
  if (!member || !member.aktif) {
    return false;
  }
  return roleFilter ? member.peran === roleFilter : true;
}

/**
 * Mengambil seluruh dokumen keanggotaan (`aktif: true` dan `false`) pada `labId`.
 */
export async function getLabMembersForLab(labId: string): Promise<LabMember[]> {
  const validLabId = assertNonEmptyId(labId, 'ID laboratorium');

  try {
    const snapshot = await getDocs(
      query(collection(db, LAB_MEMBERS_COLLECTION), where('labId', '==', validLabId)),
    );
    const members = snapshot.docs.map((docSnap) =>
      mapLabMemberDoc(docSnap.id, docSnap.data()),
    );
    return sortMembers(members);
  } catch (error) {
    throw mapLabMemberError(error);
  }
}

/**
 * Mengambil seluruh anggota aktif pada suatu laboratorium (opsional difilter `peran`).
 */
export async function getActiveLabMembers(
  labId: string,
  peran?: LabMemberRole,
): Promise<LabMember[]> {
  const validLabId = assertNonEmptyId(labId, 'ID laboratorium');
  const roleFilter = resolveOptionalRoleFilter(peran);

  const constraints: QueryConstraint[] = [
    where('labId', '==', validLabId),
    where('aktif', '==', true),
  ];

  if (roleFilter) {
    constraints.push(where('peran', '==', roleFilter));
  }

  try {
    const snapshot = await getDocs(
      query(collection(db, LAB_MEMBERS_COLLECTION), ...constraints),
    );
    const members = snapshot.docs.map((docSnap) =>
      mapLabMemberDoc(docSnap.id, docSnap.data()),
    );
    return sortMembers(members);
  } catch (error) {
    throw mapLabMemberError(error);
  }
}

/**
 * Mengambil keanggotaan praktikan aktif di lab lain pada `mataKuliahId` yang sama.
 */
export async function getActiveCourseLabMembers(
  mataKuliahId: string,
  excludeLabId?: string,
): Promise<LabMember[]> {
  const cleanCourse = mataKuliahId.trim();
  if (!cleanCourse) {
    return [];
  }

  try {
    const labsSnapshot = await getDocs(
      query(
        collection(db, LABORATORIES_COLLECTION),
        where('mataKuliahId', '==', cleanCourse),
      ),
    );

    const siblingLabIds = labsSnapshot.docs
      .map((docSnap) => docSnap.id)
      .filter((id) => id !== excludeLabId?.trim());

    if (siblingLabIds.length === 0) {
      return [];
    }

    const memberLists = await Promise.all(
      siblingLabIds.map((siblingLabId) =>
        getActiveLabMembers(siblingLabId, LAB_MEMBER_ROLES.PRAKTIKAN),
      ),
    );

    return memberLists.flat();
  } catch (error) {
    throw mapLabMemberError(error);
  }
}

/**
 * Mendengarkan daftar anggota aktif suatu laboratorium secara real-time.
 */
export function subscribeActiveLabMembers(
  labId: string,
  onData: (members: LabMember[]) => void,
  onError: (error: Error) => void,
  peran?: LabMemberRole,
): Unsubscribe {
  const validLabId = assertNonEmptyId(labId, 'ID laboratorium');
  const roleFilter = resolveOptionalRoleFilter(peran);

  const constraints: QueryConstraint[] = [
    where('labId', '==', validLabId),
    where('aktif', '==', true),
  ];

  if (roleFilter) {
    constraints.push(where('peran', '==', roleFilter));
  }

  let active = true;

  const unsubscribe = onSnapshot(
    query(collection(db, LAB_MEMBERS_COLLECTION), ...constraints),
    (snapshot) => {
      if (!active) return;

      try {
        const members = snapshot.docs.map((docSnap) =>
          mapLabMemberDoc(docSnap.id, docSnap.data()),
        );
        onData(sortMembers(members));
      } catch (error) {
        onError(mapLabMemberError(error));
      }
    },
    (error) => {
      if (!active) return;
      onError(mapLabMemberError(error));
    },
  );

  return () => {
    active = false;
    unsubscribe();
  };
}

/**
 * Mengambil seluruh keanggotaan lab aktif milik satu pengguna (opsional difilter `peran`).
 */
export async function getActiveMembershipsByUser(
  userId: string,
  peran?: LabMemberRole,
): Promise<LabMember[]> {
  const validUserId = assertNonEmptyId(userId, 'ID pengguna');
  const roleFilter = resolveOptionalRoleFilter(peran);

  const constraints: QueryConstraint[] = [
    where('userId', '==', validUserId),
    where('aktif', '==', true),
  ];

  if (roleFilter) {
    constraints.push(where('peran', '==', roleFilter));
  }

  try {
    const snapshot = await getDocs(
      query(collection(db, LAB_MEMBERS_COLLECTION), ...constraints),
    );
    return snapshot.docs.map((docSnap) =>
      mapLabMemberDoc(docSnap.id, docSnap.data()),
    );
  } catch (error) {
    throw mapLabMemberError(error);
  }
}

async function getLaboratoriesByIds(labIds: string[]): Promise<Laboratory[]> {
  const uniqueIds = Array.from(
    new Set(labIds.map((id) => assertNonEmptyId(id, 'ID laboratorium'))),
  );
  if (uniqueIds.length === 0) return [];

  try {
    const snapshots = await Promise.all(
      uniqueIds.map((id) => getDoc(doc(db, LABORATORIES_COLLECTION, id))),
    );

    const labs: Laboratory[] = [];
    for (const snap of snapshots) {
      if (!snap.exists()) continue;
      labs.push(mapLaboratoryDocSummary(snap.id, snap.data()));
    }
    return labs.sort((a, b) => a.nama.localeCompare(b.nama, 'id'));
  } catch (error) {
    throw mapLabMemberError(error);
  }
}

/**
 * Mengambil daftar laboratorium aktif yang didampingi oleh seorang Asprak (`userId`).
 */
export async function getLabsByAsprak(userId: string): Promise<Laboratory[]> {
  const memberships = await getActiveMembershipsByUser(
    userId,
    LAB_MEMBER_ROLES.ASPRAK,
  );
  return getLaboratoriesByIds(memberships.map((item) => item.labId));
}

/**
 * Mengambil daftar laboratorium aktif yang diikuti oleh seorang Praktikan (`userId`).
 */
export async function getLabsByPraktikan(userId: string): Promise<Laboratory[]> {
  const memberships = await getActiveMembershipsByUser(
    userId,
    LAB_MEMBER_ROLES.PRAKTIKAN,
  );
  return getLaboratoriesByIds(memberships.map((item) => item.labId));
}

// ==========================================
// INTERNAL SAVE HELPERS (NFR-01 & NFR-02)
// ==========================================

async function addSingleLabMember(
  labId: string,
  userId: string,
  peran: LabMemberRole,
  expectedAccountRole: CanonicalUserRole,
): Promise<LabMember> {
  const validLabId = assertNonEmptyId(labId, 'ID laboratorium');
  const validUserId = assertNonEmptyId(userId, 'ID pengguna');
  const memberId = buildLabMemberId(validLabId, validUserId);

  // Verifikasi akun terdaftar dan memiliki role yang sesuai di `users`.
  await findUserByIdentifier({ userId: validUserId }, expectedAccountRole);

  const labRef = doc(db, LABORATORIES_COLLECTION, validLabId);
  const memberRef = doc(db, LAB_MEMBERS_COLLECTION, memberId);

  try {
    const saved = await runTransaction(db, async (transaction) => {
      const [labSnap, memberSnap] = await Promise.all([
        transaction.get(labRef),
        transaction.get(memberRef),
      ]);

      if (!labSnap.exists()) {
        throw new Error(`Laboratorium "${validLabId}" tidak ditemukan.`);
      }

      let existingCreatedAt: unknown = serverTimestamp();

      if (memberSnap.exists()) {
        const existing = mapLabMemberDoc(memberSnap.id, memberSnap.data());
        if (existing.aktif) {
          throw new Error(
            existing.peran === peran
              ? `Pengguna ini sudah terdaftar aktif sebagai ${peran} di laboratorium ini.`
              : `Pengguna ini sudah terdaftar aktif sebagai ${existing.peran} di laboratorium ini.`,
          );
        }
        if (memberSnap.data().createdAt != null) {
          existingCreatedAt = memberSnap.data().createdAt;
        }
      }

      transaction.set(memberRef, {
        labId: validLabId,
        userId: validUserId,
        peran,
        aktif: true,
        createdAt: existingCreatedAt,
        updatedAt: serverTimestamp(),
      });

      return {
        id: memberId,
        labId: validLabId,
        userId: validUserId,
        peran,
        aktif: true,
        createdAt: memberSnap.exists()
          ? toDateOrNull(memberSnap.data().createdAt)
          : new Date(),
        updatedAt: new Date(),
      };
    });

    return saved;
  } catch (error) {
    throw mapLabMemberError(error);
  }
}

interface BulkMemberCandidate {
  rowIndex: number;
  userId: string;
  nama: string;
  email: string;
}

async function bulkInsertLabMembersByRole<
  T extends BulkPraktikanItem | BulkAsprakItem,
>(
  labId: string,
  peran: LabMemberRole,
  rows: readonly BulkReviewRow<T>[],
): Promise<BulkInsertMembersResult> {
  const validLabId = assertNonEmptyId(labId, 'ID laboratorium');

  const acceptedCandidates: BulkMemberCandidate[] = [];
  const skippedItems: BulkMemberItemResult[] = [];
  const seenAcceptedUids = new Set<string>();

  for (const row of rows) {
    const rawName = (row.raw.nama ?? row.data?.nama ?? '').trim() || `Baris #${row.rowIndex}`;
    const rawEmail = (row.raw.email ?? row.data?.email ?? '').trim();

    if (row.status !== 'accepted' || row.errors.length > 0 || !row.data) {
      skippedItems.push({
        rowIndex: row.rowIndex,
        userId: row.data?.userId ?? null,
        memberId: null,
        nama: rawName,
        email: rawEmail,
        status: 'skipped',
        reason:
          row.errors.length > 0
            ? row.errors.join('; ')
            : 'Baris ditolak oleh pengguna (Denied).',
      });
      continue;
    }

    const uid = row.data.userId.trim();
    if (!uid) {
      skippedItems.push({
        rowIndex: row.rowIndex,
        userId: null,
        memberId: null,
        nama: rawName,
        email: rawEmail,
        status: 'skipped',
        reason: 'ID pengguna (userId) tidak valid.',
      });
      continue;
    }

    if (seenAcceptedUids.has(uid)) {
      skippedItems.push({
        rowIndex: row.rowIndex,
        userId: uid,
        memberId: null,
        nama: row.data.nama,
        email: row.data.email,
        status: 'skipped',
        reason: 'Duplikat userId di dalam daftar yang diterima.',
      });
      continue;
    }

    seenAcceptedUids.add(uid);
    acceptedCandidates.push({
      rowIndex: row.rowIndex,
      userId: uid,
      nama: row.data.nama,
      email: row.data.email,
    });
  }

  if (acceptedCandidates.length === 0) {
    throw new Error('Tidak ada baris valid berstatus Accepted untuk disimpan.');
  }

  if (acceptedCandidates.length > BULK_MAX_ROWS) {
    throw new Error(
      `Jumlah baris terpilih (${acceptedCandidates.length}) melebihi batas atomik Firestore (${BULK_MAX_ROWS} operasi).`,
    );
  }

  // Ambil dokumen lab & existing members untuk pengecekan akhir sebelum writeBatch.
  let existingDocsByUserId = new Map<
    string,
    { aktif: boolean; peran: LabMemberRole; createdAt: Timestamp | Date | null }
  >();

  try {
    const [labSnap, existingSnap] = await Promise.all([
      getDoc(doc(db, LABORATORIES_COLLECTION, validLabId)),
      getDocs(
        query(collection(db, LAB_MEMBERS_COLLECTION), where('labId', '==', validLabId)),
      ),
    ]);

    if (!labSnap.exists()) {
      throw new Error(`Laboratorium "${validLabId}" tidak ditemukan.`);
    }

    for (const docSnap of existingSnap.docs) {
      const data = docSnap.data();
      const mapped = mapLabMemberDoc(docSnap.id, data);
      existingDocsByUserId.set(mapped.userId, {
        aktif: mapped.aktif,
        peran: mapped.peran,
        createdAt: data.createdAt ?? null,
      });
    }
  } catch (error) {
    throw mapLabMemberError(error);
  }

  for (const candidate of acceptedCandidates) {
    const existing = existingDocsByUserId.get(candidate.userId);
    if (existing?.aktif) {
      throw new Error(
        `Baris #${candidate.rowIndex} (${candidate.nama}): sudah terdaftar aktif di laboratorium ini sebagai ${existing.peran}.`,
      );
    }
  }

  const batch = writeBatch(db);
  const pendingWrites: {
    rowIndex: number;
    userId: string;
    memberId: string;
    nama: string;
    email: string;
  }[] = [];

  for (const candidate of acceptedCandidates) {
    const memberId = buildLabMemberId(validLabId, candidate.userId);
    const memberRef = doc(db, LAB_MEMBERS_COLLECTION, memberId);
    const existing = existingDocsByUserId.get(candidate.userId);

    batch.set(memberRef, {
      labId: validLabId,
      userId: candidate.userId,
      peran,
      aktif: true,
      createdAt: existing?.createdAt ?? serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    pendingWrites.push({
      rowIndex: candidate.rowIndex,
      userId: candidate.userId,
      memberId,
      nama: candidate.nama,
      email: candidate.email,
    });
  }

  try {
    await batch.commit();

    const savedItems: BulkMemberItemResult[] = pendingWrites.map((entry) => ({
      rowIndex: entry.rowIndex,
      userId: entry.userId,
      memberId: entry.memberId,
      nama: entry.nama,
      email: entry.email,
      status: 'saved',
      reason: `Berhasil disimpan sebagai ${peran} aktif.`,
    }));

    const items = [...savedItems, ...skippedItems].sort(
      (a, b) => a.rowIndex - b.rowIndex,
    );

    return {
      labId: validLabId,
      peran,
      totalProcessed: rows.length,
      savedCount: savedItems.length,
      skippedCount: skippedItems.length,
      failedCount: 0,
      savedMemberIds: pendingWrites.map((entry) => entry.memberId),
      batchError: null,
      items,
    };
  } catch (error) {
    const mapped = mapLabMemberError(error);
    const failedItems: BulkMemberItemResult[] = pendingWrites.map((entry) => ({
      rowIndex: entry.rowIndex,
      userId: entry.userId,
      memberId: null,
      nama: entry.nama,
      email: entry.email,
      status: 'failed',
      reason: `Transaksi batch gagal (dibatalkan atomik): ${mapped.message}`,
    }));

    const items = [...failedItems, ...skippedItems].sort(
      (a, b) => a.rowIndex - b.rowIndex,
    );

    return {
      labId: validLabId,
      peran,
      totalProcessed: rows.length,
      savedCount: 0,
      skippedCount: skippedItems.length,
      failedCount: failedItems.length,
      savedMemberIds: [],
      batchError: mapped.message,
      items,
    };
  }
}

// ==========================================
// ALUR SIMPAN TERPISAH: PRAKTIKAN & ASPRAK
// ==========================================

/**
 * Menambahkan satu Praktikan (`userId`) ke laboratorium `labId`.
 */
export function addSinglePraktikan(
  labId: string,
  userId: string,
): Promise<LabMember> {
  return addSingleLabMember(
    labId,
    userId,
    LAB_MEMBER_ROLES.PRAKTIKAN,
    'PRAKTIKAN',
  );
}

/**
 * Menyimpan banyak Praktikan tervalidasi ke laboratorium `labId` secara atomik (maksimal 500 baris).
 */
export function bulkInsertPraktikan(
  labId: string,
  acceptedRows: readonly BulkReviewRow<BulkPraktikanItem>[],
): Promise<BulkInsertMembersResult> {
  return bulkInsertLabMembersByRole(
    labId,
    LAB_MEMBER_ROLES.PRAKTIKAN,
    acceptedRows,
  );
}

/**
 * Menambahkan satu Asprak (`userId`) ke laboratorium `labId`.
 */
export function addSingleAsprak(
  labId: string,
  userId: string,
): Promise<LabMember> {
  return addSingleLabMember(labId, userId, LAB_MEMBER_ROLES.ASPRAK, 'ASPRAK');
}

/**
 * Menyimpan banyak Asprak tervalidasi ke laboratorium `labId` secara atomik (maksimal 500 baris).
 */
export function bulkInsertAsprak(
  labId: string,
  acceptedRows: readonly BulkReviewRow<BulkAsprakItem>[],
): Promise<BulkInsertMembersResult> {
  return bulkInsertLabMembersByRole(
    labId,
    LAB_MEMBER_ROLES.ASPRAK,
    acceptedRows,
  );
}
