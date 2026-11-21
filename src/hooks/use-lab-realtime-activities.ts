import { useCallback, useEffect, useMemo, useState } from 'react';

import { useAuth } from '@/context/AuthContext';
import {
  isLaboratoryId,
  type LaboratoryId,
} from '@/features/assistant/services/laboratory-service';
import {
  computeLabRealtimeActivities,
  subscribeLabActivitiesSnapshot,
  type LabActivitiesSnapshotData,
  type LabActivityItem,
} from '@/services/lab-activities-service';

export interface UseLabRealtimeActivitiesResult {
  ongoingActivity: LabActivityItem | null;
  nextActivity: LabActivityItem | null;
  ongoingActivities: LabActivityItem[];
  upcomingActivities: LabActivityItem[];
  loading: boolean;
  error: string | null;
  retry: () => void;
}

const CLOCK_REFRESH_INTERVAL_MS = 60_000;

/**
 * Custom hook untuk memantau aktivitas praktikum pada satu laboratorium (`labId`)
 * secara real-time melalui `onSnapshot` pada koleksi `sessions`, `schedules`, dan `classes`.
 *
 * Seluruh listener `onSnapshot` dan timer penyegar waktu otomatis dibersihkan saat `labId`
 * berubah (termasuk menjadi `null`) atau saat komponen unmount (NFR-02).
 */
export function useLabRealtimeActivities(
  labId: LaboratoryId | string | null | undefined,
): UseLabRealtimeActivitiesResult {
  const { user, status: authStatus, loading: authLoading } = useAuth();

  const [snapshotState, setSnapshotState] = useState<{
    labId: LaboratoryId;
    data: LabActivitiesSnapshotData;
  } | null>(null);
  const [loading, setLoading] = useState(Boolean(labId));
  const [error, setError] = useState<string | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);
  const [clockTick, setClockTick] = useState(() => Date.now());

  const retry = useCallback(() => {
    setError(null);
    if (labId && isLaboratoryId(labId)) {
      setLoading(true);
    }
    setRetryNonce((previous) => previous + 1);
  }, [labId]);

  useEffect(() => {
    if (!labId || !isLaboratoryId(labId)) {
      return;
    }

    setClockTick(Date.now());

    const timer = setInterval(() => {
      setClockTick(Date.now());
    }, CLOCK_REFRESH_INTERVAL_MS);

    return () => {
      clearInterval(timer);
    };
  }, [labId]);

  useEffect(() => {
    if (!labId) {
      setSnapshotState(null);
      setLoading(false);
      setError(null);
      return;
    }

    if (!isLaboratoryId(labId)) {
      setSnapshotState(null);
      setLoading(false);
      setError('ID laboratorium tidak valid.');
      return;
    }

    if (authLoading || authStatus === 'loading') {
      setSnapshotState(null);
      setLoading(true);
      setError(null);
      return;
    }

    if (authStatus !== 'authenticated' || !user) {
      setSnapshotState(null);
      setLoading(false);
      setError('Silakan login terlebih dahulu untuk melihat aktivitas laboratorium.');
      return;
    }

    let active = true;
    setSnapshotState(null);
    setLoading(true);
    setError(null);

    const unsubscribe = subscribeLabActivitiesSnapshot(
      labId,
      (nextData) => {
        if (!active) return;
        setSnapshotState({ labId, data: nextData });
        setError(null);
        setLoading(false);
      },
      (firebaseError) => {
        if (!active) return;
        setSnapshotState(null);
        setError(firebaseError.message);
        setLoading(false);
      },
    );

    return () => {
      active = false;
      unsubscribe();
    };
  }, [authLoading, authStatus, user, labId, retryNonce]);

  const isMatchingLabSnapshot = Boolean(
    labId && isLaboratoryId(labId) && snapshotState?.labId === labId,
  );

  const effectiveLoading = Boolean(
    labId &&
      isLaboratoryId(labId) &&
      !error &&
      (loading || !isMatchingLabSnapshot),
  );

  const activities = useMemo(() => {
    if (
      !snapshotState ||
      !labId ||
      !isLaboratoryId(labId) ||
      snapshotState.labId !== labId
    ) {
      return {
        ongoingActivity: null,
        nextActivity: null,
        ongoingActivities: [],
        upcomingActivities: [],
      };
    }

    return computeLabRealtimeActivities(
      snapshotState.data,
      labId,
      new Date(clockTick),
    );
  }, [snapshotState, labId, clockTick]);

  return {
    ongoingActivity: activities.ongoingActivity,
    nextActivity: activities.nextActivity,
    ongoingActivities: activities.ongoingActivities,
    upcomingActivities: activities.upcomingActivities,
    loading: effectiveLoading,
    error,
    retry,
  };
}
