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

  const [snapshotData, setSnapshotData] =
    useState<LabActivitiesSnapshotData | null>(null);
  const [loading, setLoading] = useState(Boolean(labId));
  const [error, setError] = useState<string | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);
  const [clockTick, setClockTick] = useState(() => Date.now());

  const retry = useCallback(() => {
    setError(null);
    setRetryNonce((previous) => previous + 1);
  }, []);

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
      setSnapshotData(null);
      setLoading(false);
      setError(null);
      return;
    }

    if (!isLaboratoryId(labId)) {
      setSnapshotData(null);
      setLoading(false);
      setError('ID laboratorium tidak valid.');
      return;
    }

    if (authLoading || authStatus === 'loading') {
      setSnapshotData(null);
      setLoading(true);
      setError(null);
      return;
    }

    if (authStatus !== 'authenticated' || !user) {
      setSnapshotData(null);
      setLoading(false);
      setError('Silakan login terlebih dahulu untuk melihat aktivitas laboratorium.');
      return;
    }

    let active = true;
    setSnapshotData(null);
    setLoading(true);
    setError(null);

    const unsubscribe = subscribeLabActivitiesSnapshot(
      labId,
      (nextData) => {
        if (!active) return;
        setSnapshotData(nextData);
        setError(null);
        setLoading(false);
      },
      (firebaseError) => {
        if (!active) return;
        setSnapshotData(null);
        setError(firebaseError.message);
        setLoading(false);
      },
    );

    return () => {
      active = false;
      unsubscribe();
    };
  }, [authLoading, authStatus, user, labId, retryNonce]);

  const activities = useMemo(() => {
    if (!snapshotData || !labId || !isLaboratoryId(labId)) {
      return {
        ongoingActivity: null,
        nextActivity: null,
        ongoingActivities: [],
        upcomingActivities: [],
      };
    }

    return computeLabRealtimeActivities(
      snapshotData,
      labId,
      new Date(clockTick),
    );
  }, [snapshotData, labId, clockTick]);

  return {
    ongoingActivity: activities.ongoingActivity,
    nextActivity: activities.nextActivity,
    ongoingActivities: activities.ongoingActivities,
    upcomingActivities: activities.upcomingActivities,
    loading,
    error,
    retry,
  };
}
