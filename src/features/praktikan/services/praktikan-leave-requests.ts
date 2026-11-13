import { FirebaseError } from 'firebase/app';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';

import { db } from '@/lib/firebase';
import type {
  LeaveRequestDoc,
  LeaveRequestStatus,
  SubmitLeaveRequestInput,
} from '@/features/praktikan/types';
import {
  LEAVE_AI_CATEGORY_MAX_LENGTH,
  validateLeaveReason,
} from '@/features/praktikan/utils/leave-validation';
import {
  mapPraktikanFirestoreError,
  readString,
  toDateOrNull,
} from '@/features/praktikan/services/firestore-helpers';

const VALID_LEAVE_STATUSES = new Set<LeaveRequestStatus>(['menunggu', 'diterima', 'ditolak']);

function parseLeaveRequestStatus(value: unknown, docId: string): LeaveRequestStatus {
  if (typeof value === 'string' && VALID_LEAVE_STATUSES.has(value as LeaveRequestStatus)) {
    return value as LeaveRequestStatus;
  }

  throw new Error(
    `Status pengajuan izin (${docId}) tidak dikenali: ${String(value ?? 'kosong')}.`,
  );
}

function mapLeaveRequestDoc(id: string, data: Record<string, unknown>): LeaveRequestDoc {
  const uid = readString(data.uid);
  if (!uid) {
    throw new Error(`Dokumen pengajuan izin (${id}) tidak memiliki field "uid" yang valid.`);
  }

  const sessionId = readString(data.sessionId);
  if (!sessionId) {
    throw new Error(`Dokumen pengajuan izin (${id}) tidak memiliki field "sessionId" yang valid.`);
  }

  const alasan = readString(data.alasan);
  if (!alasan) {
    throw new Error(`Dokumen pengajuan izin (${id}) tidak memiliki field "alasan" yang valid.`);
  }

  return {
    id,
    uid,
    nama: readString(data.nama) ?? null,
    sessionId,
    alasan,
    kategoriAI: readString(data.kategoriAI) ?? null,
    status: parseLeaveRequestStatus(data.status, id),
    createdAt: toDateOrNull(data.createdAt),
    reviewedBy: readString(data.reviewedBy) ?? null,
    reviewedAt: toDateOrNull(data.reviewedAt),
    catatanAsisten: readString(data.catatanAsisten) ?? null,
  };
}

function getCreatedAtSortTimestamp(createdAt: Date | null): number {
  // Pending serverTimestamp() writes briefly emit null; place them at the top until settled.
  return createdAt ? createdAt.getTime() : Number.MAX_SAFE_INTEGER;
}

function compareLeaveRequestsNewestFirst(a: LeaveRequestDoc, b: LeaveRequestDoc): number {
  const timeDiff = getCreatedAtSortTimestamp(b.createdAt) - getCreatedAtSortTimestamp(a.createdAt);
  if (timeDiff !== 0) {
    return timeDiff;
  }
  return a.id.localeCompare(b.id);
}

function normalizeKategoriAI(kategoriAI: string | null | undefined): string | null {
  if (kategoriAI === undefined || kategoriAI === null) {
    return null;
  }

  if (typeof kategoriAI !== 'string') {
    throw new Error('Kategori AI pengajuan izin harus berupa teks atau null.');
  }

  const trimmed = kategoriAI.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.length > LEAVE_AI_CATEGORY_MAX_LENGTH) {
    throw new Error(
      `Kategori AI pengajuan izin maksimal ${LEAVE_AI_CATEGORY_MAX_LENGTH} karakter.`,
    );
  }

  return trimmed;
}

function validateSubmitInput(input: SubmitLeaveRequestInput): {
  sessionId: string;
  uid: string;
  nama: string;
  alasan: string;
  kategoriAI: string | null;
} {
  const sessionId = typeof input.sessionId === 'string' ? input.sessionId.trim() : '';
  if (!sessionId) {
    throw new Error('ID sesi wajib diisi untuk mengajukan izin.');
  }

  const uid = typeof input.uid === 'string' ? input.uid.trim() : '';
  if (!uid) {
    throw new Error('UID praktikan wajib diisi untuk mengajukan izin.');
  }

  const nama = typeof input.nama === 'string' ? input.nama.trim() : '';
  if (!nama) {
    throw new Error('Nama praktikan wajib diisi untuk mengajukan izin.');
  }

  const reasonError = validateLeaveReason(input.alasan);
  if (reasonError) {
    throw new Error(reasonError);
  }

  return {
    sessionId,
    uid,
    nama,
    alasan: input.alasan.trim(),
    kategoriAI: normalizeKategoriAI(input.kategoriAI),
  };
}

