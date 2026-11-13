import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useAuth } from '@/context/AuthContext';
import { mapPraktikanFirestoreError } from '@/features/praktikan/services/firestore-helpers';
import {
  submitPraktikanAttendance,
  subscribeMyAttendance,
  subscribeMyAttendanceMap,
} from '@/features/praktikan/services/praktikan-attendance';
import type { SessionAttendanceDoc } from '@/features/praktikan/types';

export interface UseSessionAttendanceResult {
  attendance: SessionAttendanceDoc | null;
  loading: boolean;
  submitting: boolean;
  error: string | null;
  submitAttendance: () => Promise<boolean>;
  clearError: () => void;
  retry: () => void;
}

export interface UseMyAttendanceMapResult {
  attendanceBySessionId: Record<string, SessionAttendanceDoc | null>;
  loading: boolean;
  error: string | null;
  retry: () => void;
}

/**
 * Custom hook untuk memantau dan mengirimkan presensi Praktikan aktif pada satu sesi
 * (`sessions/{sessionId}/attendance/{uid}`) dengan proteksi anti double-tap dan anti-duplikasi.
 */
export function useSessionAttendance(
  sessionId: string | undefined,
): UseSessionAttendanceResult {
  const {
    user,
    profile,
    status: authStatus,
    loading: authLoading,
    profileError,
  } = useAuth();

  const [attendance, setAttendance] = useState<SessionAttendanceDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);

  // Ref sinkron mencegah double-tap sebelum state `submitting` sempat ter-commit oleh React.
  const submittingRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const uid = user?.uid ?? null;
  const nama = profile?.nama ?? null;
  const role = profile?.role ?? null;
  const trimmedSessionId = sessionId?.trim() ?? '';

  const retry = useCallback(() => {
    setRetryNonce((prev) => prev + 1);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  useEffect(() => {
    if (authLoading || authStatus === 'loading') {
      setLoading(true);
      setError(null);
      return;
    }

    if (authStatus !== 'authenticated' || !uid || !role) {
      setAttendance(null);
      setLoading(false);
      setError(uid && profileError ? profileError : null);
      return;
    }

    if (!trimmedSessionId) {
      setAttendance(null);
      setLoading(false);
      setError('ID sesi tidak valid.');
      return;
    }

    if (role !== 'praktikan') {
      setAttendance(null);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    const unsubscribe = subscribeMyAttendance(
      trimmedSessionId,
      uid,
      (docData) => {
        setAttendance(docData);
        setError(null);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
    );

    return () => {
      unsubscribe();
    };
  }, [
    authLoading,
    authStatus,
    uid,
    role,
    profileError,
    trimmedSessionId,
    retryNonce,
  ]);

  const submitAttendance = useCallback(async (): Promise<boolean> => {
    if (submitting || submittingRef.current) return false;

    if (!uid || !nama || !role) {
      setError('Sesi akun belum siap. Silakan login kembali.');
      return false;
    }

    if (role !== 'praktikan') {
      setError('Hanya Praktikan yang dapat melakukan presensi.');
      return false;
    }

    if (!trimmedSessionId) {
      setError('ID sesi tidak valid.');
      return false;
    }

    if (attendance) {
      setError('Kamu sudah melakukan presensi pada sesi ini.');
      return false;
    }

    submittingRef.current = true;
    setSubmitting(true);
    setError(null);

    try {
      await submitPraktikanAttendance({
        sessionId: trimmedSessionId,
        uid,
        nama,
      });
      return true;
    } catch (err) {
      if (mountedRef.current) {
        setError(mapPraktikanFirestoreError(err).message);
      }
      return false;
    } finally {
      submittingRef.current = false;
      if (mountedRef.current) {
        setSubmitting(false);
      }
    }
  }, [submitting, uid, nama, role, trimmedSessionId, attendance]);

  return {
    attendance,
    loading,
    submitting,
    error,
    submitAttendance,
    clearError,
    retry,
  };
}

/**
 * Custom hook opsional untuk daftar jadwal/riwayat Praktikan guna mengecek status
 * kehadiran (`sessions/{sessionId}/attendance/{uid}`) per sesi secara real-time.
 */
export function useMyAttendanceMap(
  sessionIds: string[],
): UseMyAttendanceMapResult {
  const {
    user,
    profile,
    status: authStatus,
    loading: authLoading,
    profileError,
  } = useAuth();

  const [attendanceBySessionId, setAttendanceBySessionId] = useState<
    Record<string, SessionAttendanceDoc | null>
  >({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);

  const retry = useCallback(() => {
    setRetryNonce((prev) => prev + 1);
  }, []);

  const uid = user?.uid ?? null;
  const role = profile?.role ?? null;

  const sessionIdsKey = useMemo(
    () =>
      Array.from(new Set(sessionIds.map((id) => id.trim()).filter(Boolean)))
        .sort()
        .join('|'),
    [sessionIds],
  );

  useEffect(() => {
    if (authLoading || authStatus === 'loading') {
      setLoading(true);
      setError(null);
      return;
    }

    if (authStatus !== 'authenticated' || !uid || role !== 'praktikan') {
      setAttendanceBySessionId({});
      setLoading(false);
      setError(uid && profileError ? profileError : null);
      return;
    }

    const normalizedIds = sessionIdsKey ? sessionIdsKey.split('|') : [];
    if (normalizedIds.length === 0) {
      setAttendanceBySessionId({});
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    const unsubscribe = subscribeMyAttendanceMap(
      normalizedIds,
      uid,
      (nextMap) => {
        setAttendanceBySessionId(nextMap);
        setError(null);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
    );

    return () => {
      unsubscribe();
    };
  }, [
    authLoading,
    authStatus,
    uid,
    role,
    profileError,
    sessionIdsKey,
    retryNonce,
  ]);

  return {
    attendanceBySessionId,
    loading,
    error,
    retry,
  };
}
