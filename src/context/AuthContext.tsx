import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  createUserWithEmailAndPassword,
  deleteUser,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  User,
} from "firebase/auth";
import { doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import type { Role, UserProfile } from "../types/user";

export type AuthStatus = "loading" | "unauthenticated" | "authenticated";

interface AuthContextValue {
  /** Akun Firebase Auth (identitas). null jika belum login. */
  user: User | null;
  /** Dokumen users/{uid} dari Firestore (nama, role, dst). */
  profile: UserProfile | null;
  /** Shortcut: role pengguna saat ini. */
  role: Role | null;
  status: AuthStatus;
  /** true selama sesi dipulihkan / profil dimuat / registrasi berjalan. */
  loading: boolean;
  /** Pesan error pembacaan profil (mis. koneksi Firestore bermasalah). */
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

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Ubah error Firebase menjadi pesan yang bisa langsung ditampilkan ke pengguna. */
export function authErrorMessage(e: unknown): string {
  const code = (e as { code?: string })?.code;
  switch (code) {
    case "auth/invalid-credential":
    case "auth/user-not-found":
    case "auth/wrong-password":
      return "Email atau password salah.";
    case "auth/invalid-email":
      return "Format email tidak valid.";
    case "auth/email-already-in-use":
      return "Email sudah terdaftar. Silakan login.";
    case "auth/weak-password":
      return "Password terlalu lemah (minimal 6 karakter).";
    case "auth/too-many-requests":
      return "Terlalu banyak percobaan. Coba lagi beberapa saat.";
    case "auth/network-request-failed":
      return "Koneksi bermasalah. Periksa internet kamu.";
    case "auth/user-disabled":
      return "Akun ini dinonaktifkan.";
    case "permission-denied":
    case "firestore/permission-denied":
      return "Kamu tidak punya izin untuk tindakan ini.";
    case "unavailable":
    case "firestore/unavailable":
      return "Layanan tidak dapat dijangkau. Periksa koneksi internet.";
  }
  if (e instanceof Error && e.message) return e.message;
  return "Terjadi kesalahan. Coba lagi.";
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false); // sesi tersimpan sudah dipulihkan?
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [registering, setRegistering] = useState(false);

  // 1) Pemulihan status login (FR: data tetap ada setelah app dibuka kembali)
  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthReady(true);
      if (!u) {
        setProfile(null);
        setProfileError(null);
        setProfileLoading(false);
      } else {
        setProfileLoading(true);
      }
    });
  }, []);

  // 2) Ambil profil + role secara real-time. Memakai onSnapshot (bukan getDoc)
  //    supaya saat registrasi dokumen baru ditulis, UI ikut terbarui sendiri.
  useEffect(() => {
    if (!user) return;
    const ref = doc(db, "users", user.uid);
    return onSnapshot(
      ref,
      (snap) => {
        if (snap.exists()) {
          const d = snap.data();
          setProfile({
            uid: user.uid,
            nama: d.nama,
            email: d.email,
            nim: d.nim ?? null,
            role: d.role,
          });
        } else {
          setProfile(null);
        }
        setProfileError(null);
        setProfileLoading(false);
      },
      (err) => {
        setProfile(null);
        setProfileError(authErrorMessage(err));
        setProfileLoading(false);
      }
    );
  }, [user]);

  const register = useCallback(async (input: RegisterInput) => {
    const nama = input.nama.trim();
    const email = input.email.trim().toLowerCase();
    const nim = input.nim?.trim() || null;

    if (!nama) throw new Error("Nama wajib diisi.");
    if (!EMAIL_RE.test(email)) throw new Error("Format email tidak valid.");
    if (input.password.length < 6) throw new Error("Password minimal 6 karakter.");

    setRegistering(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, input.password);
      try {
        // Registrasi mandiri SELALU praktikan (dipaksa juga oleh Security Rules).
        await setDoc(doc(db, "users", cred.user.uid), {
          nama,
          email,
          nim,
          role: "praktikan",
          createdAt: serverTimestamp(),
        });
      } catch (e) {
        // Hindari akun "yatim" (ada di Auth tapi tanpa profil/role).
        await deleteUser(cred.user).catch(() => {});
        throw e;
      }
    } catch (e) {
      throw new Error(authErrorMessage(e));
    } finally {
      setRegistering(false);
    }
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const e = email.trim().toLowerCase();
    if (!EMAIL_RE.test(e)) throw new Error("Format email tidak valid.");
    if (!password) throw new Error("Password wajib diisi.");
    try {
      await signInWithEmailAndPassword(auth, e, password);
    } catch (err) {
      throw new Error(authErrorMessage(err));
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await signOut(auth);
    } catch (err) {
      throw new Error(authErrorMessage(err));
    }
  }, []);

  const loading = !authReady || registering || (!!user && profileLoading);

  const status: AuthStatus = loading
    ? "loading"
    : user && profile
    ? "authenticated"
    : "unauthenticated";

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
    [user, profile, status, loading, profileError, register, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth harus dipakai di dalam <AuthProvider>.");
  return ctx;
}