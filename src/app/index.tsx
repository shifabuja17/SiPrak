import { router } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  usePracticum,
  type UserRole,
} from '@/context/PracticumContext';

export default function StartScreen() {
  const { users, switchUser } = usePracticum();

  const [selectedRole, setSelectedRole] =
    useState<UserRole | null>(null);

  const [selectedUserId, setSelectedUserId] =
    useState<string | null>(null);

  const availableUsers = selectedRole
    ? users.filter((user) => user.role === selectedRole)
    : [];

  const selectedUser = availableUsers.find(
    (user) => user.id === selectedUserId,
  );

  function handleSelectRole(role: UserRole) {
    setSelectedRole(role);
    setSelectedUserId(null);
  }

  function handleContinue() {
    if (!selectedUser) {
      Alert.alert(
        'Identitas belum dipilih',
        'Pilih peran dan identitas terlebih dahulu.',
      );
      return;
    }

    try {
      switchUser(selectedUser.id);
      router.replace('/(tabs)/schedule');
    } catch (error) {
      Alert.alert(
        'Gagal masuk',
        error instanceof Error
          ? error.message
          : 'Terjadi kesalahan.',
      );
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.brand}>
          <View style={styles.logo}>
            <Text style={styles.logoText}>S</Text>
          </View>

          <Text style={styles.appName}>SiPrak</Text>

          <Text style={styles.brandSubtitle}>
            Sistem Informasi Praktikum
          </Text>
        </View>

        <View style={styles.headingContainer}>
          <Text style={styles.title}>
            Selamat Datang!
          </Text>

          <Text style={styles.subtitle}>
            Pilih peran dan identitasmu untuk melanjutkan
            ke aplikasi.
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
                  <View style={styles.roleDetails}>
                    <Text style={styles.roleName}>
                      {role === 'ASISTEN'
                        ? 'Asisten Praktikum'
                        : 'Praktikan'}
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

        {selectedRole !== null && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Pilih Identitas
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
        )}

        <Pressable
          disabled={!selectedUser}
          onPress={handleContinue}
          style={({ pressed }) => [
            styles.continueButton,
            !selectedUser && styles.disabledButton,
            pressed && selectedUser && styles.pressed,
          ]}
        >
          <Text style={styles.continueButtonText}>
            Lanjutkan
          </Text>
        </Pressable>

        <Text style={styles.footer}>
          Demo menggunakan akun dan data dummy.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    gap: 24,
    padding: 22,
    paddingTop: 36,
    paddingBottom: 36,
  },
  brand: {
    alignItems: 'center',
    gap: 7,
    marginBottom: 4,
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
    fontSize: 12,
    lineHeight: 21,
    textAlign: 'center',
  },
  section: {
    gap: 12,
  },
  sectionTitle: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '800',
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
    padding: 15,
  },
  roleDetails: {
    flex: 1,
    gap: 5,
  },
  roleName: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '700',
  },
  roleDescription: {
    color: '#666666',
    fontSize: 12,
    lineHeight: 18,
  },
  selectedCard: {
    backgroundColor: '#F2F2F2',
    borderColor: '#000000',
    borderWidth: 1.5,
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
  continueButton: {
    alignItems: 'center',
    backgroundColor: '#000000',
    borderRadius: 14,
    marginTop: 2,
    padding: 16,
  },
  disabledButton: {
    backgroundColor: '#999999',
  },
  continueButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.65,
  },
  footer: {
    color: '#777777',
    fontSize: 12,
    textAlign: 'center',
  },
});