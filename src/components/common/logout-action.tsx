import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { FONT } from '@/constants/fonts';
import { useAuth } from '@/context/AuthContext';

const DANGER = '#E00000';

function LogoutIcon({ size = 19 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
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
    </Svg>
  );
}

function AlertIcon() {
  return (
    <Svg width={17} height={17} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={9} stroke="#FFFFFF" strokeWidth={1.8} />
      <Path d="M12 7V13" stroke="#FFFFFF" strokeWidth={1.8} strokeLinecap="round" />
      <Circle cx={12} cy={16.5} r={1} fill="#FFFFFF" />
    </Svg>
  );
}

/**
 * Tombol "Keluar dari Akun" beserta modal konfirmasinya. Dipakai di profil
 * Praktikan dan Asisten supaya tampilannya sama.
 */
export default function LogoutAction({ disabled = false }: { disabled?: boolean }) {
  const { logout } = useAuth();
  const [visible, setVisible] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [error, setError] = useState('');

  async function handleLogout() {
    try {
      setLoggingOut(true);
      setError('');
      await logout();
      setVisible(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal keluar dari akun.');
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <>
      <Pressable
        accessibilityRole="button"
        disabled={disabled || loggingOut}
        onPress={() => {
          setError('');
          setVisible(true);
        }}
        style={({ pressed }) => [styles.logoutButton, pressed && styles.pressed]}
      >
        <LogoutIcon />
        <Text style={styles.logoutButtonText}>Keluar dari Akun</Text>
      </Pressable>

      <Modal
        visible={visible}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => {
          if (!loggingOut) setVisible(false);
        }}
      >
        <View style={styles.backdrop}>
          <View style={styles.card}>
            <Text style={styles.title}>Keluar dari akun?</Text>

            {error ? (
              <View style={styles.errorBox}>
                <AlertIcon />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <View style={styles.actions}>
              <Pressable
                accessibilityRole="button"
                disabled={loggingOut}
                onPress={() => setVisible(false)}
                style={({ pressed }) => [styles.cancelButton, pressed && styles.pressed]}
              >
                <Text style={styles.cancelText}>Batal</Text>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                disabled={loggingOut}
                onPress={handleLogout}
                style={({ pressed }) => [
                  styles.confirmButton,
                  (pressed || loggingOut) && styles.pressed,
                ]}
              >
                {loggingOut ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.confirmText}>Keluar</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  logoutButton: {
    alignItems: 'center',
    backgroundColor: DANGER,
    borderRadius: 999,
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
    minHeight: 50,
    paddingHorizontal: 15,
  },
  logoutButtonText: {
    fontFamily: FONT.bold,
    color: '#FFFFFF',
    fontSize: 14,
  },
  pressed: {
    opacity: 0.65,
  },
  backdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 25,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    gap: 14,
    maxWidth: 400,
    padding: 22,
    width: '100%',
  },
  title: {
    fontFamily: FONT.extrabold,
    color: '#111014',
    fontSize: 20,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 5,
  },
  cancelButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#8E8E93',
    borderRadius: 11,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    padding: 14,
  },
  cancelText: {
    fontFamily: FONT.bold,
    color: '#111014',
    fontSize: 13,
  },
  confirmButton: {
    alignItems: 'center',
    backgroundColor: DANGER,
    borderRadius: 11,
    flex: 1,
    justifyContent: 'center',
    padding: 14,
  },
  confirmText: {
    fontFamily: FONT.bold,
    color: '#FFFFFF',
    fontSize: 13,
  },
  errorBox: {
    alignItems: 'center',
    backgroundColor: DANGER,
    borderRadius: 10,
    flexDirection: 'row',
    gap: 8,
    padding: 11,
  },
  errorText: {
    fontFamily: FONT.regular,
    color: '#FFFFFF',
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
  },
});
