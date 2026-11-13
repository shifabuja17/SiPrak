import {
  collection,
  doc,
  onSnapshot,
  type DocumentData,
  type Unsubscribe,
} from 'firebase/firestore';

import { authErrorMessage } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import type {
  FirestoreSessionStatus,
  PraktikanClass,
  PraktikanSchedule,
  PraktikanSession,
} from '@/features/praktikan/types';

/**
 * Asumsi relasi koleksi Firestore antara modul P2 (Asisten) dan P3 (Praktikan):
 * 1. `classes/{classId}` + subkoleksi `classes/{classId}/members/{uid}`:
 *    Menentukan daftar kelas yang diikuti Praktikan aktif. Keanggotaan dicek per dokumen
 *    `classes/{classId}/members/{uid}` (tidak memakai `collectionGroup('members')` karena
 *    `firestore.rules` tidak mendefinisikan recursive wildcard rule untuk `members`).
 *    Jika sebuah kelas belum memiliki dokumen `members/{uid}`, kelas tersebut dianggap
 *    tidak diikuti Praktikan (tanpa fallback palsu menampilkan semua kelas/sesi).
 * 2. `schedules/{scheduleId}`:
 *    Memiliki field `classId` yang merujuk ke `classes/{classId}`.
 * 3. `sessions/{sessionId}`:
 *    Memiliki `status` (`'dijadwalkan' | 'dibuka' | 'ditutup'`) serta `classId` dan/atau
 *    `scheduleId`. Jika `classId` tidak ditulis langsung di dokumen sesi, `classId`
 *    diselesaikan melalui `schedules/{scheduleId}.classId`.
 */
export interface PraktikanSessionsPayload {
  classes: PraktikanClass[];
  schedules: PraktikanSchedule[];
  sessions: PraktikanSession[];
  totalClassCount: number;
}

interface RawScheduleEntry {
  id: string;
  data: DocumentData;
  schedule: PraktikanSchedule;
}

interface RawSessionEntry {
  id: string;
  data: DocumentData;
}

interface MemberCheckState {
  loaded: boolean;
  isMember: boolean;
}

const VALID_SESSION_STATUSES = new Set<FirestoreSessionStatus>([
  'dijadwalkan',
  'dibuka',
  'ditutup',
]);

const STATUS_SORT_ORDER: Record<FirestoreSessionStatus, number> = {
  dibuka: 0,
  dijadwalkan: 1,
  ditutup: 2,
};

/**
 * Mengubah error Firestore/Firebase menjadi `Error` dengan pesan yang rapi untuk UI.
 */
export function mapPraktikanFirestoreError(error: unknown): Error {
  const code = (error as { code?: string })?.code;
  switch (code) {
    case 'unauthenticated':
    case 'firestore/unauthenticated':
      return new Error('Sesi autentikasi berakhir. Silakan login kembali.');
    case 'not-found':
    case 'firestore/not-found':
      return new Error('Data praktikum atau sesi tidak ditemukan.');
    case 'failed-precondition':
    case 'firestore/failed-precondition':
      return new Error('Prasyarat atau indeks Firestore belum tersedia.');
    case 'deadline-exceeded':
    case 'firestore/deadline-exceeded':
      return new Error('Koneksi ke server melebihi batas waktu. Periksa internet kamu.');
    case 'resource-exhausted':
    case 'firestore/resource-exhausted':
      return new Error('Layanan sedang sibuk. Coba lagi beberapa saat.');
    default:
      return new Error(authErrorMessage(error));
  }
}

function readString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
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
  if (typeof value === 'number' || typeof value === 'string') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

function parseSessionStatus(value: unknown, sessionId: string): FirestoreSessionStatus {
  if (
    typeof value === 'string' &&
    VALID_SESSION_STATUSES.has(value as FirestoreSessionStatus)
  ) {
    return value as FirestoreSessionStatus;
  }
  throw new Error(
    `Status sesi "${sessionId}" tidak valid atau belum diatur (${String(value)}).`,
  );
}

function mapClassDoc(id: string, data: DocumentData): PraktikanClass {
  return {
    id,
    practicumName: readString(data.practicumName),
    className: readString(data.className),
    name: readString(data.name),
    code: readString(data.code),
    classRoom: readString(data.classRoom),
    room: readString(data.room),
    description: readString(data.description),
    createdAt: toDateOrNull(data.createdAt),
  };
}

