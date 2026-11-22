import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  createUserWithEmailAndPassword,
  deleteUser,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from 'firebase/auth';

import {
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';

import { unregisterDeviceForUser } from '../features/notifications/services/push-token-service';
import { auth, db } from '../lib/firebase';
import type { Role, UserProfile } from '../types/user';

// ==========================================
// TIPE AUTENTIKASI
// ==========================================

export type AuthStatus =
  | 'loading'
  | 'unauthenticated'
  | 'authenticated';

interface AuthContextValue {
  user: User | null;
  profile: UserProfile | null;
  role: Role | null;
  status: AuthStatus;
  loading: boolean;
  profileError: string | null;

  register: (input: RegisterInput) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

export interface RegisterInput {
  nama: string;
  email: string;
  password: string;
  nim?: string;
}

const AuthContext = createContext<AuthContextValue | undefined>(
  undefined,
);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ==========================================
// VALIDASI ROLE
// ==========================================

function isValidRole(value: unknown): value is Role {
  return value === 'asisten' || value === 'praktikan';
}

// ==========================================
// PESAN ERROR FIREBASE
// ==========================================

export function authErrorMessage(error: unknown): string {
  const code = (error as { code?: string })?.code;

  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/user-not-found':
    case 'auth/wrong-password':
      return 'Email atau password salah.';

    case 'auth/invalid-email':
      return 'Format email tidak valid.';

    case 'auth/email-already-in-use':
      return 'Email sudah terdaftar. Silakan login.';

    case 'auth/weak-password':
      return 'Password terlalu lemah (minimal 6 karakter).';

    case 'auth/too-many-requests':
      return 'Terlalu banyak percobaan. Coba lagi beberapa saat.';

    case 'auth/network-request-failed':
      return 'Koneksi bermasalah. Periksa internet kamu.';

    case 'auth/user-disabled':
      return 'Akun ini dinonaktifkan.';

    case 'permission-denied':
    case 'firestore/permission-denied':
      return 'Kamu tidak punya izin untuk tindakan ini.';

    case 'unavailable':
    case 'firestore/unavailable':
      return 'Layanan tidak dapat dijangkau. Periksa koneksi internet.';
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return 'Terjadi kesalahan. Silakan coba lagi.';
}

// ==========================================
// AUTH PROVIDER
// ==========================================

export function AuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  const [registering, setRegistering] = useState(false);

  // ========================================
  // 1. MEMANTAU STATUS LOGIN FIREBASE
  // ========================================

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      (currentUser) => {
        setUser(currentUser);
        setAuthReady(true);

        if (!currentUser) {
          // Pengguna belum login atau sudah logout.
          setProfile(null);
          setProfileError(null);
          setProfileLoading(false);
        } else {
          // Hapus profil lama agar tidak tertukar
          // ketika pengguna berganti akun.
          setProfile(null);
          setProfileError(null);
          setProfileLoading(true);
        }
      },
    );

    return unsubscribe;
  }, []);

  // ========================================
  // 2. MEMBACA PROFIL DARI FIRESTORE
  // ========================================

  useEffect(() => {
    if (!user) {
      setProfile(null);
      setProfileLoading(false);
      return;
    }

    setProfileLoading(true);
    setProfileError(null);

    const profileRef = doc(db, 'users', user.uid);

    const unsubscribe = onSnapshot(
      profileRef,
      (snapshot) => {
        if (!snapshot.exists()) {
          setProfile(null);
          setProfileError(
            'Profil pengguna belum tersedia di Firestore.',
          );
          setProfileLoading(false);
          return;
        }

        const data = snapshot.data();

        // Pastikan role sesuai dengan tipe aplikasi.
        if (!isValidRole(data.role)) {
          setProfile(null);
          setProfileError(
            'Role akun tidak valid. Periksa field role pada dokumen Firestore.',
          );
          setProfileLoading(false);
          return;
        }

        // Mengambil nama dari Firestore.
        // Field nama menjadi prioritas utama.
        const nameCandidates: unknown[] = [
          data.nama,
          data.name,
          data.displayName,
          user.displayName,
        ];

        const selectedName = nameCandidates.find(
          (value): value is string =>
            typeof value === 'string' &&
            value.trim().length > 0,
        );

        const nama = selectedName?.trim() ?? '';

        // Mengambil email dan NIM.
        const email =
          typeof data.email === 'string' &&
          data.email.trim().length > 0
            ? data.email.trim()
            : user.email ?? '';

        const nim =
          typeof data.nim === 'string' &&
          data.nim.trim().length > 0
            ? data.nim.trim()
            : null;

        // Menyimpan profil terbaru ke Context.
        setProfile({
          uid: user.uid,
          nama,
          email,
          nim,
          role: data.role,
        });

        setProfileError(null);
        setProfileLoading(false);
      },
      (error) => {
        console.error(
          'Gagal mengambil profil pengguna:',
          error,
        );

        setProfile(null);
        setProfileError(authErrorMessage(error));
        setProfileLoading(false);
      },
    );

    return unsubscribe;
  }, [user]);

  // ========================================
  // 3. REGISTRASI PRAKTIKAN
  // ========================================

  const register = useCallback(
    async (input: RegisterInput) => {
      const nama = input.nama.trim();
      const email = input.email.trim().toLowerCase();
      const nim = input.nim?.trim() || null;

      if (!nama) {
        throw new Error('Nama wajib diisi.');
      }

      if (!EMAIL_RE.test(email)) {
        throw new Error('Format email tidak valid.');
      }

      if (input.password.length < 6) {
        throw new Error('Password minimal 6 karakter.');
      }

      setRegistering(true);

      try {
        // Membuat akun Firebase Authentication.
        const credential =
          await createUserWithEmailAndPassword(
            auth,
            email,
            input.password,
          );

        try {
          // Membuat profil pengguna di Firestore.
          // Registrasi mandiri selalu menjadi Praktikan.
          await setDoc(
            doc(db, 'users', credential.user.uid),
            {
              nama,
              email,
              nim,
              role: 'praktikan',
              createdAt: serverTimestamp(),
            },
          );
        } catch (error) {
          // Menghapus akun Auth jika profil gagal dibuat.
          await deleteUser(credential.user).catch(() => {});
          throw error;
        }
      } catch (error) {
        throw new Error(authErrorMessage(error));
      } finally {
        setRegistering(false);
      }
    },
    [],
  );

  // ========================================
  // 4. LOGIN
  // ========================================

  const login = useCallback(
    async (email: string, password: string) => {
      const normalizedEmail = email.trim().toLowerCase();

      if (!EMAIL_RE.test(normalizedEmail)) {
        throw new Error('Format email tidak valid.');
      }

      if (!password) {
        throw new Error('Password wajib diisi.');
      }

      try {
        await signInWithEmailAndPassword(
          auth,
          normalizedEmail,
          password,
        );
      } catch (error) {
        throw new Error(authErrorMessage(error));
      }
    },
    [],
  );

  // ========================================
  // 5. LOGOUT
  // ========================================

  const logout = useCallback(async () => {
    try {
      // Lepas token notifikasi perangkat ini dari akun sebelum sesi login berakhir.
      if (user) {
        await unregisterDeviceForUser(user.uid);
      }

      await signOut(auth);
    } catch (error) {
      throw new Error(authErrorMessage(error));
    }
  }, [user]);

  // ========================================
  // 6. STATUS AUTENTIKASI
  // ========================================

  const loading =
    !authReady ||
    registering ||
    (!!user && profileLoading);

  const status: AuthStatus = loading
    ? 'loading'
    : user && profile
      ? 'authenticated'
      : 'unauthenticated';

  // ========================================
  // 7. VALUE CONTEXT
  // ========================================

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      profile,
      role: profile?.role ?? null,
      status,
      loading,
      profileError,
      register,
      login,
      logout,
    }),
    [
      user,
      profile,
      status,
      loading,
      profileError,
      register,
      login,
      logout,
    ],
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// ==========================================
// CUSTOM HOOK
// ==========================================

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error(
      'useAuth harus dipakai di dalam <AuthProvider>.',
    );
  }

  return context;
}