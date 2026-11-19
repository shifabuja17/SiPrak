import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { useAuth } from '@/context/AuthContext';

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

import {
  subscribeLaboratories,
  type LaboratoryLocation,
} from '../services/laboratory-service';

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
  // Mengambil status autentikasi Firebase.
  const {
    user,
    profile,
    loading: authLoading,
  } = useAuth();

  const userId = user?.uid ?? null;
  const isAssistant = profile?.role === 'asisten';

  // DATA SESI DARI FIRESTORE
  const [sessionRecords, setSessionRecords] = useState<SessionRecord[]>([]);

  // DATA PRESENSI SETIAP SESI
  const [attendanceBySession, setAttendanceBySession] = useState<
    Record<string, SessionAttendanceRecap[]>
  >({});

  // DATA LOKASI LABORATORIUM REAL-TIME
  const [laboratoriesById, setLaboratoriesById] = useState<
    Record<string, LaboratoryLocation>
  >({});

  // ========================================
  // MENDENGARKAN DATA SESI DAN PRESENSI
  // ========================================

  useEffect(() => {
    // Tunggu sampai Firebase selesai memeriksa status login.
    if (authLoading) {
      return;
    }

    // Listener hanya diperlukan untuk akun Asisten.
    if (!userId || !isAssistant) {
      setSessionRecords([]);
      setAttendanceBySession({});
      setLaboratoriesById({});
      return;
    }

    let isActive = true;

    // Menyimpan listener presensi untuk setiap sesi.
    const attendanceListeners = new Map<
      string,
      {
        classId: string;
        unsubscribe: () => void;
      }
    >();

    setSessionRecords([]);
    setAttendanceBySession({});
    setLaboratoriesById({});

    const unsubscribeLaboratories = subscribeLaboratories(
      (labs) => {
        if (!isActive) return;

        const nextMap: Record<string, LaboratoryLocation> = {};
        labs.forEach((lab) => {
          nextMap[lab.id] = lab;
        });
        setLaboratoriesById(nextMap);
      },
      (error) => {
        if (!isActive) return;
        console.error('Gagal mengambil daftar laboratorium:', error);
      },
    );

    // ======================================
    // LISTENER DAFTAR SESI
    // ======================================

    const unsubscribeSessions = subscribeSessions(
      (data) => {
        if (!isActive) return;

        setSessionRecords(data);

        const activeSessionIds = new Set(
          data.map((item) => item.id),
        );

        // Menghentikan listener sesi yang sudah tidak diperlukan.
        for (const [sessionId, listener] of attendanceListeners) {
          const session = data.find(
            (item) => item.id === sessionId,
          );

          if (
            !session ||
            session.classId !== listener.classId
          ) {
            listener.unsubscribe();
            attendanceListeners.delete(sessionId);

            setAttendanceBySession((previous) => {
              const updated = { ...previous };
              delete updated[sessionId];
              return updated;
            });
          }
        }

        // ==================================
        // LISTENER PRESENSI SETIAP SESI
        // ==================================

        data.forEach((session) => {
          if (attendanceListeners.has(session.id)) {
            return;
          }

          const unsubscribe = subscribeSessionAttendance(
            session.id,
            session.classId,
            (records) => {
              if (!isActive) return;

              setAttendanceBySession((previous) => ({
                ...previous,
                [session.id]: records,
              }));
            },
            (error) => {
              if (!isActive) return;

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

        // Menghapus data presensi sesi yang sudah tidak ada.
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
        if (!isActive) return;

        console.error(
          'Gagal mengambil daftar sesi:',
          error,
        );

        setSessionRecords([]);
        setAttendanceBySession({});
      },
    );

    // ========================================
    // MEMBERSIHKAN LISTENER
    // ========================================

    return () => {
      isActive = false;

      unsubscribeLaboratories();
      unsubscribeSessions();

      attendanceListeners.forEach((listener) => {
        listener.unsubscribe();
      });

      attendanceListeners.clear();
    };
  }, [authLoading, userId, isAssistant]);

  // ========================================
  // MENGUBAH DATA FIREBASE MENJADI DATA UI
  // ========================================

  const sessions = useMemo<PracticumSession[]>(() => {
    return sessionRecords.map((session) => {
      const attendanceRecords =
        attendanceBySession[session.id] ?? [];

      const attendances: AttendanceRecord[] =
        attendanceRecords
          .filter((item) => item.hadir)
          .map((item) => ({
            uid: item.uid,
            nama: item.nama,
            waktu: item.waktu ?? '-',
          }));

      const linkedLab = session.labId
        ? laboratoriesById[session.labId]
        : undefined;
      const resolvedLabName =
        linkedLab?.name ?? session.labName ?? null;
      const displayLocation =
        resolvedLabName || session.classRoom || '-';

      return {
        id: session.id,
        practicumName: session.practicumName,
        moduleTitle: session.moduleTitle,
        classRoom: displayLocation,
        labId: session.labId ?? null,
        labName: resolvedLabName,
        labRadius: linkedLab?.radius ?? null,
        scheduleTime: session.scheduleTime,
        status: session.status,
        sessionNote: session.sessionNote ?? '',
        attendances,
      };
    });
  }, [sessionRecords, attendanceBySession, laboratoriesById]);

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