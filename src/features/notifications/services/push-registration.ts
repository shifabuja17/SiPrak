/**
 * FR-17 & FR-18 — Sisi perangkat: channel Android, izin notifikasi, dan token push.
 */
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { NOTIFICATION_CHANNEL_ID } from '../types';

export type RegistrationResult =
  | { status: 'registered'; token: string }
  | { status: 'permission_denied'; canAskAgain: boolean }
  | { status: 'unsupported'; reason: string }
  | { status: 'error'; message: string };

/**
 * Menentukan bagaimana notifikasi ditampilkan ketika aplikasi sedang terbuka (foreground).
 * SDK 58: `shouldShowAlert` sudah deprecated, gunakan `shouldShowBanner` + `shouldShowList`.
 */
export function configureNotificationHandler() {
  if (Platform.OS === 'web') return;

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

function resolveProjectId(): string | undefined {
  const fromExtra = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
  return fromExtra ?? Constants.easConfig?.projectId ?? undefined;
}

/** Menerjemahkan error teknis menjadi pesan yang dipahami pengguna. */
function describeRegistrationError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();

  if (lower.includes('network') || lower.includes('timeout') || lower.includes('offline')) {
    return 'Koneksi bermasalah, token notifikasi belum bisa dibuat. Periksa internet lalu coba lagi.';
  }
  if (lower.includes('firebaseapp') || lower.includes('google-services') || lower.includes('fcm')) {
    return 'Konfigurasi Firebase Cloud Messaging belum lengkap pada build aplikasi ini (google-services.json).';
  }
  if (lower.includes('experience_id') || lower.includes('projectid')) {
    return 'Project ID EAS tidak ditemukan sehingga token notifikasi tidak bisa dibuat.';
  }
  return `Gagal mengaktifkan notifikasi: ${message}`;
}

/**
 * Meminta izin notifikasi dan mengambil Expo push token perangkat ini.
 * Tidak pernah melempar error; hasilnya selalu berupa `RegistrationResult`.
 */
export async function registerForPushNotificationsAsync(): Promise<RegistrationResult> {
  if (Platform.OS === 'web') {
    return { status: 'unsupported', reason: 'Notifikasi push tidak tersedia pada versi web.' };
  }

  // Sejak SDK 53 push jarak jauh di Android tidak jalan di Expo Go.
  if (
    Platform.OS === 'android' &&
    Constants.executionEnvironment === ExecutionEnvironment.StoreClient
  ) {
    return {
      status: 'unsupported',
      reason:
        'Notifikasi push di Android tidak didukung Expo Go. Gunakan development build (eas build --profile development).',
    };
  }

  try {
    // Android 13+ baru menampilkan dialog izin setelah minimal satu channel dibuat.
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNEL_ID, {
        name: 'Informasi praktikum',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#F47321',
      });
    }

    let permission = await Notifications.getPermissionsAsync();
    if (!permission.granted && permission.canAskAgain) {
      permission = await Notifications.requestPermissionsAsync();
    }

    if (!permission.granted) {
      return { status: 'permission_denied', canAskAgain: permission.canAskAgain };
    }

    const projectId = resolveProjectId();
    const { data: token } = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );

    return { status: 'registered', token };
  } catch (error) {
    console.warn('Registrasi push notification gagal:', error);
    return { status: 'error', message: describeRegistrationError(error) };
  }
}
