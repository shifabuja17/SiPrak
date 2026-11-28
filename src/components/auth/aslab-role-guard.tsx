import { useRouter, type Href } from 'expo-router';
import { useEffect, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, StatusBar, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FONT } from '@/constants/fonts';
import { useAuth } from '@/context/AuthContext';
import { getHomeRouteForRole, isAslabRole } from '@/types/user';

interface AslabRoleGuardProps {
  children: ReactNode;
  featureName?: string;
  autoRedirectMs?: number;
}

/**
 * Guard akses rute khusus Aslab: menolak peran non-Aslab dengan pesan yang jelas
 * dan mengarahkan ulang ke beranda sesuai peran akun.
 */
export default function AslabRoleGuard({
  children,
  featureName = 'Manajemen Laboratorium',
  autoRedirectMs = 1800,
}: AslabRoleGuardProps) {
  const { status, loading, role } = useAuth();
  const router = useRouter();

  const isAuthLoading = loading || status === 'loading';
  const allowed = !isAuthLoading && isAslabRole(role);
  const fallbackHref = (
    status !== 'authenticated' ? '/login' : getHomeRouteForRole(role)
  ) as Href;

  useEffect(() => {
    if (isAuthLoading || allowed) {
      return;
    }

    const timer = setTimeout(() => {
      router.replace(fallbackHref);
    }, autoRedirectMs);

    return () => clearTimeout(timer);
  }, [isAuthLoading, allowed, autoRedirectMs, fallbackHref, router]);

  if (isAuthLoading) {
    return (
      <SafeAreaView style={styles.centered}>
        <StatusBar barStyle="dark-content" />
        <ActivityIndicator size="large" color="#111014" />
        <Text style={styles.mutedText}>Memeriksa hak akses...</Text>
      </SafeAreaView>
    );
  }

  if (!allowed) {
    return (
      <SafeAreaView style={styles.centered}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.card}>
          <Text style={styles.title}>Akses Ditolak</Text>
          <Text style={styles.message}>
            {`Fitur ${featureName} hanya dapat diakses oleh Asisten Lab (Aslab). Kamu akan diarahkan kembali ke beranda sesuai peran akunmu.`}
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.replace(fallbackHref)}
            style={({ pressed }) => [styles.button, pressed && styles.pressed]}
          >
            <Text style={styles.buttonText}>Kembali ke Beranda</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  centered: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    flex: 1,
    gap: 12,
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#D9D9D9',
    borderRadius: 20,
    borderWidth: 1,
    gap: 12,
    maxWidth: 380,
    padding: 24,
    width: '100%',
  },
  title: {
    fontFamily: FONT.extrabold,
    color: '#111014',
    fontSize: 20,
    textAlign: 'center',
  },
  message: {
    fontFamily: FONT.regular,
    color: '#5F5F66',
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
  },
  mutedText: {
    fontFamily: FONT.regular,
    color: '#5F5F66',
    fontSize: 13,
    textAlign: 'center',
  },
  button: {
    alignItems: 'center',
    backgroundColor: '#F47321',
    borderRadius: 999,
    justifyContent: 'center',
    marginTop: 4,
    minHeight: 46,
    paddingHorizontal: 22,
    paddingVertical: 12,
    width: '100%',
  },
  buttonText: {
    fontFamily: FONT.bold,
    color: '#FFFFFF',
    fontSize: 14,
  },
  pressed: {
    opacity: 0.72,
  },
});
