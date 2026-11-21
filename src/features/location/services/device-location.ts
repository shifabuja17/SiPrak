import * as Location from 'expo-location';
import { Platform } from 'react-native';

import {
  DeviceLocationError,
  type DeviceCoordinates,
} from '@/features/location/types';

const LOCATION_TIMEOUT_MS = 15000;

function toCoordinates(location: Location.LocationObject): DeviceCoordinates {
  return {
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
    accuracy: location.coords.accuracy ?? null,
    mocked: location.mocked === true,
    timestamp: location.timestamp,
  };
}

/** Meminta izin lokasi foreground; melempar DeviceLocationError bila ditolak. */
export async function ensureLocationPermission(): Promise<void> {
  const current = await Location.getForegroundPermissionsAsync();
  if (current.granted) return;

  if (!current.canAskAgain) {
    throw new DeviceLocationError(
      'permission-blocked',
      'Izin lokasi diblokir. Aktifkan izin lokasi untuk SiPrak melalui pengaturan perangkat.',
    );
  }

  const requested = await Location.requestForegroundPermissionsAsync();
  if (!requested.granted) {
    throw new DeviceLocationError(
      requested.canAskAgain ? 'permission-denied' : 'permission-blocked',
      'Izin lokasi ditolak. Presensi membutuhkan lokasi untuk memastikan kamu berada di laboratorium.',
    );
  }
}

async function ensureServicesEnabled(): Promise<void> {
  // Di web status layanan tidak dapat diketahui; kegagalan ditangani saat mengambil posisi.
  if (Platform.OS === 'web') return;

  const enabled = await Location.hasServicesEnabledAsync();
  if (!enabled) {
    throw new DeviceLocationError(
      'services-disabled',
      'GPS / layanan lokasi tidak aktif. Aktifkan lokasi pada perangkat lalu coba lagi.',
    );
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(
        new DeviceLocationError(
          'timeout',
          'Lokasi tidak didapat dalam waktu yang wajar. Pastikan sinyal GPS baik lalu coba lagi.',
        ),
      );
    }, ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function toDeviceLocationError(error: unknown): DeviceLocationError {
  if (error instanceof DeviceLocationError) return error;

  const message = error instanceof Error ? error.message.toLowerCase() : '';
  if (message.includes('denied') || message.includes('permission')) {
    return new DeviceLocationError(
      'permission-denied',
      'Izin lokasi ditolak. Presensi membutuhkan lokasi untuk memastikan kamu berada di laboratorium.',
    );
  }
  if (message.includes('unavailable') || message.includes('disabled')) {
    return new DeviceLocationError(
      'services-disabled',
      'GPS / layanan lokasi tidak aktif. Aktifkan lokasi pada perangkat lalu coba lagi.',
    );
  }
  return new DeviceLocationError(
    'unavailable',
    'Koordinat perangkat tidak tersedia. Coba lagi di area dengan sinyal GPS yang lebih baik.',
  );
}

/**
 * FR-03: meminta izin lalu mengambil koordinat perangkat saat ini.
 * Semua kegagalan dilempar sebagai DeviceLocationError dengan pesan siap tampil.
 */
export async function getCurrentDeviceLocation(): Promise<DeviceCoordinates> {
  try {
    await ensureLocationPermission();
    await ensureServicesEnabled();
    const location = await withTimeout(
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
      LOCATION_TIMEOUT_MS,
    );
    return toCoordinates(location);
  } catch (error) {
    throw toDeviceLocationError(error);
  }
}

/**
 * Memantau posisi perangkat secara berkelanjutan (untuk marker posisi pengguna di Maps, P2).
 * Mengembalikan fungsi untuk berhenti memantau.
 */
export async function watchDeviceLocation(
  onUpdate: (coords: DeviceCoordinates) => void,
  onError: (error: DeviceLocationError) => void,
): Promise<() => void> {
  try {
    await ensureLocationPermission();
    await ensureServicesEnabled();
    const subscription = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.High, distanceInterval: 5 },
      (location) => onUpdate(toCoordinates(location)),
      (reason) => onError(toDeviceLocationError(new Error(reason))),
    );
    return () => subscription.remove();
  } catch (error) {
    onError(toDeviceLocationError(error));
    return () => {};
  }
}
