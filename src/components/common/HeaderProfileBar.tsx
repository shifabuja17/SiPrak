import { router } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useAuth } from '@/context/AuthContext';
import { usePracticum } from '@/context/PracticumContext';

export default function HeaderProfileBar() {
  const { profile, logout } = useAuth();
  const { currentUser } = usePracticum();
  const [loggingOut, setLoggingOut] = useState(false);

  const isFirebaseAuthenticated = profile !== null;
  const displayName = profile ? profile.nama : currentUser.name;
  const roleLabel = profile
    ? profile.role === 'asisten'
      ? 'Asisten Praktikum'
      : 'Praktikan'
    : currentUser.role === 'ASISTEN'
      ? 'Asisten Praktikum'
      : 'Praktikan';
  const displayNim = profile ? (profile.nim ?? '-') : currentUser.nim;

  function confirmLogout() {
    Alert.alert('Keluar', 'Yakin ingin keluar dari akun ini?', [
      { text: 'Batal', style: 'cancel' },
      { text: 'Keluar', style: 'destructive', onPress: () => void handleLogout() },
    ]);
  }

  async function handleLogout() {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await logout();
    } catch (err) {
      Alert.alert(
        'Gagal keluar',
        err instanceof Error ? err.message : 'Terjadi kesalahan saat logout.',
      );
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>
          {displayName.charAt(0).toUpperCase() || '?'}
        </Text>
      </View>

      <View style={styles.profileDetails}>
        <Text style={styles.name}>
          {displayName}
        </Text>

        <Text style={styles.role}>
          {roleLabel}
        </Text>

        <Text style={styles.nim}>
          {displayNim}
        </Text>
      </View>

      {isFirebaseAuthenticated ? (
        <Pressable
          accessibilityRole="button"
          disabled={loggingOut}
          onPress={confirmLogout}
          style={({ pressed }) => [
            styles.logoutButton,
            pressed && !loggingOut && styles.pressed,
            loggingOut && styles.disabled,
          ]}
        >
          <Text style={styles.logoutText}>
            {loggingOut ? 'Keluar...' : 'Keluar'}
          </Text>
        </Pressable>
      ) : (
        <Pressable
          onPress={() => router.push('/role-switcher')}
          style={({ pressed }) => [
            styles.switchButton,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.switchText}>
            Ganti akun
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#D9D9D9',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 11,
    padding: 13,
  },
  avatar: {
    alignItems: 'center',
    backgroundColor: '#E5E5E5',
    borderRadius: 19,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  avatarText: {
    color: '#000000',
    fontWeight: '800',
  },
  profileDetails: {
    flex: 1,
    gap: 2,
  },
  name: {
    color: '#000000',
    fontSize: 13,
    fontWeight: '700',
  },
  role: {
    color: '#666666',
    fontSize: 12,
    marginTop: 2,
  },
  nim: {
    color: '#666666',
    fontSize: 11,
  },
  switchButton: {
    paddingVertical: 8,
    paddingLeft: 4,
  },
  switchText: {
    color: '#000000',
    fontSize: 12,
    fontWeight: '700',
  },
  logoutButton: {
    backgroundColor: '#F2F2F2',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  logoutText: {
    color: '#B91C1C',
    fontSize: 12,
    fontWeight: '700',
  },
  disabled: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.6,
  },
});