function mapScheduleDoc(id: string, data: DocumentData): PraktikanSchedule {
  return {
    id,
    classId: readString(data.classId),
    practicumName: readString(data.practicumName),
    className: readString(data.className),
    classRoom: readString(data.classRoom),
    room: readString(data.room),
    scheduleTime: readString(data.scheduleTime),
    dayTime: readString(data.dayTime),
    day: readString(data.day),
    time: readString(data.time),
    createdAt: toDateOrNull(data.createdAt),
  };
}

function resolveScheduleTimeFromSchedule(
  schedule?: PraktikanSchedule,
): string | undefined {
  if (!schedule) return undefined;
  if (schedule.scheduleTime) return schedule.scheduleTime;
  if (schedule.dayTime) return schedule.dayTime;
  if (schedule.day && schedule.time) return `${schedule.day}, ${schedule.time}`;
  return schedule.day ?? schedule.time;
}

function mapSessionDoc(
  id: string,
  data: DocumentData,
  context: {
    schedule?: PraktikanSchedule;
    classDoc?: PraktikanClass;
  },
): PraktikanSession {
  const status = parseSessionStatus(data.status, id);
  const classId = readString(data.classId) ?? context.schedule?.classId;
  const scheduleId = readString(data.scheduleId);
  const className =
    readString(data.className) ??
    context.schedule?.className ??
    context.classDoc?.className ??
    context.classDoc?.name;
  const topic = readString(data.topic);
  const room =
    readString(data.room) ??
    context.schedule?.room ??
    context.classDoc?.room;
  const dayTime =
    readString(data.dayTime) ??
    context.schedule?.dayTime;

  const practicumName =
    readString(data.practicumName) ??
    className ??
    context.schedule?.practicumName ??
    context.classDoc?.practicumName ??
    '-';

  const moduleTitle =
    readString(data.moduleTitle) ??
    topic ??
    readString(data.title) ??
    '-';

  const classRoom =
    readString(data.classRoom) ??
    room ??
    context.schedule?.classRoom ??
    context.classDoc?.classRoom ??
    '-';

  const scheduleTime =
    readString(data.scheduleTime) ??
    dayTime ??
    resolveScheduleTimeFromSchedule(context.schedule) ??
    '-';

  const sessionNote =
    readString(data.sessionNote) ??
    readString(data.note) ??
    '';

  return {
    id,
    classId,
    scheduleId,
    practicumName,
    className,
    moduleTitle,
    topic,
    classRoom,
    room,
    scheduleTime,
    dayTime,
    status,
    sessionNote,
    createdAt: toDateOrNull(data.createdAt),
    openedAt: toDateOrNull(data.openedAt),
    closedAt: toDateOrNull(data.closedAt),
  };
}

function sortSessions(sessions: PraktikanSession[]): PraktikanSession[] {
  return [...sessions].sort((a, b) => {
    const statusDiff = STATUS_SORT_ORDER[a.status] - STATUS_SORT_ORDER[b.status];
    if (statusDiff !== 0) return statusDiff;

    const aTime = a.createdAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
    const bTime = b.createdAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
    if (aTime !== bTime) return aTime - bTime;

    return a.practicumName.localeCompare(b.practicumName, 'id');
  });
}

/**
 * Subscribe real-time ke kelas yang diikuti Praktikan (`classes/{classId}/members/{uid}`),
 * jadwal terkait (`schedules`), dan sesi praktikum terkait (`sessions`).
 */
