import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useAuth } from '@/context/AuthContext';
import {
  subscribeMyLeaveRequests,
  submitPraktikanLeaveRequest,
} from '@/features/praktikan/services/praktikan-leave-requests';
import type { LeaveRequestDoc } from '@/features/praktikan/types';

export interface SubmitPraktikanLeaveInput {
  sessionId: string;
  alasan: string;
  kategoriAI?: string | null;
}

export interface UsePraktikanLeaveRequestsResult {
  leaveRequests: LeaveRequestDoc[];
  leaveBySessionId: Record<string, LeaveRequestDoc>;
  loading: boolean;
  submitting: boolean;
  error: string | null;
  submitLeaveRequest: (input: SubmitPraktikanLeaveInput) => Promise<boolean>;
  clearError: () => void;
  retry: () => void;
}

interface LeaveSubscriptionState {
  key: string | null;
  requests: LeaveRequestDoc[];
  error: string | null;
}

const EMPTY_LEAVE_REQUESTS: LeaveRequestDoc[] = [];
const INITIAL_SUBSCRIPTION_STATE: LeaveSubscriptionState = {
  key: null,
  requests: EMPTY_LEAVE_REQUESTS,
  error: null,
};

/**
 * Custom hook untuk mengelola langganan real-time daftar izin Praktikan (FR-17)
 * dan pengiriman pengajuan izin baru ke Firestore (FR-15).
 */
export function usePraktikanLeaveRequests(): UsePraktikanLeaveRequestsResult {
  const { user, profile, status, loading: authLoading, profileError } = useAuth();

  const rawUid = user?.uid?.trim();
  const uid = rawUid ? rawUid : null;
  const nama = profile?.nama?.trim() ?? '';
  const role = profile?.role ?? null;

  const [subscriptionState, setSubscriptionState] =
    useState<LeaveSubscriptionState>(INITIAL_SUBSCRIPTION_STATE);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);

  const mountedRef = useRef(true);
  const submittingRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const isAuthResolving = authLoading || status === 'loading';
  const activeKey =
    !isAuthResolving && status === 'authenticated' && uid && role === 'praktikan'
      ? `${uid}:${retryNonce}`
      : null;

  useEffect(() => {
    if (isAuthResolving) {
      return;
    }

    if (!activeKey || !uid) {
      setSubscriptionState(INITIAL_SUBSCRIPTION_STATE);
      if (status !== 'authenticated') {
        setSubmitError(null);
      }
      return;
    }

    let active = true;

    const unsubscribe = subscribeMyLeaveRequests(
      uid,
      (requests) => {
        if (!active) {
          return;
        }
        setSubscriptionState({
          key: activeKey,
          requests,
          error: null,
        });
      },
      (err) => {
        if (!active) {
          return;
        }
        setSubscriptionState({
          key: activeKey,
          requests: EMPTY_LEAVE_REQUESTS,
          error: err.message,
        });
      },
    );

    return () => {
      active = false;
      unsubscribe();
    };
  }, [activeKey, isAuthResolving, status, uid]);

  const leaveRequests =
    activeKey !== null && subscriptionState.key === activeKey
      ? subscriptionState.requests
      : EMPTY_LEAVE_REQUESTS;

  const subscriptionError =
    activeKey !== null && subscriptionState.key === activeKey
      ? subscriptionState.error
      : null;

  const loading = isAuthResolving || (activeKey !== null && subscriptionState.key !== activeKey);

  const roleGuardError = useMemo(() => {
    if (isAuthResolving || status !== 'authenticated') {
      return null;
    }
    if (profileError) {
      return null;
    }
    if (!profile) {
      return 'Profil pengguna tidak tersedia. Silakan muat ulang atau login kembali.';
    }
    if (profile.role !== 'praktikan') {
      return 'Fitur pengajuan izin hanya tersedia untuk akun Praktikan.';
    }
    return null;
  }, [isAuthResolving, profile, profileError, status]);

  const leaveBySessionId = useMemo<Record<string, LeaveRequestDoc>>(() => {
    const bySession: Record<string, LeaveRequestDoc> = {};
    for (const item of leaveRequests) {
      // leaveRequests sudah terurut terbaru -> terlama; pertahankan entri pertama per sessionId.
      if (!Object.prototype.hasOwnProperty.call(bySession, item.sessionId)) {
        bySession[item.sessionId] = item;
      }
    }
    return bySession;
  }, [leaveRequests]);

  const submitLeaveRequest = useCallback(
    async (input: SubmitPraktikanLeaveInput): Promise<boolean> => {
      if (submittingRef.current) {
        return false;
      }

      if (status !== 'authenticated' || !uid) {
        setSubmitError('Anda harus login sebagai Praktikan untuk mengajukan izin.');
        return false;
      }

      if (profileError) {
        setSubmitError(profileError);
        return false;
      }

      if (role !== 'praktikan') {
        setSubmitError('Hanya akun Praktikan yang dapat mengajukan izin.');
        return false;
      }

      if (!nama) {
        setSubmitError('Nama profil Praktikan belum tersedia. Silakan login kembali.');
        return false;
      }

      submittingRef.current = true;
      setSubmitting(true);
      setSubmitError(null);

      try {
        await submitPraktikanLeaveRequest({
          sessionId: input.sessionId,
          uid,
          nama,
          alasan: input.alasan,
          kategoriAI: input.kategoriAI,
        });
        if (mountedRef.current) {
          setSubmitError(null);
        }
        return true;
      } catch (err) {
        if (mountedRef.current) {
          setSubmitError(
            err instanceof Error ? err.message : 'Gagal mengirim pengajuan izin.',
          );
        }
        return false;
      } finally {
        submittingRef.current = false;
        if (mountedRef.current) {
          setSubmitting(false);
        }
      }
    },
    [nama, profileError, role, status, uid],
  );

  const clearError = useCallback(() => {
    setSubmitError(null);
    setSubscriptionState((prev) => (prev.error ? { ...prev, error: null } : prev));
  }, []);

  const retry = useCallback(() => {
    setSubmitError(null);
    setRetryNonce((prev) => prev + 1);
  }, []);

  const error = submitError ?? subscriptionError ?? roleGuardError ?? profileError ?? null;

  return {
    leaveRequests,
    leaveBySessionId,
    loading,
    submitting,
    error,
    submitLeaveRequest,
    clearError,
    retry,
  };
}
