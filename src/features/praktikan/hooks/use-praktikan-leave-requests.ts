import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useAuth } from '@/context/AuthContext';
import { classifyLeaveReason } from '@/features/praktikan/services/ai-leave-classifier';
import { mapPraktikanFirestoreError } from '@/features/praktikan/services/firestore-helpers';
import {
  subscribeMyLeaveRequests,
  submitPraktikanLeaveRequest,
} from '@/features/praktikan/services/praktikan-leave-requests';
import type {
  LeaveAiClassificationResult,
  LeaveRequestDoc,
  SubmitLeaveRequestOutcome,
} from '@/features/praktikan/types';
import { validateLeaveReason } from '@/features/praktikan/utils/leave-validation';

export type LeaveSubmittingStep = 'idle' | 'classifying_ai' | 'saving_firestore';

export interface SubmitPraktikanLeaveInput {
  sessionId: string;
  alasan: string;
}

export interface UsePraktikanLeaveRequestsResult {
  leaveRequests: LeaveRequestDoc[];
  leaveBySessionId: Record<string, LeaveRequestDoc>;
  loading: boolean;
  submitting: boolean;
  submittingStep: LeaveSubmittingStep;
  error: string | null;
  listError: string | null;
  submitError: string | null;
  submitLeaveRequest: (input: SubmitPraktikanLeaveInput) => Promise<SubmitLeaveRequestOutcome>;
  clearError: () => void;
  clearSubmitError: () => void;
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

function buildRejectedOutcome(): SubmitLeaveRequestOutcome {
  return {
    ok: false,
    aiClassified: false,
    kategoriAI: null,
    aiWarning: null,
  };
}

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
  const [submittingStep, setSubmittingStep] = useState<LeaveSubmittingStep>('idle');
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
    async (input: SubmitPraktikanLeaveInput): Promise<SubmitLeaveRequestOutcome> => {
      if (submittingRef.current) {
        return buildRejectedOutcome();
      }

      if (authLoading || status === 'loading') {
        setSubmitError('Sesi akun masih dipulihkan. Tunggu beberapa saat lalu coba kembali.');
        return buildRejectedOutcome();
      }

      if (status !== 'authenticated' || !uid) {
        setSubmitError('Anda harus login sebagai Praktikan untuk mengajukan izin.');
        return buildRejectedOutcome();
      }

      if (profileError) {
        setSubmitError(profileError);
        return buildRejectedOutcome();
      }

      if (role !== 'praktikan') {
        setSubmitError('Hanya akun Praktikan yang dapat mengajukan izin.');
        return buildRejectedOutcome();
      }

      if (!nama) {
        setSubmitError('Nama profil Praktikan belum tersedia. Silakan login kembali.');
        return buildRejectedOutcome();
      }

      const trimmedSessionId = typeof input.sessionId === 'string' ? input.sessionId.trim() : '';
      if (!trimmedSessionId) {
        setSubmitError('ID sesi wajib diisi untuk mengajukan izin.');
        return buildRejectedOutcome();
      }

      const reasonError = validateLeaveReason(input.alasan);
      if (reasonError) {
        setSubmitError(reasonError);
        return buildRejectedOutcome();
      }

      if (Object.prototype.hasOwnProperty.call(leaveBySessionId, trimmedSessionId)) {
        setSubmitError('Anda sudah pernah mengajukan izin untuk sesi ini.');
        return buildRejectedOutcome();
      }

      submittingRef.current = true;
      setSubmitting(true);
      setSubmittingStep('classifying_ai');
      setSubmitError(null);

      let aiResult: LeaveAiClassificationResult = {
        ok: false,
        category: null,
        reason: 'Layanan klasifikasi AI belum dijalankan.',
      };

      try {
        aiResult = await classifyLeaveReason(input.alasan);

        if (mountedRef.current) {
          setSubmittingStep('saving_firestore');
        }

        await submitPraktikanLeaveRequest({
          sessionId: trimmedSessionId,
          uid,
          nama,
          alasan: input.alasan,
          kategoriAI: aiResult.category,
        });

        if (mountedRef.current) {
          setSubmitError(null);
        }

        return {
          ok: true,
          aiClassified: aiResult.ok,
          kategoriAI: aiResult.category,
          aiWarning: aiResult.ok ? null : aiResult.reason,
        };
      } catch (err) {
        if (mountedRef.current) {
          setSubmitError(mapPraktikanFirestoreError(err).message);
        }

        return {
          ok: false,
          aiClassified: aiResult.ok,
          kategoriAI: aiResult.category,
          aiWarning: null,
        };
      } finally {
        submittingRef.current = false;
        if (mountedRef.current) {
          setSubmitting(false);
          setSubmittingStep('idle');
        }
      }
    },
    [authLoading, leaveBySessionId, nama, profileError, role, status, uid],
  );

  const clearSubmitError = useCallback(() => {
    setSubmitError(null);
  }, []);

  const clearError = useCallback(() => {
    setSubmitError(null);
    setSubscriptionState((prev) => (prev.error ? { ...prev, error: null } : prev));
  }, []);

  const retry = useCallback(() => {
    setSubmitError(null);
    setRetryNonce((prev) => prev + 1);
  }, []);

  const listError = subscriptionError ?? roleGuardError ?? profileError ?? null;
  const error = submitError ?? listError ?? null;

  return {
    leaveRequests,
    leaveBySessionId,
    loading,
    submitting,
    submittingStep,
    error,
    listError,
    submitError,
    submitLeaveRequest,
    clearError,
    clearSubmitError,
    retry,
  };
}
