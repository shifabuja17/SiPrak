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
} from '@/features/assistant/services/laboratory-service';
import { db } from '@/lib/firebase';
import {
  notifyScheduleChanged,
  notifySessionOpened,
} from '@/features/notifications/services/notification-triggers';
import type { NotificationDispatchResult } from '@/features/notifications/types';
import { diffSessionChanges } from '@/features/notifications/utils/schedule-diff';
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
  labId?: string;
  labName?: string;
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
  labId: string;
  labName: string;
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
    waktuMulai: toDateValue(data.waktuMulai),
    waktuSelesai: toDateValue(data.waktuSelesai),
    status: data.status as SessionStatus,
    sessionNote: typeof data.sessionNote === 'string' ? data.sessionNote : '',
    createdBy: readOptionalText(data.createdBy) ?? '',
  };
}

function validateSessionLabInput(input: SessionInput): SessionInput {
  if (typeof input.labId !== 'string' || input.labId.trim().length === 0) {
    throw new Error('Pilih lokasi laboratorium yang valid.');
  }

  // Modul milik tiap sesi (berbeda per pertemuan), bukan disalin dari jadwal.
  if (!input.moduleTitle.trim()) {
    throw new Error('Modul atau materi pertemuan wajib diisi.');
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
  validateSessionTimes(input);
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
): Promise<NotificationDispatchResult | null> {
  validateSessionTimes(input);
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

  const before = sessionSnapshot.data();

  await updateDoc(sessionRef, {
    ...validInput,
    updatedAt: serverTimestamp(),
  });

  // FR-20: beri tahu praktikan hanya jika waktu/lokasi/materi benar-benar berubah.
  const changes = diffSessionChanges(before, validInput);
  if (changes.length === 0) return null;

  return notifyScheduleChanged({
    classIds: [
      typeof before.classId === 'string' ? before.classId : '',
      validInput.classId,
    ],
    practicumName: validInput.practicumName,
    changes,
    sessionId,
  });
}

// ==========================================
// MEMBUKA SESI
// ==========================================

export async function openSession(
  sessionId: string,
  note?: string,
): Promise<NotificationDispatchResult> {
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

  // FR-19: sesi sudah tersimpan sebagai 'dibuka'; kegagalan notifikasi tidak membatalkannya.
  return notifySessionOpened(sessionId);
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