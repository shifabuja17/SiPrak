/**
 * Banner singkat ketika notifikasi tidak aktif (izin ditolak atau gagal didaftarkan),
 * dengan satu tombol "Coba Lagi". Tidak tampil saat notifikasi aktif atau diproses.
 */
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { FONT } from '@/constants/fonts';
import { UI } from '@/features/praktikan/ui/praktikan-ui';

import { usePushNotifications } from '../state/push-notification-context';
import { BORDER_COLOR, CARD_BG } from '@/constants/colors';

export function NotificationStatusBanner() {
  const { status, retry } = usePushNotifications();

  // Hanya saat izin ditolak atau pendaftaran gagal; "unsupported" (mis. web/Expo Go)
  // tidak bisa diperbaiki pengguna, jadi tidak ditampilkan.
  if (status !== 'permission_denied' && status !== 'error') {
    return null;
  }

  return (
    <View style={styles.box} accessibilityRole="alert">
      <Text style={styles.title}>
        {status === 'permission_denied'
          ? 'Izin notifikasi belum diberikan'
          : 'Notifikasi belum aktif'}
      </Text>

      <Pressable
        accessibilityRole="button"
        onPress={retry}
        style={({ pressed }) => [styles.button, pressed && styles.pressed]}
      >
        <Text style={styles.buttonText}>Coba Lagi</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    alignItems: 'center',
    backgroundColor: CARD_BG,
    borderColor: BORDER_COLOR,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
    paddingLeft: 18,
    paddingRight: 8,
    paddingVertical: 7,
  },
  title: {
    color: UI.ink,
    flex: 1,
    fontFamily: FONT.bold,
    fontSize: 13,
  },
  button: {
    backgroundColor: UI.accent,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  buttonText: {
    color: UI.onColor,
    fontFamily: FONT.semibold,
    fontSize: 12,
  },
  pressed: {
    opacity: 0.8,
  },
});
