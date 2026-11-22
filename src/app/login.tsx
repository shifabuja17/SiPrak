import { router } from 'expo-router';
import { useState } from 'react';

import {
  AuthButton,
  AuthError,
  AuthField,
  AuthLink,
  AuthShell,
} from '@/components/auth/auth-form';
import { useAuth } from '@/context/AuthContext';

export default function LoginScreen() {
  const { user, profile, profileError, loading, login, logout } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Akun ada di Firebase Auth tapi tidak punya dokumen profil (users/{uid}),
  // misalnya dibuat manual lewat Console. Hanya dinilai SETELAH loading selesai:
  // sesaat setelah login, user sudah ada tetapi profil masih diambil dari Firestore.
  const accountWithoutProfile = !loading && !!user && !profile;

  // Tetap tampilkan indikator loading selama profil masih dimuat setelah login.
  const busy = submitting || (loading && !!user);

  async function handleLogin() {
    setError('');
    setSubmitting(true);
    try {
      await login(email, password);
      // Berhasil: guard di _layout otomatis memindahkan ke aplikasi.
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal masuk.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleLogout() {
    setError('');
    try {
      await logout();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal keluar.');
    }
  }

  if (accountWithoutProfile) {
    return (
      <AuthShell
        title="Profil Tidak Ditemukan"
        subtitle="Akunmu sudah terdaftar, tetapi data profil dan perannya belum tersedia."
      >
        <AuthError
          message={
            profileError ??
            'Hubungi asisten/admin, atau keluar lalu daftar ulang dengan email lain.'
          }
        />
        <AuthButton title="Keluar" onPress={handleLogout} variant="secondary" />
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Selamat Datang di SiPrak"
      subtitle="Silakan masuk untuk melanjutkan."
    >
      <AuthField
        label="Email"
        value={email}
        onChangeText={setEmail}
        placeholder="nama@email.com"
        autoCapitalize="none"
        autoComplete="email"
        autoCorrect={false}
        keyboardType="email-address"
        textContentType="emailAddress"
        editable={!busy}
      />

      <AuthField
        label="Password"
        value={password}
        onChangeText={setPassword}
        placeholder="Password"
        autoCapitalize="none"
        autoComplete="current-password"
        secureTextEntry
        textContentType="password"
        editable={!busy}
        onSubmitEditing={handleLogin}
        returnKeyType="go"
      />

      <AuthError message={error} />

      <AuthButton title="Masuk" onPress={handleLogin} loading={busy} />

      <AuthLink
        prompt="Belum punya akun?"
        action="Daftar di sini"
        onPress={() => router.replace('/register')}
      />

    </AuthShell>
  );
}