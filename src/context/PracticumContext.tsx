import {
  createContext,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { useAuth } from '@/context/AuthContext';

export type UserRole = 'ASISTEN' | 'PRAKTIKAN';

export type SessionStatus = 'UPCOMING' | 'OPEN' | 'CLOSED';

export interface PracticumUser {
  id: string;
  name: string;
  nim: string;
  role: UserRole;
}

export interface AttendanceRecord {
  userId: string;
  name: string;
  nim: string;
  timestamp: string;
  note: string;
}

export interface PracticumSession {
  id: string;
  practicumName: string;
  moduleTitle: string;
  classRoom: string;
  scheduleTime: string;
  status: SessionStatus;
  sessionNote: string;
  attendances: AttendanceRecord[];
}

// Placeholder hanya agar `currentUser` tidak pernah null. Layar aplikasi
// dilindungi guard login (lihat app/_layout.tsx), jadi nilai ini tidak tampil.
const SIGNED_OUT_USER: PracticumUser = {
  id: '',
  name: '',
  nim: '',
  role: 'PRAKTIKAN',
};

const INITIAL_SESSIONS: PracticumSession[] = [
  {
    id: 'ses-101',
    practicumName: 'Praktikum Pemrograman Bergerak',
    moduleTitle: 'Modul 1: Pengenalan React Native & Flexbox',
    classRoom: 'Kelas A - Lab Komputasi Dasar',
    scheduleTime: 'Kamis, 08:00 - 10:30 WIB',
    status: 'UPCOMING',
    sessionNote: '',
    attendances: [],
  },
  {
    id: 'ses-102',
    practicumName: 'Praktikum Struktur Data',
    moduleTitle: 'Modul 3: Stack & Queue',
    classRoom: 'Kelas B - Lab Algoritma',
    scheduleTime: 'Jumat, 13:00 - 15:30 WIB',
    status: 'UPCOMING',
    sessionNote: '',
    attendances: [],
  },
];

interface PracticumContextValue {
  currentUser: PracticumUser;
  sessions: PracticumSession[];

  openSession: (sessionId: string, note: string) => void;
  closeSession: (sessionId: string) => void;
  submitAttendance: (
    sessionId: string,
    user: PracticumUser,
    note: string,
  ) => void;
}

const PracticumContext =
  createContext<PracticumContextValue | undefined>(undefined);

interface PracticumProviderProps {
  children: ReactNode;
}

function getTimestampWIB(): string {
  return (
    new Date().toLocaleTimeString('id-ID', {
      timeZone: 'Asia/Jakarta',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }) + ' WIB'
  );
}

export function PracticumProvider({
  children,
}: PracticumProviderProps) {
  // Identitas & peran berasal dari akun Firebase Authentication (users/{uid}),
  // bukan lagi dari daftar akun dummy.
  const { profile } = useAuth();

  const currentUser = useMemo<PracticumUser>(
    () =>
      profile
        ? {
            id: profile.uid,
            name: profile.nama,
            nim: profile.nim ?? '-',
            role: profile.role === 'asisten' ? 'ASISTEN' : 'PRAKTIKAN',
          }
        : SIGNED_OUT_USER,
    [profile],
  );

  const [sessions, setSessions] =
    useState<PracticumSession[]>(INITIAL_SESSIONS);

  const submittedAttendanceKeys = useRef<Set<string>>(
    new Set(),
  );

  function openSession(
    sessionId: string,
    note: string,
  ): void {
    if (currentUser.role !== 'ASISTEN') {
      throw new Error(
        'Hanya Asisten yang dapat membuka sesi.',
      );
    }

    const session = sessions.find(
      (item) => item.id === sessionId,
    );

    if (!session) {
      throw new Error('Sesi praktikum tidak ditemukan.');
    }

    if (session.status !== 'UPCOMING') {
      throw new Error('Sesi ini tidak dapat dibuka lagi.');
    }

    setSessions((previousSessions) =>
      previousSessions.map((item) =>
        item.id === sessionId
          ? {
              ...item,
              status: 'OPEN',
              sessionNote: note.trim(),
            }
          : item,
      ),
    );
  }

  function closeSession(sessionId: string): void {
    if (currentUser.role !== 'ASISTEN') {
      throw new Error(
        'Hanya Asisten yang dapat menutup sesi.',
      );
    }

    const session = sessions.find(
      (item) => item.id === sessionId,
    );

    if (!session) {
      throw new Error('Sesi praktikum tidak ditemukan.');
    }

    if (session.status !== 'OPEN') {
      throw new Error(
        'Hanya sesi yang sedang berlangsung yang dapat ditutup.',
      );
    }

    setSessions((previousSessions) =>
      previousSessions.map((item) =>
        item.id === sessionId
          ? { ...item, status: 'CLOSED' }
          : item,
      ),
    );
  }

  function submitAttendance(
    sessionId: string,
    user: PracticumUser,
    note: string,
  ): void {
    if (currentUser.role !== 'PRAKTIKAN') {
      throw new Error(
        'Hanya Praktikan yang dapat melakukan presensi.',
      );
    }

    if (
      user.id !== currentUser.id ||
      user.role !== 'PRAKTIKAN'
    ) {
      throw new Error(
        'Identitas praktikan tidak sesuai dengan akun aktif.',
      );
    }

    const session = sessions.find(
      (item) => item.id === sessionId,
    );

    if (!session) {
      throw new Error('Sesi praktikum tidak ditemukan.');
    }

    if (session.status !== 'OPEN') {
      throw new Error(
        'Presensi hanya dapat dilakukan saat sesi berlangsung.',
      );
    }

    const duplicateKey = `${sessionId}:${currentUser.id}`;

    const alreadyAttended = session.attendances.some(
      (attendance) =>
        attendance.userId === currentUser.id,
    );

    if (
      alreadyAttended ||
      submittedAttendanceKeys.current.has(duplicateKey)
    ) {
      throw new Error(
        'Kamu sudah melakukan presensi pada sesi ini.',
      );
    }

    const newAttendance: AttendanceRecord = {
      userId: currentUser.id,
      name: currentUser.name,
      nim: currentUser.nim,
      timestamp: getTimestampWIB(),
      note: note.trim(),
    };

    submittedAttendanceKeys.current.add(duplicateKey);

    setSessions((previousSessions) =>
      previousSessions.map((item) =>
        item.id === sessionId
          ? {
              ...item,
              attendances: [
                ...item.attendances,
                newAttendance,
              ],
            }
          : item,
      ),
    );
  }

  const value: PracticumContextValue = {
    currentUser,
    sessions,
    openSession,
    closeSession,
    submitAttendance,
  };

  return (
    <PracticumContext.Provider value={value}>
      {children}
    </PracticumContext.Provider>
  );
}

export function usePracticum(): PracticumContextValue {
  const context = useContext(PracticumContext);

  if (!context) {
    throw new Error(
      'usePracticum harus digunakan di dalam PracticumProvider.',
    );
  }

  return context;
}