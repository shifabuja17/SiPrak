import { router } from 'expo-router';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { usePracticum } from '@/context/PracticumContext';

export default function HeaderProfileBar() {
  const { currentUser } = usePracticum();

  const roleLabel =
    currentUser.role === 'ASISTEN'
      ? 'Asisten Praktikum'
      : 'Praktikan';

  return (
    <View style={styles.container}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>
          {currentUser.name.charAt(0).toUpperCase()}
        </Text>
      </View>

      <View style={styles.profileDetails}>
        <Text style={styles.name}>
          {currentUser.name}
        </Text>

        <Text style={styles.role}>
          {roleLabel}
        </Text>

        <Text style={styles.nim}>
          {currentUser.nim}
        </Text>
      </View>

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
  pressed: {
    opacity: 0.6,
  },
});