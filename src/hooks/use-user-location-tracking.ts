import type * as Location from 'expo-location';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import {
  checkLocationServicesEnabled,
  formatLocationErrorMessage,
  getQuickLastKnownUserLocation,
  requestForegroundLocationPermission,
  watchUserLocation,
  type LocationPermissionStatus,
  type LocationWatchSubscription,
  type UserLocationCoordinates,
} from '@/services/location-service';

export interface UseUserLocationTrackingOptions {
  enabled?: boolean;
  accuracy?: Location.LocationAccuracy;
  timeInterval?: number;
  distanceInterval?: number;
}

export interface UseUserLocationTrackingResult {
  userLocation: UserLocationCoordinates | null;
  permissionStatus: LocationPermissionStatus;
  isLocationServiceEnabled: boolean;
  isSearchingLocation: boolean;
  errorMessage: string | null;
  canAskPermissionAgain: boolean;
  retryLocation: () => void;
}

/**
 * Custom hook untuk memantau lokasi perangkat pengguna secara real-time selama halaman Maps
 * sedang aktif/fokus dan aplikasi berada di foreground.
 *
 * Watcher `watchPositionAsync` otomatis dihentikan saat pengguna menutup halaman, berpindah
 * tab/screen, atau memindahkan aplikasi ke background untuk mencegah memory leak dan boros baterai.
 */
export function useUserLocationTracking(
  options: UseUserLocationTrackingOptions = {},
): UseUserLocationTrackingResult {
  const {
    enabled = true,
    accuracy,
    timeInterval,
    distanceInterval,
  } = options;

  const [userLocation, setUserLocation] =
    useState<UserLocationCoordinates | null>(null);
  const [permissionStatus, setPermissionStatus] =
    useState<LocationPermissionStatus>('loading');
  const [isLocationServiceEnabled, setIsLocationServiceEnabled] =
    useState(true);
  const [isSearchingLocation, setIsSearchingLocation] = useState(enabled);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [canAskPermissionAgain, setCanAskPermissionAgain] = useState(true);
  const [retryNonce, setRetryNonce] = useState(0);

  const [isAppForeground, setIsAppForeground] = useState(
    () => AppState.currentState !== 'background',
  );

  const mountedRef = useRef(true);
  const permissionStatusRef = useRef<LocationPermissionStatus>('loading');

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'background') {
        setIsAppForeground(false);
      } else if (nextState === 'active') {
        setIsAppForeground(true);
      }
    });

    return () => {
      subscription?.remove();
    };
  }, []);

  const retryLocation = useCallback(() => {
    permissionStatusRef.current = 'loading';
    setErrorMessage(null);
    setPermissionStatus('loading');
    setIsSearchingLocation(true);
    setRetryNonce((previous) => previous + 1);
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!enabled || !isAppForeground) {
        setIsSearchingLocation(false);
        return;
      }

      let cancelled = false;
      let watchSubscription: LocationWatchSubscription | null = null;

      const stopWatcher = () => {
        if (watchSubscription) {
          watchSubscription.remove();
          watchSubscription = null;
        }
      };

      async function syncServiceStatusOnWatchError(): Promise<void> {
        try {
          const servicesEnabled = await checkLocationServicesEnabled();
          if (!cancelled) {
            setIsLocationServiceEnabled(servicesEnabled);
          }
        } catch (statusError) {
          if (!cancelled) {
            setErrorMessage(formatLocationErrorMessage(statusError));
          }
        }
      }

      async function startTracking(): Promise<void> {
        let permissionResolved = false;

        setErrorMessage(null);
        setIsSearchingLocation(true);
        if (permissionStatusRef.current !== 'granted') {
          permissionStatusRef.current = 'loading';
          setPermissionStatus('loading');
        }

        try {
          const permission = await requestForegroundLocationPermission();
          if (cancelled) return;

          permissionResolved = true;
          permissionStatusRef.current = permission.status;
          setPermissionStatus(permission.status);
          setCanAskPermissionAgain(permission.canAskAgain);

          const servicesEnabled = await checkLocationServicesEnabled();
          if (cancelled) return;

          setIsLocationServiceEnabled(servicesEnabled);

          if (permission.status !== 'granted') {
            setIsSearchingLocation(false);
            setErrorMessage(
              permission.canAskAgain
                ? 'Izin akses lokasi ditolak. Berikan izin lokasi agar posisi Anda dapat ditampilkan di peta.'
                : 'Izin akses lokasi ditolak permanen. Buka Pengaturan perangkat untuk mengaktifkan izin lokasi.',
            );
            return;
          }

          if (!servicesEnabled) {
            setIsSearchingLocation(false);
            setErrorMessage(
              'Layanan lokasi (GPS) perangkat sedang nonaktif. Aktifkan GPS untuk melihat posisi Anda.',
            );
            return;
          }

          const quickLocation = await getQuickLastKnownUserLocation();
          if (cancelled) return;

          if (quickLocation) {
            setUserLocation(quickLocation);
            setIsSearchingLocation(false);
          }

          const nextSubscription = await watchUserLocation(
            (nextLocation) => {
              if (cancelled) return;
              setUserLocation(nextLocation);
              setIsLocationServiceEnabled(true);
              setIsSearchingLocation(false);
              setErrorMessage(null);
            },
            (watchErrorMessage) => {
              if (cancelled) return;
              setIsSearchingLocation(false);
              setErrorMessage(watchErrorMessage);
              void syncServiceStatusOnWatchError();
            },
            {
              accuracy,
              timeInterval,
              distanceInterval,
            },
          );

          if (cancelled) {
            nextSubscription.remove();
            return;
          }

          watchSubscription = nextSubscription;
        } catch (error) {
          if (cancelled) return;
          if (!permissionResolved && permissionStatusRef.current === 'loading') {
            permissionStatusRef.current = 'denied';
            setPermissionStatus('denied');
          }
          setIsSearchingLocation(false);
          setErrorMessage(formatLocationErrorMessage(error));
        }
      }

      void startTracking();

      return () => {
        cancelled = true;
        stopWatcher();
        if (mountedRef.current) {
          setIsSearchingLocation(false);
        }
      };
    }, [enabled, isAppForeground, accuracy, timeInterval, distanceInterval, retryNonce]),
  );

  return {
    userLocation,
    permissionStatus,
    isLocationServiceEnabled,
    isSearchingLocation,
    errorMessage,
    canAskPermissionAgain,
    retryLocation,
  };
}
