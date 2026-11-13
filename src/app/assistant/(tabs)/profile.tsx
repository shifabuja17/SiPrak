import { useState } from 'react';
import { router } from 'expo-router';

import {
  ActivityIndicator,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import Svg, { Circle, Path } from 'react-native-svg';

import { useAuth } from '@/context/AuthContext';

// ==========================================
// ICON SVG
// ==========================================

function ProfileIcon({
  name,
  size = 22,
}: {
  name: 'user' | 'mail' | 'id' | 'logout' | 'alert';
  size?: number;
}) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
    >
      {name === 'user' && (
        <>
          <Circle
            cx={12}
            cy={8}
            r={4}
            stroke="#000000"
            strokeWidth={1.8}
          />

          <Path
            d="M4 21C4 16.8 7.2 14 12 14C16.8 14 20 16.8 20 21"
            stroke="#000000"
            strokeWidth={1.8}
            strokeLinecap="round"
          />
        </>
      )}

      {name === 'mail' && (
        <>
          <Path
            d="M3 6H21V18H3V6Z"
            stroke="#000000"
            strokeWidth={1.8}
            strokeLinejoin="round"
          />

          <Path
            d="M3 7L12 14L21 7"
            stroke="#000000"
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      )}

      {name === 'id' && (
        <>
          <Path
            d="M4 4H20V20H4V4Z"
            stroke="#000000"
            strokeWidth={1.8}
            strokeLinejoin="round"
          />

          <Circle
            cx={9}
            cy={10}
            r={2}
            stroke="#000000"
            strokeWidth={1.6}
          />

          <Path
            d="M6 17C6 15.3 7.2 14 9 14C10.8 14 12 15.3 12 17M15 10H18M15 14H18"
            stroke="#000000"
            strokeWidth={1.6}
            strokeLinecap="round"
          />
        </>
      )}

      {name === 'logout' && (
        <>
          <Path
            d="M10 4H5C3.9 4 3 4.9 3 6V18C3 19.1 3.9 20 5 20H10"
            stroke="#FFFFFF"
            strokeWidth={1.8}
            strokeLinecap="round"
          />

          <Path
            d="M14 8L18 12L14 16M8 12H18"
            stroke="#FFFFFF"
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      )}

      {name === 'alert' && (
        <>
          <Circle
            cx={12}
            cy={12}
            r={9}
            stroke="#555555"
            strokeWidth={1.8}
          />

          <Path
            d="M12 7V13"
            stroke="#555555"
            strokeWidth={1.8}
            strokeLinecap="round"
          />

          <Circle
            cx={12}
            cy={16.5}
            r={1}
            fill="#555555"
          />
        </>
      )}
    </Svg>
  );
}

// ==========================================
// INFORMASI PROFIL
// ==========================================

function ProfileInfo({
  icon,
  label,
  value,
}: {
  icon: 'user' | 'mail' | 'id';
  label: string;
  value: string;
}) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoIcon}>
        <ProfileIcon name={icon} size={20} />
      </View>

      <View style={styles.infoContent}>
        <Text style={styles.infoLabel}>{label}</Text>

        <Text
          style={styles.infoValue}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.75}
        >
          {value}
        </Text>
      </View>
    </View>
  );
}

// ==========================================
// HALAMAN PROFIL ASISTEN
// ==========================================

export default function AssistantProfileScreen() {
  const { user, profile, loading, profileError, logout } = useAuth();

  const [modalVisible, setModalVisible] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState('');

  const displayName = profile?.nama?.trim() || 'Nama belum tersedia';

  const roleLabel =
    profile?.role === 'asisten'
      ? 'Asisten Praktikum'
      : profile?.role || 'Tidak diketahui';

  // ========================================
  // LOGOUT
  // ========================================

  async function handleLogout() {
    try {
      setLoggingOut(true);
      setLogoutError('');

      await logout();

      setModalVisible(false);

      // Kembali ke halaman pemilihan peran.
      router.replace('/');
    } catch (error) {
      console.error('Gagal logout:', error);

      setLogoutError(
        error instanceof Error
          ? error.message
          : 'Gagal keluar dari akun.',
      );
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        {/* HEADER */}
        <View style={styles.topBar}>
          <Text style={styles.brand}>SiPrak</Text>
        </View>

        <View style={styles.pageContent}>
          {/* JUDUL */}
          <View style={styles.heading}>
            <Text style={styles.subtitle}>PENGATURAN AKUN</Text>

            <Text style={styles.title}>Profil Asisten</Text>

            <Text style={styles.description}>
              Informasi akun yang sedang kamu gunakan.
            </Text>
          </View>

          {/* KARTU IDENTITAS */}
          <View style={styles.profileCard}>
            <View style={styles.avatar}>
              <ProfileIcon name="user" size={35} />
            </View>

            <Text
              style={styles.profileName}
              numberOfLines={2}
            >
              {loading ? 'Memuat profil...' : displayName}
            </Text>

            <View style={styles.roleBadge}>
              <Text style={styles.roleText}>{roleLabel}</Text>
            </View>
          </View>

          {/* DETAIL PROFIL */}
          <View style={styles.infoCard}>
            <Text style={styles.sectionTitle}>
              Informasi Akun
            </Text>

            <ProfileInfo
              icon="user"
              label="Nama Lengkap"
              value={profile?.nama || 'Belum tersedia'}
            />

            <ProfileInfo
              icon="mail"
              label="Email"
              value={profile?.email || user?.email || '-'}
            />

            <ProfileInfo
              icon="id"
              label="NIM"
              value={profile?.nim || 'Belum diisi'}
            />

            {profileError ? (
              <Text style={styles.errorText}>
                {profileError}
              </Text>
            ) : null}
          </View>

          {/* LOGOUT */}
          <View style={styles.logoutSection}>
            <Text style={styles.sectionTitle}>
              Akun
            </Text>

            <Pressable
              style={({ pressed }) => [
                styles.logoutButton,
                pressed && styles.pressed,
              ]}
              onPress={() => {
                setLogoutError('');
                setModalVisible(true);
              }}
              disabled={loading || loggingOut}
            >
              <ProfileIcon name="logout" size={19} />

              <Text style={styles.logoutButtonText}>
                Logout
              </Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>

      {/* =====================================
          MODAL KONFIRMASI LOGOUT
      ===================================== */}

      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!loggingOut) {
            setModalVisible(false);
          }
        }}
        statusBarTranslucent
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              Keluar dari akun?
            </Text>

            <Text style={styles.modalDescription}>
              Kamu akan keluar dari akun Asisten dan kembali ke halaman awal.
            </Text>

            {logoutError ? (
              <View style={styles.errorBox}>
                <ProfileIcon name="alert" size={17} />

                <Text style={styles.errorText}>
                  {logoutError}
                </Text>
              </View>
            ) : null}

            <View style={styles.modalActions}>
              <Pressable
                style={styles.cancelButton}
                onPress={() => setModalVisible(false)}
                disabled={loggingOut}
              >
                <Text style={styles.cancelText}>Batal</Text>
              </Pressable>

              <Pressable
                style={[
                  styles.confirmButton,
                  loggingOut && styles.disabledButton,
                ]}
                onPress={handleLogout}
                disabled={loggingOut}
              >
                {loggingOut ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.confirmText}>Logout</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ==========================================
