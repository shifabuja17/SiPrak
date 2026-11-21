import { useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useAuth } from '@/context/AuthContext';
import { usePracticum } from '@/context/PracticumContext';
import { FONT } from '@/constants/fonts';

export default function HeaderProfileBar() {
  const { user, profile, logout } = useAuth();
  const { currentUser } = usePracticum();
  const [loggingOut, setLoggingOut] = useState(false);

  const isFirebaseAuthenticated = Boolean(user || profile);
  const displayName = profile ? profile.nama : currentUser.nama;
  const roleLabel = profile
    ? profile.role === 'asisten'
      ? 'Asisten Praktikum'
      : 'Praktikan'
    : currentUser.role === 'asisten'
      ? 'Asisten Praktikum'
      : 'Praktikan';
  const displayNim = (profile ? profile.nim : currentUser.nim) ?? '-';

  function confirmLogout() {
    if (Platform.OS === 'web') {
      const confirmed =
        typeof window !== 'undefined' && typeof window.confirm === 'function'
          ? window.confirm('Yakin ingin keluar dari akun ini?')
          : true;
      if (confirmed) {
        void handleLogout();
      }
      return;
    }

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
      const message =
        err instanceof Error ? err.message : 'Terjadi kesalahan saat logout.';
      if (
        Platform.OS === 'web' &&
        typeof window !== 'undefined' &&
        typeof window.alert === 'function'
      ) {
        window.alert(message);
      } else {
        Alert.alert('Gagal keluar', message);
      }
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
      ) : null}
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
    fontFamily: FONT.extrabold,
    color: '#000000',
  },
  profileDetails: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontFamily: FONT.bold,
    color: '#000000',
    fontSize: 13,
  },
  role: {
    fontFamily: FONT.regular,
    color: '#666666',
    fontSize: 12,
    marginTop: 2,
  },
  nim: {
    fontFamily: FONT.regular,
    color: '#666666',
    fontSize: 11,
  },
  switchButton: {
    paddingVertical: 8,
    paddingLeft: 4,
  },
  switchText: {
    fontFamily: FONT.bold,
    color: '#000000',
    fontSize: 12,
  },
  logoutButton: {
    backgroundColor: '#F2F2F2',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  logoutText: {
    fontFamily: FONT.bold,
    color: '#B91C1C',
    fontSize: 12,
  },
  disabled: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.6,
  },
});