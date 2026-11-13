import { useEffect, useState } from 'react';
import { router, type Href } from 'expo-router';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/context/AuthContext';

type FormMode = 'login' | 'register';

export default function StartScreen() {
  const {
    user,
    profile,
    loading,
    profileError,
    login,
    register,
    logout,
  } = useAuth();

  const [mode, setMode] = useState<FormMode>('login');

  const [nama, setNama] = useState('');
  const [nim, setNim] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Mengarahkan pengguna berdasarkan role dari Firestore.
  useEffect(() => {
    if (loading || !user || !profile) return;

    if (profile.role === 'asisten') {
      // Langsung masuk ke halaman Beranda Asisten.
      router.replace('/assistant/(tabs)' as Href);
    } else if (profile.role === 'praktikan') {
      // Praktikan tetap masuk ke halaman Jadwal.
      router.replace('/(tabs)/schedule');
    }
  }, [loading, user, profile]);

  // Login atau registrasi.
  async function handleSubmit() {
    setError('');

    try {
      setSubmitting(true);

      if (mode === 'register') {
        await register({
          nama,
          email,
          password,
          nim,
        });
      } else {
        await login(email, password);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Terjadi kesalahan. Silakan coba lagi.'
      );
    } finally {
      setSubmitting(false);
    }
  }

  // Logout jika akun berhasil login tetapi profil Firestore tidak tersedia.
  async function handleLogout() {
    try {
      await logout();
      setError('');
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Gagal logout.'
      );
    }
  }

  function changeMode(nextMode: FormMode) {
    setMode(nextMode);
    setError('');
  }

  // Menunggu Firebase memulihkan sesi dan membaca profil.
  if (loading || (user && profile)) {
    return (
      <SafeAreaView style={styles.centered}>
        <StatusBar barStyle="dark-content" />

        <View style={styles.logo}>
          <Text style={styles.logoText}>S</Text>
        </View>

        <ActivityIndicator
          size="large"
          color="#000000"
        />

        <Text style={styles.loadingText}>
          Memeriksa akun SiPrak...
        </Text>
      </SafeAreaView>
    );
  }

  // Akun sudah login tetapi tidak memiliki profil Firestore.
  if (user && !profile) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centered}>
          <View style={styles.logo}>
            <Text style={styles.logoText}>S</Text>
          </View>

          <Text style={styles.title}>
            Profil Tidak Ditemukan
          </Text>

          <Text style={styles.subtitle}>
            Akun Firebase berhasil login, tetapi profil pengguna
            belum tersedia atau gagal dibaca di Firestore.
          </Text>

          {profileError ? (
            <Text style={styles.errorText}>
              {profileError}
            </Text>
          ) : null}

          <Pressable
            style={styles.primaryButton}
            onPress={handleLogout}
          >
            <Text style={styles.primaryButtonText}>
              Logout
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          {/* Branding */}
          <View style={styles.brand}>
            <View style={styles.logo}>
              <Text style={styles.logoText}>S</Text>
            </View>

            <Text style={styles.appName}>
              SiPrak
            </Text>

            <Text style={styles.brandSubtitle}>
              Sistem Informasi Praktikum
            </Text>
          </View>

          {/* Heading */}
          <View style={styles.headingContainer}>
            <Text style={styles.title}>
              {mode === 'login'
                ? 'Selamat Datang!'
                : 'Buat Akun Baru'}
            </Text>

            <Text style={styles.subtitle}>
              {mode === 'login'
                ? 'Masuk ke akun SiPrak untuk mengakses kegiatan praktikum.'
                : 'Daftarkan akunmu untuk mulai menggunakan SiPrak.'}
            </Text>
          </View>

          {/* Pilihan Login dan Registrasi */}
          <View style={styles.modeContainer}>
            <Pressable
              style={[
                styles.modeButton,
                mode === 'login' && styles.modeActive,
              ]}
              onPress={() => changeMode('login')}
              disabled={submitting}
            >
              <Text
                style={[
                  styles.modeText,
                  mode === 'login' && styles.modeTextActive,
                ]}
              >
                Login
              </Text>
            </Pressable>

            <Pressable
              style={[
                styles.modeButton,
                mode === 'register' && styles.modeActive,
              ]}
              onPress={() => changeMode('register')}
              disabled={submitting}
            >
              <Text
                style={[
                  styles.modeText,
                  mode === 'register' && styles.modeTextActive,
                ]}
              >
                Registrasi
              </Text>
            </Pressable>
          </View>

          {/* Form */}
          <View style={styles.form}>
            {mode === 'register' && (
              <>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>
                    Nama Lengkap
                  </Text>

                  <TextInput
                    value={nama}
                    onChangeText={setNama}
                    placeholder="Masukkan nama lengkap"
                    placeholderTextColor="#999999"
                    style={styles.input}
                    autoCapitalize="words"
                    editable={!submitting}
                    maxLength={100}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>
                    NIM
                    <Text style={styles.optionalText}>
                      {' '} (Opsional)
                    </Text>
                  </Text>

                  <TextInput
                    value={nim}
                    onChangeText={setNim}
                    placeholder="Masukkan NIM"
                    placeholderTextColor="#999999"
                    style={styles.input}
                    keyboardType="numeric"
                    editable={!submitting}
                    maxLength={30}
                  />
                </View>
              </>
            )}

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>
                Email
              </Text>

              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="nama@email.com"
                placeholderTextColor="#999999"
                style={styles.input}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!submitting}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>
                Password
              </Text>

              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="Masukkan password"
                placeholderTextColor="#999999"
                style={styles.input}
                secureTextEntry
                autoCapitalize="none"
                editable={!submitting}
              />
            </View>
          </View>

          {/* Error */}
          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>
                {error}
              </Text>
            </View>
          ) : null}

          {/* Informasi role registrasi */}
          {mode === 'register' && (
            <View style={styles.infoBox}>
              <Text style={styles.infoText}>
                Registrasi mandiri hanya tersedia untuk Praktikan.
                Akun Asisten dibuat dan diberikan akses oleh admin.
              </Text>
            </View>
          )}

          {/* Submit */}
          <Pressable
            disabled={submitting}
            onPress={handleSubmit}
            style={({ pressed }) => [
              styles.primaryButton,
              submitting && styles.disabledButton,
              pressed && !submitting && styles.pressed,
            ]}
          >
            {submitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryButtonText}>
                {mode === 'login'
                  ? 'Masuk'
                  : 'Daftar Sebagai Praktikan'}
              </Text>
            )}
          </Pressable>

          {/* Footer */}
          <Text style={styles.footer}>
            SiPrak · Sistem Informasi Praktikum
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: '#FFFFFF',
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    gap: 22,
    padding: 22,
    paddingTop: 36,
    paddingBottom: 36,
  },
  centered: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    gap: 16,
  },
  brand: {
    alignItems: 'center',
    gap: 7,
  },
  logo: {
    alignItems: 'center',
    backgroundColor: '#000000',
    borderRadius: 16,
    height: 58,
    justifyContent: 'center',
    width: 58,
  },
  logoText: {
    color: '#FFFFFF',
    fontSize: 29,
    fontWeight: '800',
  },
  appName: {
    color: '#000000',
    fontSize: 25,
    fontWeight: '800',
  },
  brandSubtitle: {
    color: '#666666',
    fontSize: 12,
  },
  headingContainer: {
    alignItems: 'center',
    gap: 7,
  },
  title: {
    color: '#000000',
    fontSize: 25,
    fontWeight: '800',
    textAlign: 'center',
  },
  subtitle: {
    color: '#666666',
    fontSize: 13,
    lineHeight: 21,
    textAlign: 'center',
  },
  modeContainer: {
    backgroundColor: '#F2F2F2',
    borderRadius: 12,
    flexDirection: 'row',
    padding: 4,
  },
  modeButton: {
    alignItems: 'center',
    borderRadius: 9,
    flex: 1,
    padding: 12,
  },
  modeActive: {
    backgroundColor: '#FFFFFF',
  },
  modeText: {
    color: '#777777',
    fontSize: 13,
    fontWeight: '600',
  },
  modeTextActive: {
    color: '#000000',
    fontWeight: '800',
  },
  form: {
    gap: 16,
  },
  inputGroup: {
    gap: 8,
  },
  inputLabel: {
    color: '#000000',
    fontSize: 13,
    fontWeight: '700',
  },
  optionalText: {
    color: '#888888',
    fontSize: 11,
    fontWeight: '400',
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderColor: '#D9D9D9',
    borderRadius: 12,
    borderWidth: 1,
    color: '#000000',
    fontSize: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  errorBox: {
    backgroundColor: '#FEE2E2',
    borderRadius: 10,
    padding: 12,
  },
  errorText: {
    color: '#B91C1C',
    fontSize: 12,
    lineHeight: 19,
    textAlign: 'center',
  },
  infoBox: {
    backgroundColor: '#F2F2F2',
    borderRadius: 10,
    padding: 12,
  },
  infoText: {
    color: '#555555',
    fontSize: 12,
    lineHeight: 19,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#000000',
    borderRadius: 13,
    justifyContent: 'center',
    padding: 16,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  disabledButton: {
    opacity: 0.55,
  },
  pressed: {
    opacity: 0.65,
  },
  loadingText: {
    color: '#666666',
    fontSize: 13,
  },
  footer: {
    color: '#888888',
    fontSize: 11,
    textAlign: 'center',
  },
});