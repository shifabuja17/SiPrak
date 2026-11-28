import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/context/AuthContext';
import {
  subscribePraktikanSessions,
  type PraktikanSessionsPayload,
} from '@/features/praktikan/services/praktikan-sessions';
import type {
  PraktikanClass,
  PraktikanSchedule,
  PraktikanSession,
} from '@/features/praktikan/types';
import { isPraktikanRole } from '@/types/user';

export interface UsePraktikanSessionsResult {
  classes: PraktikanClass[];
  schedules: PraktikanSchedule[];
  sessions: PraktikanSession[];
  totalClassCount: number;
  loading: boolean;
  error: string | null;
  retry: () => void;
}

const EMPTY_PAYLOAD: PraktikanSessionsPayload = {
  classes: [],
  schedules: [],
  sessions: [],
  totalClassCount: 0,
};

/**
 * Custom hook untuk membaca jadwal dan sesi praktikum Praktikan secara real-time
 * berdasarkan identitas & peran dari `useAuth()`, lengkap dengan pembersihan
 * listener otomatis saat unmount atau logout.
 */
export function usePraktikanSessions(): UsePraktikanSessionsResult {
  const {
    user,
    profile,
    status: authStatus,
    loading: authLoading,
    profileError,
  } = useAuth();

  const [payload, setPayload] = useState<PraktikanSessionsPayload>(EMPTY_PAYLOAD);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Increment nonce memicu resubscribe eksplisit saat pengguna menekan coba lagi setelah error.
  const [retryNonce, setRetryNonce] = useState(0);

  const retry = useCallback(() => {
    setRetryNonce((prev) => prev + 1);
  }, []);

  const uid = user?.uid ?? null;
  const role = profile?.role ?? null;

  useEffect(() => {
    if (authLoading || authStatus === 'loading') {
      setLoading(true);
      setError(null);
      return;
    }

    if (authStatus !== 'authenticated' || !uid || !role) {
      setPayload(EMPTY_PAYLOAD);
      setLoading(false);
      setError(uid && profileError ? profileError : null);
      return;
    }

    if (!isPraktikanRole(role)) {
      setPayload(EMPTY_PAYLOAD);
      setLoading(false);
      setError('Data jadwal ini hanya tersedia untuk akun Praktikan.');
      return;
    }

    setLoading(true);
    setError(null);

    const unsubscribe = subscribePraktikanSessions(
      uid,
      (nextPayload) => {
        setPayload(nextPayload);
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
    retryNonce,
  ]);

  return {
    classes: payload.classes,
    schedules: payload.schedules,
    sessions: payload.sessions,
    totalClassCount: payload.totalClassCount,
    loading,
    error,
    retry,
  };
}
