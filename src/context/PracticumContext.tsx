import type { Role } from '@/types/user';

import {
  createContext,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { useAuth } from '@/context/AuthContext';

// Menggunakan tipe role yang sama dengan Firebase Auth dan Firestore.
export type UserRole = Role;

export type SessionStatus = 'dijadwalkan' | 'dibuka' | 'ditutup';

export interface PracticumUser {
  uid: string;
  nama: string;
  nim: string | null;
  role: UserRole;
}

// Bentuk data tampilan presensi mengikuti field dokumen Firestore.
// Nilai waktu di sini sudah diformat untuk UI; saat disimpan ke Firestore
// gunakan serverTimestamp() agar sesuai dengan firestore.rules.
export interface AttendanceRecord {
  uid: string;
  nama: string;
  waktu: string;
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
  uid: '',
  nama: '',
  nim: null,
  role: 'praktikan',
};

const INITIAL_SESSIONS: PracticumSession[] = [
  {
    id: 'ses-101',
    practicumName: 'Praktikum Pemrograman Bergerak',
    moduleTitle: 'Modul 1: Pengenalan React Native & Flexbox',
    classRoom: 'Kelas A - Lab Komputasi Dasar',
    scheduleTime: 'Kamis, 08:00 - 10:30 WIB',
    status: 'dijadwalkan',
    sessionNote: '',
    attendances: [],
  },
  {
    id: 'ses-102',
    practicumName: 'Praktikum Struktur Data',
    moduleTitle: 'Modul 3: Stack & Queue',
    classRoom: 'Kelas B - Lab Algoritma',
    scheduleTime: 'Jumat, 13:00 - 15:30 WIB',
    status: 'dijadwalkan',
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
            uid: profile.uid,
            nama: profile.nama,
            nim: profile.nim,
            role: profile.role,
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
    if (currentUser.role !== 'asisten') {
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

    if (session.status !== 'dijadwalkan') {
      throw new Error('Sesi ini tidak dapat dibuka lagi.');
    }

    setSessions((previousSessions) =>
      previousSessions.map((item) =>
        item.id === sessionId
          ? {
              ...item,
              status: 'dibuka',
              sessionNote: note.trim(),
            }
          : item,
      ),
    );
  }

  function closeSession(sessionId: string): void {
    if (currentUser.role !== 'asisten') {
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

    if (session.status !== 'dibuka') {
      throw new Error(
        'Hanya sesi yang sedang berlangsung yang dapat ditutup.',
      );
    }

    setSessions((previousSessions) =>
      previousSessions.map((item) =>
        item.id === sessionId
          ? { ...item, status: 'ditutup' }
          : item,
      ),
    );
  }

  function submitAttendance(
    sessionId: string,
    user: PracticumUser,
  ): void {
    if (currentUser.role !== 'praktikan') {
      throw new Error(
        'Hanya Praktikan yang dapat melakukan presensi.',
      );
    }

    if (
      user.uid !== currentUser.uid ||
      user.role !== 'praktikan'
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

    if (session.status !== 'dibuka') {
      throw new Error(
        'Presensi hanya dapat dilakukan saat sesi berlangsung.',
      );
    }

    const duplicateKey = `${sessionId}:${currentUser.uid}`;

    const alreadyAttended = session.attendances.some(
      (attendance) =>
        attendance.uid === currentUser.uid,
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
      uid: currentUser.uid,
      nama: currentUser.nama,
      waktu: getTimestampWIB(),
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