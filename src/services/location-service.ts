import * as Location from 'expo-location';
import { Linking, Platform } from 'react-native';

export type LocationPermissionStatus = 'loading' | 'granted' | 'denied';

export interface UserLocationCoordinates {
  latitude: number;
  longitude: number;
  accuracy: number | null;
}

export interface LocationPermissionResult {
  status: Exclude<LocationPermissionStatus, 'loading'>;
  canAskAgain: boolean;
}

export interface LocationWatchSubscription {
  remove: () => void;
}

export interface WatchUserLocationOptions {
  accuracy?: Location.LocationAccuracy;
  timeInterval?: number;
  distanceInterval?: number;
  mayShowUserSettingsDialog?: boolean;
}

const EARTH_RADIUS_METERS = 6_371_000;

const DEFAULT_WATCH_OPTIONS = {
  accuracy: Location.LocationAccuracy.High,
  timeInterval: 3000,
  distanceInterval: 5,
  mayShowUserSettingsDialog: true,
} as const;

const DEFAULT_LAST_KNOWN_OPTIONS: Location.LocationLastKnownOptions = {
  maxAge: 30_000,
  requiredAccuracy: 150,
};

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Validasi nilai lintang (`-90..90`) dan bujur (`-180..180`) numerik berhingga.
 */
export function isValidLocationCoordinate(
  latitude: unknown,
  longitude: unknown,
): boolean {
  return (
    typeof latitude === 'number' &&
    Number.isFinite(latitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    typeof longitude === 'number' &&
    Number.isFinite(longitude) &&
    longitude >= -180 &&
    longitude <= 180
  );
}

/**
 * Normalisasi payload koordinat perangkat ke bentuk standar `{ latitude, longitude, accuracy }`.
 */
export function toUserLocationCoordinates(coords: {
  latitude: unknown;
  longitude: unknown;
  accuracy?: unknown;
}): UserLocationCoordinates | null {
  if (!isValidLocationCoordinate(coords.latitude, coords.longitude)) {
    return null;
  }

  const normalizedAccuracy =
    typeof coords.accuracy === 'number' &&
    Number.isFinite(coords.accuracy) &&
    coords.accuracy >= 0
      ? coords.accuracy
      : null;

  return {
    latitude: coords.latitude as number,
    longitude: coords.longitude as number,
    accuracy: normalizedAccuracy,
  };
}

/**
 * Menghitung jarak antara dua titik koordinat dalam satuan meter (rumus Haversine).
 * Siap digunakan oleh tampilan jarak Maps maupun validasi radius presensi Programmer 1.
 */
export function calculateDistanceMeters(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number },
): number {
  if (
    !isValidLocationCoordinate(from.latitude, from.longitude) ||
    !isValidLocationCoordinate(to.latitude, to.longitude)
  ) {
    throw new Error('Koordinat asal atau tujuan tidak valid untuk menghitung jarak.');
  }

  const deltaLat = toRadians(to.latitude - from.latitude);
  const deltaLon = toRadians(to.longitude - from.longitude);
  const lat1 = toRadians(from.latitude);
  const lat2 = toRadians(to.latitude);

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1) *
      Math.cos(lat2) *
      Math.sin(deltaLon / 2) *
      Math.sin(deltaLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_METERS * c;
}

/**
 * Memetakan error dari `expo-location` atau Geolocation Web menjadi pesan yang jelas.
 */
export function formatLocationErrorMessage(error: unknown): string {
  const rawMessage =
    typeof error === 'string'
      ? error
      : error instanceof Error
        ? error.message
        : '';
  const rawCode =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: unknown }).code ?? '')
      : '';

  const normalized = `${rawCode} ${rawMessage}`.toLowerCase();

  if (
    normalized.includes('permission') ||
    normalized.includes('unauthorized') ||
    normalized.includes('not authorized') ||
    normalized.includes('denied')
  ) {
    return 'Izin akses lokasi ditolak. Aktifkan izin lokasi pada pengaturan perangkat.';
  }

  if (
    normalized.includes('services_disabled') ||
    normalized.includes('location services') ||
    normalized.includes('unsatisfied device settings') ||
    normalized.includes('provider is disabled')
  ) {
    return 'Layanan lokasi (GPS) perangkat sedang nonaktif. Aktifkan GPS terlebih dahulu.';
  }

  if (normalized.includes('timeout')) {
    return 'Waktu pencarian lokasi habis. Pastikan sinyal GPS memadai lalu coba lagi.';
  }

  if (normalized.includes('unavailable')) {
    return 'Lokasi perangkat saat ini tidak tersedia. Pastikan GPS aktif dan coba lagi.';
  }

  return rawMessage.trim()
    ? rawMessage.trim()
    : 'Gagal memperoleh lokasi perangkat saat ini.';
}

