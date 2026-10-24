
import {
  createContext,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from 'react';

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

const INITIAL_USERS: PracticumUser[] = [
  {
    id: 'ast-1',
    name: 'Budi Santoso',
    nim: '24060121130045',
    role: 'ASISTEN',
  },
  {
    id: 'prk-1',
    name: 'Andi Pratama',
    nim: '24060123120001',
    role: 'PRAKTIKAN',
  },
  {
    id: 'prk-2',
    name: 'Siti Aminah',
    nim: '24060123120002',
    role: 'PRAKTIKAN',
  },
  {
    id: 'prk-3',
    name: 'Rizky Ramadhan',
    nim: '24060123120003',
    role: 'PRAKTIKAN',
  },
];

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
  users: PracticumUser[];
  currentUser: PracticumUser;
  sessions: PracticumSession[];

  switchUser: (userId: string) => void;
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
  const [currentUser, setCurrentUser] =
    useState<PracticumUser>(INITIAL_USERS[0]);

  const [sessions, setSessions] =
    useState<PracticumSession[]>(INITIAL_SESSIONS);

  const submittedAttendanceKeys = useRef<Set<string>>(
    new Set(),
  );

  function switchUser(userId: string): void {
    const selectedUser = INITIAL_USERS.find(
      (user) => user.id === userId,
    );

    if (!selectedUser) {
      throw new Error('Akun yang dipilih tidak ditemukan.');
    }

    setCurrentUser(selectedUser);
  }

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
    users: INITIAL_USERS,
    currentUser,
    sessions,
    switchUser,
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