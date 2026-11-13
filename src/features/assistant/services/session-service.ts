
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
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';

import { db } from '@/lib/firebase';

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
  sessionNote: string;
}

// Mengambil semua sesi dari Firestore secara real-time.
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
      const sessions = snapshot.docs.map((item) => ({
        id: item.id,
        ...item.data(),
      })) as SessionRecord[];

      onData(sessions);
    },
    onError,
  );
}

// Membuat sesi berdasarkan jadwal yang dipilih.
export async function createSession(
  input: SessionInput,
  createdBy: string,
) {
  await addDoc(collection(db, 'sessions'), {
    ...input,
    status: 'dijadwalkan',
    createdBy,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

// Mengubah informasi sesi.
// Sesi yang sudah dibuka atau ditutup tidak dapat diedit.
export async function updateSession(
  sessionId: string,
  input: SessionInput,
) {
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

// Menghapus sesi yang belum memiliki aktivitas presensi.
export async function deleteSession(sessionId: string) {
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
      'Sesi yang sudah memiliki data presensi tidak dapat dihapus.',
    );
  }

  await deleteDoc(sessionRef);
}