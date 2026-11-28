import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  where,
  type DocumentData,
  type QueryConstraint,
  type Unsubscribe,
} from 'firebase/firestore';

import { authErrorMessage } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { getLaboratoriesByIds } from '@/services/laboratory-service';
import {
  LAB_MEMBERS_COLLECTION,
  LAB_MEMBER_ROLES,
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

function assertNonEmptyId(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim().length === 0 || value.includes('/')) {
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

function mapLabMemberDoc(docId: string, data: DocumentData): LabMember {
  const labId = assertNonEmptyId(data.labId, 'Field "labId" pada labMembers');
  const userId = assertNonEmptyId(data.userId, 'Field "userId" pada labMembers');

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

function mapLabMemberError(error: unknown): Error {
  const code = (error as { code?: string })?.code;

  if (code) {
    return new Error(authErrorMessage(error));
  }

  if (error instanceof Error && error.message.trim().length > 0) {
    return error;
  }

  return new Error('Terjadi kesalahan saat membaca data anggota laboratorium.');
}

function resolveOptionalRoleFilter(peran?: LabMemberRole): LabMemberRole | undefined {
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
