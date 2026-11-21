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
} from 'firebase/firestore';

import { db } from '@/lib/firebase';
import { toDateValue } from '@/utils/session-time';

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
  practicumName: string;
  moduleTitle: string;
  classRoom: string;
  scheduleTime: string;
  /** Tanggal + jam mulai pertemuan; null untuk sesi lama yang belum punya. */
  waktuMulai: Date | null;
  waktuSelesai: Date | null;
  status: SessionStatus;
  sessionNote: string;
  createdBy: string;
}

export interface SessionInput {
  scheduleId: string;
  classId: string;
  practicumName: string;
  moduleTitle: string;
  classRoom: string;
  scheduleTime: string;
  waktuMulai: Date;
  waktuSelesai: Date;
  sessionNote: string;
}

/** Memastikan rentang waktu sesi valid sebelum disimpan. */
function validateSessionTimes(input: SessionInput) {
  if (
    Number.isNaN(input.waktuMulai.getTime()) ||
    Number.isNaN(input.waktuSelesai.getTime())
  ) {
    throw new Error('Tanggal dan jam sesi wajib diisi.');
  }
  if (input.waktuSelesai <= input.waktuMulai) {
    throw new Error('Jam selesai harus setelah jam mulai.');
  }
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
      const sessions = snapshot.docs.map((item) => {
        const data = item.data();
        return {
          ...data,
          id: item.id,
          waktuMulai: toDateValue(data.waktuMulai),
          waktuSelesai: toDateValue(data.waktuSelesai),
        };
      }) as SessionRecord[];

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
  validateSessionTimes(input);

  await addDoc(collection(db, 'sessions'), {
    ...input,
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
  validateSessionTimes(input);

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
    ...input,
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