export function subscribePraktikanSessions(
  uid: string,
  onData: (payload: PraktikanSessionsPayload) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  const trimmedUid = uid.trim();
  if (!trimmedUid) {
    throw new Error('UID Praktikan wajib diisi untuk membaca sesi.');
  }

  let active = true;
  let failed = false;
  let classesLoaded = false;
  let schedulesLoaded = false;
  let sessionsLoaded = false;

  const classesById = new Map<string, PraktikanClass>();
  const memberStateByClass = new Map<string, MemberCheckState>();
  const memberUnsubByClass = new Map<string, Unsubscribe>();
  const schedulesById = new Map<string, RawScheduleEntry>();
  const sessionsById = new Map<string, RawSessionEntry>();

  let classesUnsub: Unsubscribe | null = null;
  let schedulesUnsub: Unsubscribe | null = null;
  let sessionsUnsub: Unsubscribe | null = null;

  const cleanupAll = () => {
    active = false;
    classesUnsub?.();
    schedulesUnsub?.();
    sessionsUnsub?.();
    for (const unsub of memberUnsubByClass.values()) {
      unsub();
    }
    memberUnsubByClass.clear();
  };

  const emitIfReady = () => {
    if (!active || failed || !classesLoaded || !schedulesLoaded || !sessionsLoaded) return;

    for (const classId of classesById.keys()) {
      if (!memberStateByClass.get(classId)?.loaded) {
        return;
      }
    }

    try {
      const enrolledClassIds = new Set<string>();
      const enrolledClasses: PraktikanClass[] = [];

      for (const [classId, classDoc] of classesById.entries()) {
        if (memberStateByClass.get(classId)?.isMember) {
          enrolledClassIds.add(classId);
          enrolledClasses.push(classDoc);
        }
      }

      const enrolledSchedules: PraktikanSchedule[] = [];
      for (const entry of schedulesById.values()) {
        if (entry.schedule.classId && enrolledClassIds.has(entry.schedule.classId)) {
          enrolledSchedules.push(entry.schedule);
        }
      }

      const enrolledSessions: PraktikanSession[] = [];
      for (const entry of sessionsById.values()) {
        const directClassId = readString(entry.data.classId);
        const scheduleId = readString(entry.data.scheduleId);
        const scheduleEntry = scheduleId ? schedulesById.get(scheduleId) : undefined;
        const resolvedClassId = directClassId ?? scheduleEntry?.schedule.classId;

        if (!resolvedClassId || !enrolledClassIds.has(resolvedClassId)) {
          continue;
        }

        enrolledSessions.push(
          mapSessionDoc(entry.id, entry.data, {
            schedule: scheduleEntry?.schedule,
            classDoc: classesById.get(resolvedClassId),
          }),
        );
      }

      onData({
        classes: enrolledClasses,
        schedules: enrolledSchedules,
        sessions: sortSessions(enrolledSessions),
        totalClassCount: classesById.size,
      });
    } catch (err) {
      onError(mapPraktikanFirestoreError(err));
    }
  };

  const handleListenerError = (err: unknown) => {
    if (!active || failed) return;
    failed = true;
    // Hentikan listener lain agar snapshot parsial tidak menimpa error terminal ini.
    cleanupAll();
    onError(mapPraktikanFirestoreError(err));
  };

  const syncMemberListeners = (nextClassIds: Set<string>) => {
    for (const [classId, unsub] of memberUnsubByClass.entries()) {
      if (!nextClassIds.has(classId)) {
        unsub();
        memberUnsubByClass.delete(classId);
        memberStateByClass.delete(classId);
      }
    }

    for (const classId of nextClassIds) {
      if (memberUnsubByClass.has(classId)) continue;

      memberStateByClass.set(classId, { loaded: false, isMember: false });
      const memberRef = doc(db, 'classes', classId, 'members', trimmedUid);
      const unsub = onSnapshot(
        memberRef,
        (snap) => {
          if (!active || failed) return;
          memberStateByClass.set(classId, {
            loaded: true,
            isMember: snap.exists(),
          });
          emitIfReady();
        },
        handleListenerError,
      );
      memberUnsubByClass.set(classId, unsub);
    }
  };

  classesUnsub = onSnapshot(
    collection(db, 'classes'),
    (snapshot) => {
      if (!active || failed) return;

      const nextClassIds = new Set<string>();
      classesById.clear();

      for (const docSnap of snapshot.docs) {
        nextClassIds.add(docSnap.id);
        classesById.set(docSnap.id, mapClassDoc(docSnap.id, docSnap.data()));
      }

      classesLoaded = true;
      syncMemberListeners(nextClassIds);
      emitIfReady();
    },
    handleListenerError,
  );

  schedulesUnsub = onSnapshot(
    collection(db, 'schedules'),
    (snapshot) => {
      if (!active || failed) return;

      schedulesById.clear();
      for (const docSnap of snapshot.docs) {
        const data = docSnap.data();
        schedulesById.set(docSnap.id, {
          id: docSnap.id,
          data,
          schedule: mapScheduleDoc(docSnap.id, data),
        });
      }

      schedulesLoaded = true;
      emitIfReady();
    },
    handleListenerError,
  );

  sessionsUnsub = onSnapshot(
    collection(db, 'sessions'),
    (snapshot) => {
      if (!active || failed) return;

      sessionsById.clear();
      for (const docSnap of snapshot.docs) {
        sessionsById.set(docSnap.id, {
          id: docSnap.id,
          data: docSnap.data(),
        });
      }

      sessionsLoaded = true;
      emitIfReady();
    },
    handleListenerError,
  );

  return cleanupAll;
}

