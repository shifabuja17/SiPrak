/**
 * Banner penjelasan ketika notifikasi tidak aktif (izin ditolak, tidak didukung, atau error).
 * Tidak menampilkan apa pun saat notifikasi aktif atau sedang diproses.
 */
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { FONT } from '@/constants/fonts';
import { UI } from '@/features/praktikan/ui/praktikan-ui';

import { usePushNotifications } from '../state/push-notification-context';

export function NotificationStatusBanner() {
  const { status, message, retry, openSettings } = usePushNotifications();

  if (status !== 'permission_denied' && status !== 'unsupported' && status !== 'error') {
    return null;
  }

  return (
    <View style={styles.box} accessibilityRole="alert">
      <Text style={styles.title}>Notifikasi belum aktif</Text>
      <Text style={styles.message}>{message}</Text>

      {status === 'permission_denied' ? (
        <Pressable
          accessibilityRole="button"
          onPress={openSettings}
          style={({ pressed }) => [styles.button, pressed && styles.pressed]}
        >
          <Text style={styles.buttonText}>Buka Pengaturan</Text>
        </Pressable>
      ) : null}

      {status === 'error' ? (
        <Pressable
          accessibilityRole="button"
          onPress={retry}
          style={({ pressed }) => [styles.button, pressed && styles.pressed]}
        >
          <Text style={styles.buttonText}>Coba lagi</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: UI.soft,
    borderColor: UI.line,
    borderRadius: 18,
    borderWidth: 1,
    gap: 6,
    marginBottom: 16,
    padding: 16,
  },
  title: {
    color: UI.ink,
    fontFamily: FONT.bold,
    fontSize: 14,
  },
  message: {
    color: UI.muted,
    fontFamily: FONT.regular,
    fontSize: 13,
    lineHeight: 19,
  },
  button: {
    alignSelf: 'flex-start',
    backgroundColor: UI.ink,
    borderRadius: 999,
    marginTop: 6,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  buttonText: {
    color: UI.onColor,
    fontFamily: FONT.semibold,
    fontSize: 13,
  },
  pressed: {
    opacity: 0.8,
  },
});
