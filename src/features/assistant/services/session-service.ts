import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  type DocumentData,
} from 'firebase/firestore';

import {
  getLaboratoryPreset,
  isLaboratoryId,
  type LaboratoryId,
} from '@/features/assistant/services/laboratory-service';
import { db } from '@/lib/firebase';

// ==========================================
// TIPE DATA SESI
// ==========================================

export type SessionStatus =
  | 'dijadwalkan'
  | 'dibuka'
  | 'ditutup';

export interface SessionRecord {
  id: string;
  scheduleId: string;
  classId: string;
  labId?: string;
  labName?: string;
  practicumName: string;
  moduleTitle: string;
  classRoom: string;
  scheduleTime: string;
  status: SessionStatus;
  sessionNote: string;
  createdBy: string;
}

export interface SessionInput {
  scheduleId: string;
  classId: string;
  labId: LaboratoryId;
  labName: string;
  practicumName: string;
  moduleTitle: string;
  classRoom: string;
  scheduleTime: string;
  sessionNote: string;
}

function readOptionalText(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function mapSessionRecord(id: string, data: DocumentData): SessionRecord {
  const labId = readOptionalText(data.labId);
  const presetLabName =
    labId && isLaboratoryId(labId) ? getLaboratoryPreset(labId).name : undefined;
  const labName = readOptionalText(data.labName) ?? presetLabName;
  const classRoom = readOptionalText(data.classRoom) ?? labName ?? '';

  return {
    id,
    scheduleId: readOptionalText(data.scheduleId) ?? '',
    classId: readOptionalText(data.classId) ?? '',
    ...(labId ? { labId } : {}),
    ...(labName ? { labName } : {}),
    practicumName: readOptionalText(data.practicumName) ?? '',
    moduleTitle: readOptionalText(data.moduleTitle) ?? '',
    classRoom,
    scheduleTime: readOptionalText(data.scheduleTime) ?? '',
    status: data.status as SessionStatus,
    sessionNote: typeof data.sessionNote === 'string' ? data.sessionNote : '',
    createdBy: readOptionalText(data.createdBy) ?? '',
  };
}

function validateSessionLabInput(input: SessionInput): SessionInput {
  if (!isLaboratoryId(input.labId)) {
    throw new Error('Pilih lokasi laboratorium yang valid.');
  }

  const trimmedLabName = input.labName.trim();
  if (!trimmedLabName) {
    throw new Error('Nama lokasi laboratorium wajib diisi.');
  }

  return {
    ...input,
    labName: trimmedLabName,
    classRoom: input.classRoom.trim() || trimmedLabName,
  };
}

// ==========================================
// MENGAMBIL SEMUA SESI SECARA REAL-TIME
// ==========================================

export function subscribeSessions(
  onData: (sessions: SessionRecord[]) => void,
  onError: (error: Error) => void,
) {
  const sessionsQuery = query(
    collection(db, 'sessions'),
    orderBy('createdAt', 'desc'),
  );

  return onSnapshot(
    sessionsQuery,
    (snapshot) => {
      const sessions = snapshot.docs.map((item) =>
        mapSessionRecord(item.id, item.data()),
      );

      onData(sessions);
    },
    onError,
  );
}

// ==========================================
// MEMBUAT SESI BARU
// ==========================================

export async function createSession(
  input: SessionInput,
  createdBy: string,
) {
  const validInput = validateSessionLabInput(input);

  await addDoc(collection(db, 'sessions'), {
    ...validInput,
    status: 'dijadwalkan',
    createdBy,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

// ==========================================
// MENGUBAH INFORMASI SESI
// ==========================================

export async function updateSession(
  sessionId: string,
  input: SessionInput,
) {
  const validInput = validateSessionLabInput(input);
  const sessionRef = doc(db, 'sessions', sessionId);

  const sessionSnapshot = await getDoc(sessionRef);

  if (!sessionSnapshot.exists()) {
    throw new Error('Sesi tidak ditemukan.');
  }

  if (sessionSnapshot.data().status !== 'dijadwalkan') {
    throw new Error(
      'Hanya sesi yang belum dibuka yang dapat diedit.',
    );
  }

  await updateDoc(sessionRef, {
    ...validInput,
    updatedAt: serverTimestamp(),
  });
}

// ==========================================
// MEMBUKA SESI
// ==========================================

export async function openSession(
  sessionId: string,
  note?: string,
) {
  const sessionRef = doc(db, 'sessions', sessionId);

  await runTransaction(db, async (transaction) => {
    const sessionSnapshot = await transaction.get(sessionRef);

    if (!sessionSnapshot.exists()) {
      throw new Error('Sesi tidak ditemukan.');
    }

    if (sessionSnapshot.data().status !== 'dijadwalkan') {
      throw new Error(
        'Hanya sesi yang belum dibuka yang dapat dimulai.',
      );
    }

    transaction.update(sessionRef, {
      status: 'dibuka',

      // Catatan diperbarui jika diberikan.
      // Jika tidak ada catatan, nilai sebelumnya tetap dipertahankan.
      ...(note !== undefined
        ? { sessionNote: note.trim() }
        : {}),

      openedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });
}

// ==========================================
// MENUTUP SESI
// ==========================================

export async function closeSession(
  sessionId: string,
) {
  const sessionRef = doc(db, 'sessions', sessionId);

  await runTransaction(db, async (transaction) => {
    const sessionSnapshot = await transaction.get(sessionRef);

    if (!sessionSnapshot.exists()) {
      throw new Error('Sesi tidak ditemukan.');
    }

    if (sessionSnapshot.data().status !== 'dibuka') {
      throw new Error(
        'Hanya sesi yang sedang berlangsung yang dapat ditutup.',
      );
    }

    transaction.update(sessionRef, {
      status: 'ditutup',
      closedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });
}

// ==========================================
// MENGHAPUS SESI
// Hanya sesi yang belum dibuka dan belum memiliki presensi
// ==========================================

export async function deleteSession(
  sessionId: string,
) {
  const sessionRef = doc(db, 'sessions', sessionId);

  const sessionSnapshot = await getDoc(sessionRef);

  if (!sessionSnapshot.exists()) {
    throw new Error('Sesi tidak ditemukan.');
  }

  if (sessionSnapshot.data().status !== 'dijadwalkan') {
    throw new Error(
      'Sesi yang sudah dibuka atau ditutup tidak dapat dihapus.',
    );
  }

  const attendanceSnapshot = await getDocs(
    collection(db, 'sessions', sessionId, 'attendance'),
  );

  if (!attendanceSnapshot.empty) {
    throw new Error(
      'Sesi yang sudah memiliki presensi tidak dapat dihapus.',
    );
  }

  await deleteDoc(sessionRef);
}