/**
 * Subscribe real-time ke satu dokumen sesi (`sessions/{sessionId}`) beserta
 * referensi jadwal dan kelas terkait agar perubahan status dari Asisten terlihat
 * langsung tanpa restart aplikasi.
 */
export function subscribeSessionById(
  sessionId: string,
  onData: (session: PraktikanSession | null) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  const trimmedId = sessionId.trim();
  if (!trimmedId) {
    throw new Error('ID sesi wajib diisi.');
  }

  let active = true;
  let failed = false;
  let sessionLoaded = false;
  let rawSession: RawSessionEntry | null = null;

  let subscribedScheduleId: string | null = null;
  let scheduleLoaded = true;
  let scheduleDoc: PraktikanSchedule | undefined;
  let scheduleUnsub: Unsubscribe | null = null;

  let subscribedClassId: string | null = null;
  let classLoaded = true;
  let classDoc: PraktikanClass | undefined;
  let classUnsub: Unsubscribe | null = null;

  let sessionUnsub: Unsubscribe | null = null;

  const cleanupAll = () => {
    active = false;
    sessionUnsub?.();
    scheduleUnsub?.();
    classUnsub?.();
  };

  const emitIfReady = () => {
    if (!active || failed || !sessionLoaded || !scheduleLoaded || !classLoaded) return;
    if (!rawSession) {
      onData(null);
      return;
    }

    try {
      onData(
        mapSessionDoc(rawSession.id, rawSession.data, {
          schedule: scheduleDoc,
          classDoc,
        }),
      );
    } catch (err) {
      onError(mapPraktikanFirestoreError(err));
    }
  };

  const handleListenerError = (err: unknown) => {
    if (!active || failed) return;
    failed = true;
    cleanupAll();
    onError(mapPraktikanFirestoreError(err));
  };

  const resolveClassId = (): string | null => {
    if (!rawSession) return null;
    return readString(rawSession.data.classId) ?? scheduleDoc?.classId ?? null;
  };

  const syncClassListener = (nextClassId: string | null) => {
    if (nextClassId === subscribedClassId) return;

    classUnsub?.();
    classUnsub = null;
    subscribedClassId = nextClassId;
    classDoc = undefined;

    if (!nextClassId) {
      classLoaded = true;
      return;
    }

    classLoaded = false;
    classUnsub = onSnapshot(
      doc(db, 'classes', nextClassId),
      (snap) => {
        if (!active || failed) return;
        classLoaded = true;
        classDoc = snap.exists() ? mapClassDoc(snap.id, snap.data()) : undefined;
        emitIfReady();
      },
      handleListenerError,
    );
  };

  const syncScheduleListener = (nextScheduleId: string | null) => {
    if (nextScheduleId === subscribedScheduleId) return;

    scheduleUnsub?.();
    scheduleUnsub = null;
    subscribedScheduleId = nextScheduleId;
    scheduleDoc = undefined;

    if (!nextScheduleId) {
      scheduleLoaded = true;
      return;
    }

    scheduleLoaded = false;
    scheduleUnsub = onSnapshot(
      doc(db, 'schedules', nextScheduleId),
      (snap) => {
        if (!active || failed) return;
        scheduleLoaded = true;
        scheduleDoc = snap.exists() ? mapScheduleDoc(snap.id, snap.data()) : undefined;
        syncClassListener(resolveClassId());
        emitIfReady();
      },
      handleListenerError,
    );
  };

  sessionUnsub = onSnapshot(
    doc(db, 'sessions', trimmedId),
    (snap) => {
      if (!active || failed) return;
      sessionLoaded = true;

      if (!snap.exists()) {
        rawSession = null;
        syncScheduleListener(null);
        syncClassListener(null);
        emitIfReady();
        return;
      }

      rawSession = { id: snap.id, data: snap.data() };
      const nextScheduleId = readString(rawSession.data.scheduleId) ?? null;
      syncScheduleListener(nextScheduleId);
      syncClassListener(resolveClassId());
      emitIfReady();
    },
    handleListenerError,
  );

  return cleanupAll;
}