async function resolveLeaveWritePermissionError(
  uid: string,
  sessionId: string,
  originalError: FirebaseError,
): Promise<Error> {
  const duplicateQuery = query(
    collection(db, 'leaveRequests'),
    where('uid', '==', uid),
    where('sessionId', '==', sessionId),
    limit(1),
  );
  const attendanceRef = doc(db, 'sessions', sessionId, 'attendance', uid);

  let duplicateSnap;
  let attendanceSnap;
  try {
    [duplicateSnap, attendanceSnap] = await Promise.all([
      getDocs(duplicateQuery),
      getDoc(attendanceRef),
    ]);
  } catch (checkError) {
    const checkCode = (checkError as { code?: string })?.code;
    if (
      checkCode &&
      checkCode !== 'permission-denied' &&
      checkCode !== 'firestore/permission-denied'
    ) {
      return mapPraktikanFirestoreError(checkError);
    }
    // Confirmation checks failed with permission/unknown; surface original Firestore error.
    return mapPraktikanFirestoreError(originalError);
  }

  if (!duplicateSnap.empty) {
    return new Error(
      'Pengajuan izin ditolak karena Anda sudah mengajukan izin untuk sesi ini sebelumnya.',
    );
  }

  if (attendanceSnap.exists()) {
    return new Error(
      'Pengajuan izin ditolak karena presensi Anda pada sesi ini sudah tercatat.',
    );
  }

  return new Error(
    'Pengajuan izin ditolak oleh aturan akses Firestore. Pastikan Anda login dengan akun Praktikan dan isi alasan sesuai ketentuan.',
  );
}

/**
 * Subscribe real-time ke seluruh pengajuan izin milik Praktikan saat ini.
 * Wajib memakai filter `where('uid', '==', uid)` agar lolos firestore.rules dan
 * diurutkan di JavaScript (terbaru ke terlama) agar tidak membutuhkan composite index.
 */
export function subscribeMyLeaveRequests(
  uid: string,
  onData: (requests: LeaveRequestDoc[]) => void,
  onError: (error: Error) => void,
): () => void {
  const trimmedUid = typeof uid === 'string' ? uid.trim() : '';
  if (!trimmedUid) {
    throw new Error('UID praktikan wajib diisi untuk memantau pengajuan izin.');
  }

  let active = true;
  const leaveRequestsQuery = query(
    collection(db, 'leaveRequests'),
    where('uid', '==', trimmedUid),
  );

  const unsubscribe = onSnapshot(
    leaveRequestsQuery,
    (snapshot) => {
      if (!active) {
        return;
      }

      try {
        const mapped = snapshot.docs.map((docSnap) =>
          mapLeaveRequestDoc(docSnap.id, docSnap.data() as Record<string, unknown>),
        );
        mapped.sort(compareLeaveRequestsNewestFirst);
        onData(mapped);
      } catch (error) {
        onError(mapPraktikanFirestoreError(error));
      }
    },
    (error) => {
      if (!active) {
        return;
      }
      onError(mapPraktikanFirestoreError(error));
    },
  );

  return () => {
    active = false;
    unsubscribe();
  };
}

/**
 * Mengirim pengajuan izin baru milik Praktikan ke `leaveRequests/{sessionId}_{uid}`.
 * Melakukan pra-cek duplikasi via query `where(uid) + where(sessionId)` dan pra-cek
 * kehadiran di `sessions/{sessionId}/attendance/{uid}` sebelum menulis tepat 7 field.
 */
export async function submitPraktikanLeaveRequest(
  input: SubmitLeaveRequestInput,
): Promise<void> {
  const { sessionId, uid, nama, alasan, kategoriAI } = validateSubmitInput(input);

  // Query by uid + sessionId instead of getDoc(id) because rules forbid reading missing leaveRequests docs.
  const duplicateQuery = query(
    collection(db, 'leaveRequests'),
    where('uid', '==', uid),
    where('sessionId', '==', sessionId),
    limit(1),
  );
  const attendanceRef = doc(db, 'sessions', sessionId, 'attendance', uid);

  let duplicateSnap;
  let attendanceSnap;
  try {
    [duplicateSnap, attendanceSnap] = await Promise.all([
      getDocs(duplicateQuery),
      getDoc(attendanceRef),
    ]);
  } catch (error) {
    throw mapPraktikanFirestoreError(error);
  }

  if (!duplicateSnap.empty) {
    throw new Error('Anda sudah pernah mengajukan izin untuk sesi ini.');
  }

  if (attendanceSnap.exists()) {
    throw new Error(
      'Pengajuan izin tidak dapat dikirim karena presensi Anda pada sesi ini sudah tercatat.',
    );
  }

  const leaveDocRef = doc(db, 'leaveRequests', `${sessionId}_${uid}`);

  try {
    await setDoc(leaveDocRef, {
      uid,
      nama,
      sessionId,
      alasan,
      kategoriAI,
      status: 'menunggu',
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    if (error instanceof FirebaseError && error.code === 'permission-denied') {
      throw await resolveLeaveWritePermissionError(uid, sessionId, error);
    }
    throw mapPraktikanFirestoreError(error);
  }
}
