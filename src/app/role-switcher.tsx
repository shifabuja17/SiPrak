import { router } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  usePracticum,
  type UserRole,
} from '@/context/PracticumContext';

export default function RoleSwitcherScreen() {
  const {
    users,
    currentUser,
    switchUser,
  } = usePracticum();

  const [selectedRole, setSelectedRole] =
    useState<UserRole>(currentUser.role);

  const [selectedUserId, setSelectedUserId] =
    useState(currentUser.id);

  const availableUsers = users.filter(
    (user) => user.role === selectedRole,
  );

  const selectedUser = availableUsers.find(
    (user) => user.id === selectedUserId,
  );

  function handleSelectRole(role: UserRole) {
    setSelectedRole(role);

    const firstUser = users.find(
      (user) => user.role === role,
    );

    if (firstUser) {
      setSelectedUserId(firstUser.id);
    }
  }

  function handleSwitchAccount() {
    if (!selectedUser) {
      Alert.alert(
        'Akun belum dipilih',
        'Pilih akun yang ingin digunakan.',
      );
      return;
    }

    try {
      switchUser(selectedUser.id);
      router.back();
    } catch (error) {
      Alert.alert(
        'Gagal mengganti akun',
        error instanceof Error
          ? error.message
          : 'Terjadi kesalahan.',
      );
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Text style={styles.backText}>
            ‹ Kembali
          </Text>
        </Pressable>

        <View style={styles.headingContainer}>
          <Text style={styles.title}>
            Ganti Akun
          </Text>

          <Text style={styles.subtitle}>
            Pilih peran dan identitas untuk mencoba
            aplikasi SiPrak.
          </Text>
        </View>

        <View style={styles.currentAccountCard}>
          <Text style={styles.sectionLabel}>
            AKUN AKTIF
          </Text>

          <Text style={styles.currentName}>
            {currentUser.name}
          </Text>

          <Text style={styles.currentDetails}>
            {currentUser.role === 'ASISTEN'
              ? 'Asisten Praktikum'
              : 'Praktikan'}
            {' · '}
            {currentUser.nim}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Pilih Peran
          </Text>

          <View style={styles.roleList}>
            {(
              ['ASISTEN', 'PRAKTIKAN'] as UserRole[]
            ).map((role) => {
              const isSelected = selectedRole === role;

              return (
                <Pressable
                  key={role}
                  onPress={() => handleSelectRole(role)}
                  style={({ pressed }) => [
                    styles.roleCard,
                    isSelected && styles.selectedCard,
                    pressed && styles.pressed,
                  ]}
                >
                  <View style={styles.roleTextContainer}>
                    <Text style={styles.roleTitle}>
                      {role === 'ASISTEN'
                        ? 'Asisten'
                        : 'Praktikan'}
                    </Text>

                    <Text style={styles.roleDescription}>
                      {role === 'ASISTEN'
                        ? 'Mengelola sesi praktikum'
                        : 'Melakukan presensi'}
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.radio,
                      isSelected && styles.radioSelected,
                    ]}
                  >
                    {isSelected && (
                      <View style={styles.radioInner} />
                    )}
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Pilih Identitas
          </Text>

          <Text style={styles.sectionDescription}>
            Pilih satu akun dari daftar berikut.
          </Text>

          <View style={styles.userList}>
            {availableUsers.map((user) => {
              const isSelected =
                selectedUserId === user.id;

              return (
                <Pressable
                  key={user.id}
                  onPress={() => setSelectedUserId(user.id)}
                  style={({ pressed }) => [
                    styles.userCard,
                    isSelected && styles.selectedCard,
                    pressed && styles.pressed,
                  ]}
                >
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>
                      {user.name.charAt(0).toUpperCase()}
                    </Text>
                  </View>

                  <View style={styles.userDetails}>
                    <Text style={styles.userName}>
                      {user.name}
                    </Text>

                    <Text style={styles.userNim}>
                      {user.nim}
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.radio,
                      isSelected && styles.radioSelected,
                    ]}
                  >
                    {isSelected && (
                      <View style={styles.radioInner} />
                    )}
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>

        <Pressable
          onPress={handleSwitchAccount}
          style={({ pressed }) => [
            styles.confirmButton,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.confirmButtonText}>
            Gunakan Akun Ini
          </Text>
        </Pressable>

        <Text style={styles.footerNote}>
          Mode demo menggunakan akun dummy.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: '#FFFFFF',
    flex: 1,
  },
  content: {
    gap: 24,
    padding: 20,
    paddingTop: 24,
    paddingBottom: 40,
  },
  backButton: {
    alignSelf: 'flex-start',
    paddingVertical: 5,
  },
  backText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '700',
  },
  headingContainer: {
    gap: 8,
  },
  title: {
    color: '#000000',
    fontSize: 28,
    fontWeight: '800',
  },
  subtitle: {
    color: '#666666',
    fontSize: 14,
    lineHeight: 21,
  },
  currentAccountCard: {
    backgroundColor: '#F2F2F2',
    borderRadius: 16,
    gap: 6,
    padding: 16,
  },
  sectionLabel: {
    color: '#666666',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  currentName: {
    color: '#000000',
    fontSize: 17,
    fontWeight: '800',
  },
  currentDetails: {
    color: '#666666',
    fontSize: 12,
    lineHeight: 18,
  },
  section: {
    gap: 12,
  },
  sectionTitle: {
    color: '#000000',
    fontSize: 17,
    fontWeight: '800',
  },
  sectionDescription: {
    color: '#666666',
    fontSize: 13,
  },
  roleList: {
    gap: 10,
  },
  roleCard: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#D9D9D9',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    padding: 16,
  },
  roleTextContainer: {
    flex: 1,
    gap: 5,
  },
  roleTitle: {
    color: '#000000',
    fontSize: 15,
    fontWeight: '700',
  },
  roleDescription: {
    color: '#666666',
    fontSize: 12,
    lineHeight: 18,
  },
  userList: {
    gap: 10,
  },
  userCard: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#D9D9D9',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 14,
  },
  selectedCard: {
    backgroundColor: '#F2F2F2',
    borderColor: '#000000',
    borderWidth: 1.5,
  },
  avatar: {
    alignItems: 'center',
    backgroundColor: '#E5E5E5',
    borderRadius: 20,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  avatarText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '800',
  },
  userDetails: {
    flex: 1,
    gap: 4,
  },
  userName: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '700',
  },
  userNim: {
    color: '#666666',
    fontSize: 12,
  },
  radio: {
    alignItems: 'center',
    borderColor: '#999999',
    borderRadius: 11,
    borderWidth: 1.5,
    height: 22,
    justifyContent: 'center',
    width: 22,
  },
  radioSelected: {
    borderColor: '#000000',
  },
  radioInner: {
    backgroundColor: '#000000',
    borderRadius: 5,
    height: 10,
    width: 10,
  },
  confirmButton: {
    alignItems: 'center',
    backgroundColor: '#000000',
    borderRadius: 14,
    padding: 16,
  },
  confirmButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  footerNote: {
    color: '#777777',
    fontSize: 12,
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.65,
  },
});