/**
 * FR-17, FR-18, NFR-04 — Siklus hidup push notification di sisi aplikasi:
 * - meminta izin & mendaftarkan token setelah pengguna login,
 * - menyimpan token ke Firestore (terhubung ke uid),
 * - menyediakan status untuk banner penjelasan,
 * - membuka halaman yang tepat ketika notifikasi diketuk.
 */
import { router, useRootNavigationState } from 'expo-router';
import * as Notifications from 'expo-notifications';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AppState, Linking, Platform } from 'react-native';

import { useAuth } from '@/context/AuthContext';

import { setCurrentDeviceToken } from '../services/device-token-store';
import { saveDeviceToken } from '../services/push-token-service';
import {
  configureNotificationHandler,
  registerForPushNotificationsAsync,
} from '../services/push-registration';
import type { PushRegistrationStatus } from '../types';

// Dipanggil sekali di global scope (sesuai dokumentasi expo-notifications).
configureNotificationHandler();

interface PushNotificationContextValue {
  status: PushRegistrationStatus;
  /** Penjelasan untuk pengguna ketika notifikasi tidak aktif. */
  message: string | null;
  /** Ulangi proses registrasi (mis. setelah jaringan pulih). */
  retry: () => void;
  /** Buka pengaturan sistem untuk mengaktifkan izin notifikasi. */
  openSettings: () => void;
}

const PushNotificationContext = createContext<PushNotificationContextValue | null>(null);

const PERMISSION_DENIED_MESSAGE =
  'Izin notifikasi dimatikan. Kamu tidak akan diberi tahu saat sesi dibuka, jadwal berubah, atau pengajuan izin diputuskan. Aktifkan lewat Pengaturan.';

function openDestination(data: Record<string, unknown> | undefined) {
  const type = typeof data?.type === 'string' ? data.type : '';
  const sessionId = typeof data?.sessionId === 'string' ? data.sessionId : '';

  try {
    if (type === 'session_opened' && sessionId) {
      router.push({ pathname: '/attendance/[sessionId]', params: { sessionId } });
    } else if (type === 'schedule_changed') {
      router.push('/(tabs)/schedule');
    } else if (type === 'leave_accepted' || type === 'leave_rejected') {
      router.push('/(tabs)/leave');
    }
  } catch (error) {
    console.warn('Gagal membuka halaman dari notifikasi:', error);
  }
}

export function PushNotificationProvider({ children }: { children: ReactNode }) {
  const { user, profile, status: authStatus } = useAuth();
  const navigationState = useRootNavigationState();

  const [status, setStatus] = useState<PushRegistrationStatus>('idle');
  const [message, setMessage] = useState<string | null>(null);

  const uid = user?.uid ?? null;
  const role = profile?.role ?? null;

  // ========================================
  // REGISTRASI TOKEN
  // ========================================

  const register = useCallback(async () => {
    if (!uid || !role) return;

    setStatus('registering');
    setMessage(null);

    const result = await registerForPushNotificationsAsync();

    if (result.status === 'registered') {
      try {
        await saveDeviceToken(uid, role, result.token, Platform.OS);
        setCurrentDeviceToken(result.token);
        setStatus('registered');
      } catch (error) {
        console.warn('Gagal menyimpan token perangkat:', error);
        setStatus('error');
        setMessage(
          'Notifikasi belum aktif karena token perangkat gagal disimpan. Periksa koneksi internet lalu coba lagi.',
        );
      }
      return;
    }

    if (result.status === 'permission_denied') {
      setStatus('permission_denied');
      setMessage(PERMISSION_DENIED_MESSAGE);
      return;
    }

    if (result.status === 'unsupported') {
      setStatus('unsupported');
      setMessage(result.reason);
      return;
    }

    setStatus('error');
    setMessage(result.message);
  }, [uid, role]);

  useEffect(() => {
    if (!uid || !role) {
      setStatus('idle');
      setMessage(null);
      return;
    }

    void register();
  }, [uid, role, register]);

  // Pengguna mungkin mengaktifkan izin lewat Pengaturan lalu kembali ke aplikasi.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active' && (status === 'permission_denied' || status === 'error')) {
        void register();
      }
    });
    return () => subscription.remove();
  }, [status, register]);

  // ========================================
  // NOTIFIKASI DIKETUK -> BUKA HALAMAN
  // ========================================

  const pendingResponseRef = useRef<Notifications.NotificationResponse | null>(null);
  const handledIdsRef = useRef<Set<string>>(new Set());
  const ready = authStatus === 'authenticated' && !!navigationState?.key;

  const handleResponse = useCallback((response: Notifications.NotificationResponse) => {
    const id = response.notification.request.identifier;
    if (handledIdsRef.current.has(id)) return;
    handledIdsRef.current.add(id);

    openDestination(response.notification.request.content.data);
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web') return;

    // Aplikasi dibuka dari keadaan mati lewat ketukan notifikasi.
    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) pendingResponseRef.current = response;
    });

    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      pendingResponseRef.current = response;
    });

    return () => subscription.remove();
  }, []);

  // Respons baru ditangani setelah pengguna login & navigasi siap.
  useEffect(() => {
    if (!ready) return;

    const flush = () => {
      const pending = pendingResponseRef.current;
      if (!pending) return;
      pendingResponseRef.current = null;
      handleResponse(pending);
    };

    flush();
    const interval = setInterval(flush, 400);
    return () => clearInterval(interval);
  }, [ready, handleResponse]);

  // ========================================
  // VALUE
  // ========================================

  const value = useMemo<PushNotificationContextValue>(
    () => ({
      status,
      message,
      retry: () => {
        void register();
      },
      openSettings: () => {
        void Linking.openSettings();
      },
    }),
    [status, message, register],
  );

  return (
    <PushNotificationContext.Provider value={value}>
      {children}
    </PushNotificationContext.Provider>
  );
}

export function usePushNotifications(): PushNotificationContextValue {
  const context = useContext(PushNotificationContext);

  if (!context) {
    throw new Error('usePushNotifications harus dipakai di dalam <PushNotificationProvider>.');
  }

  return context;
}
