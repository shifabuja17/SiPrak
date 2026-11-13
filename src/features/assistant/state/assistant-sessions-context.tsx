import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import type {
  AttendanceRecord,
  PracticumSession,
} from '../types';

import {
  subscribeSessions,
  openSession as openFirebaseSession,
  closeSession as closeFirebaseSession,
  type SessionRecord,
} from '../services/session-service';

import {
  subscribeSessionAttendance,
  type SessionAttendanceRecap,
} from '../services/attendance-service';

// ==========================================
// TIPE CONTEXT
// ==========================================

type AssistantSessionsContextValue = {
  sessions: PracticumSession[];

  openSession: (
    sessionId: string,
    note?: string,
  ) => Promise<void>;

  closeSession: (
    sessionId: string,
  ) => Promise<void>;
};

const AssistantSessionsContext =
  createContext<AssistantSessionsContextValue | null>(null);

// ==========================================
// PROVIDER
// ==========================================

export function AssistantSessionsProvider({
  children,
}: PropsWithChildren) {
  // DATA SESI DARI FIRESTORE
  const [sessionRecords, setSessionRecords] = useState<SessionRecord[]>([]);

  // DATA PRESENSI SETIAP SESI
  const [attendanceBySession, setAttendanceBySession] = useState<
    Record<string, SessionAttendanceRecap[]>
  >({});

  // ========================================
  // MENGAMBIL DATA SESI DAN PRESENSI REAL-TIME
  // ========================================

  useEffect(() => {
    // Menyimpan listener presensi untuk setiap sesi.
    const attendanceListeners = new Map<
      string,
      {
        classId: string;
        unsubscribe: () => void;
      }
    >();

    // Mendengarkan perubahan koleksi sessions.
    const unsubscribeSessions = subscribeSessions(
      (data) => {
        setSessionRecords(data);

        const activeSessionIds = new Set(
          data.map((item) => item.id),
        );

        // MENGHENTIKAN LISTENER YANG TIDAK DIPERLUKAN
        for (const [sessionId, listener] of attendanceListeners) {
          const session = data.find(
            (item) => item.id === sessionId,
          );

          // Hentikan listener jika sesi sudah dihapus
          // atau kelas yang terhubung dengan sesi berubah.
          if (!session || session.classId !== listener.classId) {
            listener.unsubscribe();
            attendanceListeners.delete(sessionId);

            setAttendanceBySession((previous) => {
              const updated = { ...previous };

              delete updated[sessionId];

              return updated;
            });
          }
        }

        // MEMASANG LISTENER PRESENSI SETIAP SESI
        data.forEach((session) => {
          // Jika listener sudah tersedia, tidak perlu membuat ulang.
          if (attendanceListeners.has(session.id)) {
            return;
          }

          const unsubscribe = subscribeSessionAttendance(
            session.id,
            session.classId,
            (records) => {
              // Memperbarui data presensi sesi secara real-time.
              setAttendanceBySession((previous) => ({
                ...previous,
                [session.id]: records,
              }));
            },
            (error) => {
              console.error(
                `Gagal mengambil presensi sesi ${session.id}:`,
                error,
              );
            },
          );

          attendanceListeners.set(session.id, {
            classId: session.classId,
            unsubscribe,
          });
        });

        // MEMBERSIHKAN DATA PRESENSI SESI YANG SUDAH DIHAPUS
        setAttendanceBySession((previous) => {
          const updated = { ...previous };

          Object.keys(updated).forEach((sessionId) => {
            if (!activeSessionIds.has(sessionId)) {
              delete updated[sessionId];
            }
          });

          return updated;
        });
      },
      (error) => {
        console.error('Gagal mengambil daftar sesi:', error);
      },
    );

    // ========================================
    // MEMBERSIHKAN LISTENER
    // ========================================

    return () => {
      unsubscribeSessions();

      attendanceListeners.forEach((listener) => {
        listener.unsubscribe();
      });

      attendanceListeners.clear();
    };
  }, []);

  // ========================================
  // MENGUBAH DATA FIREBASE MENJADI DATA TAMPILAN
  // ========================================

  const sessions = useMemo<PracticumSession[]>(() => {
    return sessionRecords.map((session) => {
      // Mengambil data presensi dari sesi terkait.
      const attendanceRecords =
        attendanceBySession[session.id] ?? [];

      // Hanya mengambil praktikan yang benar-benar hadir.
      const attendances: AttendanceRecord[] = attendanceRecords
        .filter((item) => item.hadir)
        .map((item) => ({
          uid: item.uid,
          nama: item.nama,
          waktu: item.waktu ?? '-',
        }));

      return {
        id: session.id,
        practicumName: session.practicumName,
        moduleTitle: session.moduleTitle,
        classRoom: session.classRoom,
        scheduleTime: session.scheduleTime,
        status: session.status,
        sessionNote: session.sessionNote ?? '',
        attendances,
      };
    });
  }, [sessionRecords, attendanceBySession]);

  // ========================================
  // MEMBUKA SESI
  // ========================================

  const openSession = useCallback(
    async (sessionId: string, note?: string) => {
      await openFirebaseSession(sessionId, note);
    },
    [],
  );

  // ========================================
  // MENUTUP SESI
  // ========================================

  const closeSession = useCallback(
    async (sessionId: string) => {
      await closeFirebaseSession(sessionId);
    },
    [],
  );

  // ========================================
  // VALUE CONTEXT
  // ========================================

  const value = useMemo<AssistantSessionsContextValue>(
    () => ({
      sessions,
      openSession,
      closeSession,
    }),
    [sessions, openSession, closeSession],
  );

  return (
    <AssistantSessionsContext.Provider value={value}>
      {children}
    </AssistantSessionsContext.Provider>
  );
}

// ==========================================
// CUSTOM HOOK
// ==========================================

export function useAssistantSessions() {
  const context = useContext(AssistantSessionsContext);

  if (!context) {
    throw new Error(
      'useAssistantSessions must be used within AssistantSessionsProvider',
    );
  }

  return context;
}