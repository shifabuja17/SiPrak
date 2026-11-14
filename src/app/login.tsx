import { router } from 'expo-router';
import { useState } from 'react';
import { Text } from 'react-native';

import {
  AuthButton,
  AuthError,
  AuthField,
  AuthLink,
  AuthShell,
} from '@/components/auth/auth-form';
import { useAuth } from '@/context/AuthContext';

export default function LoginScreen() {
  const { user, profile, profileError, login, logout } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Akun ada di Firebase Auth tapi tidak punya dokumen profil (users/{uid}),
  // misalnya dibuat manual lewat Console. Tanpa profil, role tidak diketahui.
  const accountWithoutProfile = !!user && !profile;

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
      title="Selamat Datang!"
      subtitle="Masuk dengan akun SiPrak untuk melanjutkan."
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
        editable={!submitting}
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
        editable={!submitting}
        onSubmitEditing={handleLogin}
        returnKeyType="go"
      />

      <AuthError message={error} />

      <AuthButton title="Masuk" onPress={handleLogin} loading={submitting} />

      <AuthLink
        prompt="Belum punya akun?"
        action="Daftar"
        onPress={() => router.replace('/register')}
      />

      <Text
        style={{ color: '#777777', fontSize: 12, textAlign: 'center' }}
      >
        Peran (asisten/praktikan) mengikuti akun yang kamu gunakan.
      </Text>
    </AuthShell>
  );
}
