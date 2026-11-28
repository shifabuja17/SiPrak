import { router, Stack } from 'expo-router';
import {
  ActivityIndicator,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FONT } from '@/constants/fonts';
import { useAuth } from '@/context/AuthContext';
import { PillButton, UI } from '@/features/praktikan/ui/praktikan-ui';

function isAslabRole(rawRole: unknown): boolean {
  return typeof rawRole === 'string' && rawRole.trim().toUpperCase() === 'ASLAB';
}

/**
 * Navigator khusus untuk role Aslab (`ASLAB`) dengan proteksi rute di tingkat grup.
 */
export default function AslabNavigator() {
  const { profile, loading } = useAuth();

  if (loading) {
    return (
      <SafeAreaView style={styles.centered}>
        <StatusBar barStyle="dark-content" />
        <ActivityIndicator size="large" color={UI.ink} />
        <Text style={styles.message}>Memeriksa akses portal Aslab...</Text>
      </SafeAreaView>
    );
  }

  if (!profile || !isAslabRole(profile.role)) {
    return (
      <SafeAreaView style={styles.centered}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.card}>
          <Text style={styles.title}>Akses Ditolak</Text>
          <Text style={styles.message}>
            Portal Manajemen & Bulk Laboratorium hanya dapat diakses oleh akun
            dengan peran Asisten Lab (Aslab).
          </Text>
          <PillButton label="Kembali" onPress={() => router.back()} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="bulk-laboratories" />
    </Stack>
  );
}

const styles = StyleSheet.create({
  centered: {
    alignItems: 'center',
    backgroundColor: UI.page,
    flex: 1,
    gap: 12,
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    alignItems: 'center',
    gap: 12,
    maxWidth: 340,
  },
  title: {
    color: UI.ink,
    fontFamily: FONT.extrabold,
    fontSize: 20,
  },
  message: {
    color: UI.muted,
    fontFamily: FONT.regular,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
});
