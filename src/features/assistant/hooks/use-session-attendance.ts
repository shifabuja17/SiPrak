import { useEffect, useState } from 'react';

import {
  subscribeSessionAttendance,
  type SessionAttendanceRecap,
} from '@/features/assistant/services/attendance-service';
import { subscribeLeaveRequests } from '@/features/assistant/services/leave-service';

export type AttendanceStatus = 'hadir' | 'izin' | 'tidak_hadir';

/** Hadir bila sudah presensi; Izin bila belum presensi tetapi izinnya diterima. */
export function attendanceStatus(
  record: SessionAttendanceRecap,
  excusedUids: ReadonlySet<string>,
): AttendanceStatus {
  if (record.hadir) return 'hadir';
  if (excusedUids.has(record.uid)) return 'izin';
  return 'tidak_hadir';
}

/** Daftar peserta kelas beserta status presensinya pada satu sesi (real-time). */
export function useSessionAttendance(sessionId: string, classId: string | undefined) {
  const [records, setRecords] = useState<SessionAttendanceRecap[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!classId) {
      setRecords([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    return subscribeSessionAttendance(
      sessionId,
      classId,
      (data) => {
        setRecords(data);
        setLoading(false);
      },
      (firebaseError) => {
        console.error('Gagal mengambil rekap presensi:', firebaseError);
        setError('Rekap kehadiran tidak dapat dimuat.');
        setLoading(false);
      },
    );
  }, [sessionId, classId]);

  return { records, loading, error };
}

/** uid praktikan yang pengajuan izinnya diterima, dikelompokkan per sesi (real-time). */
export function useExcusedBySession(enabled: boolean): Map<string, Set<string>> {
  const [map, setMap] = useState<Map<string, Set<string>>>(() => new Map());

  useEffect(() => {
    if (!enabled) return;

    return subscribeLeaveRequests(
      (requests) => {
        const next = new Map<string, Set<string>>();
        for (const request of requests) {
          if (request.status !== 'diterima' || !request.sessionId) continue;
          const uids = next.get(request.sessionId) ?? new Set<string>();
          uids.add(request.uid);
          next.set(request.sessionId, uids);
        }
        setMap(next);
      },
      () => setMap(new Map()),
    );
  }, [enabled]);

  return map;
}

/** Set kosong bersama untuk sesi tanpa izin yang diterima. */
export const NO_EXCUSED: ReadonlySet<string> = new Set();