function formatWebGeolocationError(error: GeolocationPositionError): string {
  if (error.code === error.PERMISSION_DENIED) {
    return 'Izin akses lokasi browser ditolak. Aktifkan izin lokasi pada situs ini.';
  }
  if (error.code === error.POSITION_UNAVAILABLE) {
    return 'Informasi lokasi perangkat tidak tersedia saat ini.';
  }
  if (error.code === error.TIMEOUT) {
    return 'Waktu pencarian lokasi habis. Silakan coba lagi.';
  }
  return formatLocationErrorMessage(error.message);
}

/**
 * Memeriksa apakah layanan lokasi / GPS di perangkat sedang aktif.
 */
export async function checkLocationServicesEnabled(): Promise<boolean> {
  if (Platform.OS === 'web') {
    return typeof navigator !== 'undefined' && 'geolocation' in navigator;
  }

  return Location.hasServicesEnabledAsync();
}

/**
 * Mengecek status izin lokasi foreground tanpa memunculkan dialog sistem.
 */
export async function getForegroundLocationPermission(): Promise<LocationPermissionResult> {
  if (Platform.OS === 'web') {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      return { status: 'denied', canAskAgain: false };
    }

    if (typeof navigator.permissions?.query !== 'function') {
      return { status: 'denied', canAskAgain: true };
    }

    const permission = await navigator.permissions.query({
      name: 'geolocation',
    });

    if (permission.state === 'granted') {
      return { status: 'granted', canAskAgain: true };
    }
    if (permission.state === 'denied') {
      return { status: 'denied', canAskAgain: false };
    }
    return { status: 'denied', canAskAgain: true };
  }

  const response = await Location.getForegroundPermissionsAsync();
  const isGranted =
    response.granted || response.status === Location.PermissionStatus.GRANTED;

  return {
    status: isGranted ? 'granted' : 'denied',
    canAskAgain: response.canAskAgain,
  };
}

/**
 * Memeriksa dan meminta izin lokasi foreground (`whenInUse`) secara konsisten
 * untuk Android, iOS, dan Web.
 */
export async function requestForegroundLocationPermission(): Promise<LocationPermissionResult> {
  if (Platform.OS === 'web') {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      return { status: 'denied', canAskAgain: false };
    }

    if (typeof navigator.permissions?.query === 'function') {
      const existing = await navigator.permissions.query({
        name: 'geolocation',
      });
      if (existing.state === 'granted') {
        return { status: 'granted', canAskAgain: true };
      }
      if (existing.state === 'denied') {
        return { status: 'denied', canAskAgain: false };
      }
    }

    return new Promise<LocationPermissionResult>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        () => {
          resolve({ status: 'granted', canAskAgain: true });
        },
        (positionError) => {
          if (positionError.code === positionError.PERMISSION_DENIED) {
            resolve({ status: 'denied', canAskAgain: false });
            return;
          }
          // Timeout/unavailable bukan berarti user menolak izin di prompt browser.
          resolve({ status: 'granted', canAskAgain: true });
        },
        { timeout: 8000 },
      );
    });
  }

  const existing = await Location.getForegroundPermissionsAsync();
  const alreadyGranted =
    existing.granted || existing.status === Location.PermissionStatus.GRANTED;

  if (alreadyGranted) {
    return { status: 'granted', canAskAgain: existing.canAskAgain };
  }

  if (
    existing.status === Location.PermissionStatus.DENIED &&
    !existing.canAskAgain
  ) {
    return { status: 'denied', canAskAgain: false };
  }

  const requested = await Location.requestForegroundPermissionsAsync();
  const isGranted =
    requested.granted || requested.status === Location.PermissionStatus.GRANTED;

  return {
    status: isGranted ? 'granted' : 'denied',
    canAskAgain: requested.canAskAgain,
  };
}

/**
 * Mengambil posisi terakhir perangkat dari cache OS jika cukup baru dan akurat,
 * sebagai tampilan awal cepat sebelum fix GPS live diterima.
 */
