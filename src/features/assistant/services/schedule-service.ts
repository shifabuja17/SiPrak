import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';

import { db } from '@/lib/firebase';
import { notifyScheduleChanged } from '@/features/notifications/services/notification-triggers';
import type { NotificationDispatchResult } from '@/features/notifications/types';
import { diffScheduleChanges } from '@/features/notifications/utils/schedule-diff';

export interface PracticumSchedule {
  id: string;
  classId: string;
  practicumName: string;
  /**
   * Data lama: modul kini milik tiap sesi (berbeda per pertemuan), bukan jadwal.
   * Field ini hanya ada pada dokumen jadwal yang dibuat sebelum perubahan tersebut.
   */
  moduleTitle?: string;
  classRoom: string;
  scheduleTime: string;
  createdBy: string;
}

export interface ScheduleInput {
  classId: string;
  practicumName: string;
  classRoom: string;
  scheduleTime: string;
}

// Mengambil daftar jadwal secara real-time.
export function subscribeSchedules(
  onData: (schedules: PracticumSchedule[]) => void,
  onError?: (error: Error) => void,
) {
  const schedulesQuery = query(
    collection(db, 'schedules'),
    orderBy('createdAt', 'desc'),
  );

  return onSnapshot(
    schedulesQuery,
    (snapshot) => {
      const schedules = snapshot.docs.map((item) => ({
        id: item.id,
        ...item.data(),
      })) as PracticumSchedule[];

      onData(schedules);
    },
    onError,
  );
}

// Menambahkan jadwal baru.
export async function createSchedule(
  input: ScheduleInput,
  createdBy: string,
) {
  await addDoc(collection(db, 'schedules'), {
    ...input,
    createdBy,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

// Mengubah jadwal.
export async function updateSchedule(
  scheduleId: string,
  input: ScheduleInput,
): Promise<NotificationDispatchResult | null> {
  const scheduleRef = doc(db, 'schedules', scheduleId);
  const beforeSnapshot = await getDoc(scheduleRef);
  const before = beforeSnapshot.exists() ? beforeSnapshot.data() : null;

  await updateDoc(scheduleRef, {
    ...input,
    updatedAt: serverTimestamp(),
  });

  // FR-20: beri tahu praktikan hanya jika ada perubahan yang berarti.
  if (!before) return null;

  const changes = diffScheduleChanges(before, input);
  if (changes.length === 0) return null;

  return notifyScheduleChanged({
    classIds: [
      typeof before.classId === 'string' ? before.classId : '',
      input.classId,
    ],
    practicumName: input.practicumName,
    changes,
    scheduleId,
  });
}

// Menghapus jadwal.
export async function deleteSchedule(scheduleId: string) {
  await deleteDoc(doc(db, 'schedules', scheduleId));
}