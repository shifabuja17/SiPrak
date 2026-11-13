import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';

import { db } from '@/lib/firebase';

export interface PracticumSchedule {
  id: string;
  classId: string;
  practicumName: string;
  moduleTitle: string;
  classRoom: string;
  scheduleTime: string;
  createdBy: string;
}

export interface ScheduleInput {
  classId: string;
  practicumName: string;
  moduleTitle: string;
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
) {
  await updateDoc(doc(db, 'schedules', scheduleId), {
    ...input,
    updatedAt: serverTimestamp(),
  });
}

// Menghapus jadwal.
export async function deleteSchedule(scheduleId: string) {
  await deleteDoc(doc(db, 'schedules', scheduleId));
}