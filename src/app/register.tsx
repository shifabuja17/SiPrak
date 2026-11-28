import { router } from 'expo-router';
import { useState } from 'react';

import {
  AuthButton,
  AuthError,
  AuthField,
  AuthLink,
  AuthRoleSelector,
  AuthShell,
} from '@/components/auth/auth-form';
import { useAuth } from '@/context/AuthContext';
import { ROLES, type Role } from '@/types/user';

const NIM_PATTERN = /^\d{6,20}$/;

export default function RegisterScreen() {
  const { register } = useAuth();

  const [role, setRole] = useState<Role>(ROLES.PRAKTIKAN);
  const [nama, setNama] = useState('');
  const [nim, setNim] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isNimOptional = role === ROLES.ASLAB;

  /** Validasi sisi klien; validasi email, password, & role dasar ada juga di AuthContext. */
  function validate(): string {
    if (!nama.trim()) return 'Nama lengkap wajib diisi.';
    const trimmedNim = nim.trim();
    if (!isNimOptional || trimmedNim.length > 0) {
      if (!NIM_PATTERN.test(trimmedNim)) {
        return 'NIM harus berupa angka (6-20 digit).';
      }
    }
    if (password !== confirmPassword) {
      return 'Konfirmasi password tidak sama.';
    }
    return '';
  }

  async function handleRegister() {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setError('');
    setSubmitting(true);
    try {
      await register({ nama, nim, email, password, role });
      // Berhasil: pengguna otomatis login, guard di _layout memindahkan ke aplikasi.
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal mendaftar.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell
      title="Daftar Akun"
      subtitle="Buat akun SiPrak sesuai peranmu untuk mengikuti atau mengelola kegiatan praktikum."
    >
      <AuthRoleSelector
        label="Peran Akun"
        value={role}
        onChange={setRole}
        disabled={submitting}
      />

      <AuthField
        label="Nama Lengkap"
        value={nama}
        onChangeText={setNama}
        placeholder="Nama lengkap"
        autoCapitalize="words"
        autoComplete="name"
        editable={!submitting}
      />

      <AuthField
        label={isNimOptional ? 'NIM (Opsional untuk Aslab)' : 'NIM'}
        value={nim}
        onChangeText={setNim}
        placeholder="Contoh: 24060123120001"
        keyboardType="number-pad"
        editable={!submitting}
      />

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
        placeholder="Minimal 6 karakter"
        autoCapitalize="none"
        autoComplete="new-password"
        secureTextEntry
        textContentType="newPassword"
        editable={!submitting}
      />

      <AuthField
        label="Konfirmasi Password"
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        placeholder="Ulangi password"
        autoCapitalize="none"
        secureTextEntry
        editable={!submitting}
        onSubmitEditing={handleRegister}
        returnKeyType="go"
      />

      <AuthError message={error} />

      <AuthButton title="Daftar" onPress={handleRegister} loading={submitting} />

      <AuthLink
        prompt="Sudah punya akun?"
        action="Lanjut masuk"
        onPress={() => router.replace('/login')}
      />
    </AuthShell>
  );
}