// STYLE PROFIL
// ==========================================

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: '#F5F5F5',
    flex: 1,
  },

  content: {
    paddingBottom: 30,
  },

  topBar: {
    alignItems: 'center',
    backgroundColor: '#000000',
    justifyContent: 'center',
    minHeight: 95,
    paddingHorizontal: 20,
    paddingVertical: 15,
  },

  brand: {
    color: '#FFFFFF',
    fontSize: 27,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginTop: 28,
  },

  pageContent: {
    paddingHorizontal: 20,
    paddingTop: 25,
    gap: 19,
  },

  heading: {
    gap: 6,
  },

  subtitle: {
    color: '#777777',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.1,
  },

  title: {
    color: '#000000',
    fontSize: 26,
    fontWeight: '800',
  },

  description: {
    color: '#666666',
    fontSize: 13,
    lineHeight: 20,
  },

  profileCard: {
    alignItems: 'center',
    backgroundColor: '#000000',
    borderRadius: 20,
    gap: 12,
    padding: 24,
  },

  avatar: {
    alignItems: 'center',
    backgroundColor: '#E5E5E5',
    borderRadius: 40,
    height: 75,
    justifyContent: 'center',
    width: 75,
  },

  profileName: {
    color: '#FFFFFF',
    fontSize: 19,
    fontWeight: '800',
    textAlign: 'center',
  },

  roleBadge: {
    backgroundColor: '#333333',
    borderRadius: 20,
    paddingHorizontal: 13,
    paddingVertical: 7,
  },

  roleText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },

  infoCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E5E5E5',
    borderRadius: 17,
    borderWidth: 1,
    gap: 17,
    padding: 17,
  },

  sectionTitle: {
    color: '#000000',
    fontSize: 17,
    fontWeight: '800',
  },

  infoRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },

  infoIcon: {
    alignItems: 'center',
    backgroundColor: '#EEEEEE',
    borderRadius: 11,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },

  infoContent: {
    flex: 1,
    gap: 4,
  },

  infoLabel: {
    color: '#777777',
    fontSize: 11,
    fontWeight: '600',
  },

  infoValue: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '700',
  },

  logoutSection: {
    gap: 12,
  },

  logoutButton: {
    alignItems: 'center',
    backgroundColor: '#000000',
    borderRadius: 13,
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
    padding: 15,
  },

  logoutButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },

  pressed: {
    opacity: 0.65,
  },

  disabledButton: {
    opacity: 0.5,
  },

  // MODAL
  modalBackdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 25,
  },

  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    gap: 14,
    maxWidth: 400,
    padding: 22,
    width: '100%',
  },

  modalTitle: {
    color: '#000000',
    fontSize: 20,
    fontWeight: '800',
  },

  modalDescription: {
    color: '#666666',
    fontSize: 13,
    lineHeight: 20,
  },

  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 5,
  },

  cancelButton: {
    alignItems: 'center',
    backgroundColor: '#EEEEEE',
    borderRadius: 11,
    flex: 1,
    justifyContent: 'center',
    padding: 14,
  },

  cancelText: {
    color: '#222222',
    fontSize: 13,
    fontWeight: '700',
  },

  confirmButton: {
    alignItems: 'center',
    backgroundColor: '#000000',
    borderRadius: 11,
    flex: 1,
    justifyContent: 'center',
    padding: 14,
  },

  confirmText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },

  errorBox: {
    alignItems: 'center',
    backgroundColor: '#EEEEEE',
    borderRadius: 10,
    flexDirection: 'row',
    gap: 8,
    padding: 11,
  },

  errorText: {
    color: '#555555',
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
  },
});