export async function getQuickLastKnownUserLocation(
  options: Location.LocationLastKnownOptions = DEFAULT_LAST_KNOWN_OPTIONS,
): Promise<UserLocationCoordinates | null> {
  if (Platform.OS === 'web') {
    return null;
  }

  const lastKnown = await Location.getLastKnownPositionAsync(options);
  if (!lastKnown) {
    return null;
  }

  return toUserLocationCoordinates(lastKnown.coords);
}

/**
 * Mengambil posisi perangkat satu kali (misal untuk validasi presensi).
 */
export async function getCurrentUserLocation(
  options: WatchUserLocationOptions = {},
): Promise<UserLocationCoordinates> {
  if (Platform.OS === 'web') {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      throw new Error('Geolocation tidak tersedia di browser ini.');
    }

    const accuracy = options.accuracy ?? DEFAULT_WATCH_OPTIONS.accuracy;
    return new Promise<UserLocationCoordinates>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const normalized = toUserLocationCoordinates(position.coords);
          if (!normalized) {
            reject(new Error('Koordinat lokasi dari browser tidak valid.'));
            return;
          }
          resolve(normalized);
        },
        (positionError) => {
          reject(new Error(formatWebGeolocationError(positionError)));
        },
        {
          enableHighAccuracy: accuracy > Location.LocationAccuracy.Balanced,
          timeout: 15_000,
          maximumAge: 5_000,
        },
      );
    });
  }

  const current = await Location.getCurrentPositionAsync({
    accuracy: options.accuracy ?? DEFAULT_WATCH_OPTIONS.accuracy,
    mayShowUserSettingsDialog:
      options.mayShowUserSettingsDialog ??
      DEFAULT_WATCH_OPTIONS.mayShowUserSettingsDialog,
  });

  const normalized = toUserLocationCoordinates(current.coords);
  if (!normalized) {
    throw new Error('Koordinat lokasi dari perangkat tidak valid.');
  }

  return normalized;
}

/**
 * Memulai pemantauan perubahan lokasi perangkat secara real-time saat aplikasi aktif di foreground.
 * Caller wajib memanggil `subscription.remove()` saat berhenti memantau.
 */
export async function watchUserLocation(
  onUpdate: (coords: UserLocationCoordinates) => void,
  onError?: (errorMessage: string) => void,
  options: WatchUserLocationOptions = {},
): Promise<LocationWatchSubscription> {
  const accuracy = options.accuracy ?? DEFAULT_WATCH_OPTIONS.accuracy;

  if (Platform.OS === 'web') {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      throw new Error('Geolocation tidak tersedia di browser ini.');
    }

    let removed = false;
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        if (removed) return;
        const normalized = toUserLocationCoordinates(position.coords);
        if (normalized) {
          onUpdate(normalized);
        }
      },
      (positionError) => {
        if (removed) return;
        onError?.(formatWebGeolocationError(positionError));
      },
      {
        enableHighAccuracy: accuracy > Location.LocationAccuracy.Balanced,
        timeout: 15_000,
        maximumAge: 5_000,
      },
    );

    return {
      remove: () => {
        if (removed) return;
        removed = true;
        navigator.geolocation.clearWatch(watchId);
      },
    };
  }

  const subscription = await Location.watchPositionAsync(
    {
      accuracy,
      timeInterval: options.timeInterval ?? DEFAULT_WATCH_OPTIONS.timeInterval,
      distanceInterval:
        options.distanceInterval ?? DEFAULT_WATCH_OPTIONS.distanceInterval,
      mayShowUserSettingsDialog:
        options.mayShowUserSettingsDialog ??
        DEFAULT_WATCH_OPTIONS.mayShowUserSettingsDialog,
    },
    (location) => {
      const normalized = toUserLocationCoordinates(location.coords);
      if (normalized) {
        onUpdate(normalized);
      }
    },
    (rawError) => {
      onError?.(formatLocationErrorMessage(rawError));
    },
  );

  let removed = false;
  return {
    remove: () => {
      if (removed) return;
      removed = true;
      subscription.remove();
    },
  };
}

/**
 * Membuka pengaturan aplikasi di OS agar pengguna dapat mengaktifkan izin lokasi yang ditolak permanen.
 */
export async function openAppLocationSettings(): Promise<void> {
  await Linking.openSettings();
}
