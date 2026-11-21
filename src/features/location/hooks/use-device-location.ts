import { useCallback, useEffect, useRef, useState } from 'react';

import {
  getCurrentDeviceLocation,
  watchDeviceLocation,
} from '@/features/location/services/device-location';
import {
  DeviceLocationError,
  type DeviceCoordinates,
} from '@/features/location/types';

export interface UseDeviceLocationResult {
  coords: DeviceCoordinates | null;
  loading: boolean;
  error: DeviceLocationError | null;
  /** Ambil lokasi sekali; mengembalikan koordinat atau null bila gagal. */
  refresh: () => Promise<DeviceCoordinates | null>;
}

/**
 * Lokasi perangkat sekali ambil (presensi, P1). Dengan `watch: true`, posisi
 * diperbarui terus selama komponen aktif (marker pengguna di Maps, P2).
 */
export function useDeviceLocation(options?: { watch?: boolean }): UseDeviceLocationResult {
  const watch = options?.watch === true;
  const [coords, setCoords] = useState<DeviceCoordinates | null>(null);
  const [loading, setLoading] = useState(watch);
  const [error, setError] = useState<DeviceLocationError | null>(null);
  const mountedRef = useRef(true);
  const requestIdRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const refresh = useCallback(async (): Promise<DeviceCoordinates | null> => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const next = await getCurrentDeviceLocation();
      if (mountedRef.current && requestId === requestIdRef.current) {
        setCoords(next);
      }
      return next;
    } catch (err) {
      const locationError =
        err instanceof DeviceLocationError
          ? err
          : new DeviceLocationError('unavailable', 'Koordinat perangkat tidak tersedia.');
      if (mountedRef.current && requestId === requestIdRef.current) {
        setCoords(null);
        setError(locationError);
      }
      return null;
    } finally {
      if (mountedRef.current && requestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!watch) return;

    let stop: (() => void) | null = null;
    let cancelled = false;

    void watchDeviceLocation(
      (next) => {
        if (cancelled) return;
        setCoords(next);
        setError(null);
        setLoading(false);
      },
      (err) => {
        if (cancelled) return;
        setError(err);
        setLoading(false);
      },
    ).then((unsubscribe) => {
      if (cancelled) unsubscribe();
      else stop = unsubscribe;
    });

    return () => {
      cancelled = true;
      stop?.();
    };
  }, [watch]);

  return { coords, loading, error, refresh };
}
