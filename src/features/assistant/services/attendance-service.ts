import {
  collection,
  onSnapshot,
} from 'firebase/firestore';

import { db } from '@/lib/firebase';

export interface SessionAttendanceRecap {
  uid: string;
  nama: string;
  nim: string | null;
  hadir: boolean;
  waktu: string | null;
}

interface ClassMemberData {
  uid: string;
  nama: string;
  nim: string | null;
}

interface AttendanceData {
  uid: string;
  nama: string;
  waktu: unknown;
}

interface TimestampLike {
  toDate: () => Date;
}

function isTimestamp(value: unknown): value is TimestampLike {
  return (
    typeof value === 'object' &&
    value !== null &&
    'toDate' in value &&
    typeof value.toDate === 'function'
  );
}

// Mengubah timestamp Firestore menjadi jam WIB.
function formatAttendanceTime(value: unknown): string | null {
  if (!value) return null;

  if (typeof value === 'string') {
    return value;
  }

  let date: Date | null = null;

  if (isTimestamp(value)) {
    date = value.toDate();
  } else if (value instanceof Date) {
    date = value;
  }

  if (!date || Number.isNaN(date.getTime())) {
    return null;
  }

  return (
    date.toLocaleTimeString('id-ID', {
      timeZone: 'Asia/Jakarta',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }) + ' WIB'
  );
}

// Menggabungkan daftar peserta kelas dengan data presensi sesi.
export function subscribeSessionAttendance(
  sessionId: string,
  classId: string,
  onData: (records: SessionAttendanceRecap[]) => void,
  onError: (error: Error) => void,
) {
  let members: ClassMemberData[] | null = null;
  let attendances: AttendanceData[] | null = null;

  function emitRecap() {
    if (members === null || attendances === null) {
      return;
    }

    const attendanceMap = new Map(
      attendances.map((item) => [item.uid, item]),
    );

    const recap: SessionAttendanceRecap[] = members.map(
      (member) => {
        const attendance = attendanceMap.get(member.uid);

        return {
          uid: member.uid,
          nama: member.nama,
          nim: member.nim,
          hadir: !!attendance,
          waktu: attendance
            ? formatAttendanceTime(attendance.waktu)
            : null,
        };
      },
    );

    onData(recap);
  }

  // Mendengarkan perubahan daftar peserta kelas.
  const unsubscribeMembers = onSnapshot(
    collection(db, 'classes', classId, 'members'),
    (snapshot) => {
      members = snapshot.docs.map((item) => {
        const data = item.data();

        return {
          uid: String(data.uid ?? item.id),
          nama: String(data.nama ?? 'Tanpa Nama'),
          nim: data.nim ? String(data.nim) : null,
        };
      });

      emitRecap();
    },
    onError,
  );

  // Mendengarkan perubahan presensi sesi.
  const unsubscribeAttendances = onSnapshot(
    collection(db, 'sessions', sessionId, 'attendance'),
    (snapshot) => {
      attendances = snapshot.docs.map((item) => {
        const data = item.data();

        return {
          uid: String(data.uid ?? item.id),
          nama: String(data.nama ?? 'Tanpa Nama'),
          waktu: data.waktu,
        };
      });

      emitRecap();
    },
    onError,
  );

  // Menghentikan kedua listener ketika tidak digunakan.
  return () => {
    unsubscribeMembers();
    unsubscribeAttendances();
  };
}