import { useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { formatMeetingTitle } from '@/features/praktikan/utils/format';

interface AttendanceSheetProps {
  visible: boolean;
  practicumName: string;
  moduleTitle: string;
  submitting?: boolean;
  error?: string | null;
  onCancel: () => void;
  onSubmit: () => Promise<unknown> | void;
}

/**
 * Modal konfirmasi presensi hadir Praktikan (Sprint 2).
 * Mengirim kehadiran tanpa input `note` maupun pilihan izin/sakit agar sesuai
 * kontrak `sessions/{sessionId}/attendance/{uid}` (`uid`, `nama`, `waktu`).
 */
export default function AttendanceSheet({
  visible,
  practicumName,
  moduleTitle,
  submitting = false,
  error = null,
  onCancel,
  onSubmit,
}: AttendanceSheetProps) {
  const mountedRef = useRef(true);
  const localSubmittingRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!visible || !submitting) {
      localSubmittingRef.current = false;
    }
  }, [submitting, visible]);

  const isSubmitting = submitting || localSubmittingRef.current;

  function handleRequestClose() {
    if (isSubmitting) return;
    onCancel();
  }

  async function handlePressSubmit() {
    if (isSubmitting) return;
    localSubmittingRef.current = true;
    try {
      await onSubmit();
    } finally {
      if (mountedRef.current) {
        localSubmittingRef.current = false;
      }
    }
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleRequestClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.handle} />

          <Text style={styles.title}>Konfirmasi Presensi</Text>

          <View style={styles.sessionInfo}>
            <Text style={styles.sessionName}>{practicumName}</Text>

            <Text style={styles.sessionModule}>
              {formatMeetingTitle(moduleTitle)}
            </Text>
          </View>

          <View style={styles.noticeBox}>
            <Text style={styles.noticeTitle}>Kehadiran: Hadir</Text>

            <Text style={styles.noticeText}>
              Presensi akan dicatat menggunakan identitas akun aktif dan waktu
              server saat ini. Presensi hanya dapat dilakukan satu kali pada
              sesi yang sama.
            </Text>
          </View>

          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <View style={styles.actions}>
            <Pressable
              accessibilityLabel="Batal presensi"
              accessibilityRole="button"
              accessibilityState={{ disabled: isSubmitting }}
              disabled={isSubmitting}
              onPress={handleRequestClose}
              style={({ pressed }) => [
                styles.cancelButton,
                isSubmitting && styles.disabled,
                pressed && !isSubmitting && styles.pressed,
              ]}
            >
              <Text style={styles.cancelText}>Batal</Text>
            </Pressable>

            <Pressable
              accessibilityLabel={
                isSubmitting ? 'Sedang mengirim presensi' : 'Kirim Presensi'
              }
              accessibilityRole="button"
              accessibilityState={{ disabled: isSubmitting, busy: isSubmitting }}
              disabled={isSubmitting}
              onPress={() => void handlePressSubmit()}
              style={({ pressed }) => [
                styles.submitButton,
                isSubmitting && styles.disabled,
                pressed && !isSubmitting && styles.pressed,
              ]}
            >
              {isSubmitting ? (
                <View style={styles.submittingRow}>
                  <ActivityIndicator size="small" color="#FFFFFF" />
                  <Text style={styles.submitText}>Mengirim...</Text>
                </View>
              ) : (
                <Text style={styles.submitText}>Kirim Presensi</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    gap: 14,
    padding: 22,
    paddingBottom: 32,
  },
  handle: {
    alignSelf: 'center',
    backgroundColor: '#D9D9D9',
    borderRadius: 3,
    height: 5,
    marginBottom: 2,
    width: 40,
  },
  title: {
    color: '#000000',
    fontSize: 20,
    fontWeight: '800',
  },
  sessionInfo: {
    backgroundColor: '#F2F2F2',
    borderRadius: 12,
    gap: 4,
    padding: 12,
  },
  sessionName: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '700',
  },
  sessionModule: {
    color: '#404040',
    fontSize: 13,
    lineHeight: 19,
  },
  noticeBox: {
    backgroundColor: '#DCFCE7',
    borderRadius: 12,
    gap: 4,
    padding: 12,
  },
  noticeTitle: {
    color: '#15803D',
    fontSize: 13,
    fontWeight: '700',
  },
  noticeText: {
    color: '#166534',
    fontSize: 13,
    lineHeight: 19,
  },
  errorBox: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FCA5A5',
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
  },
  errorText: {
    color: '#B91C1C',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 19,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  cancelButton: {
    alignItems: 'center',
    borderColor: '#BFBFBF',
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    padding: 14,
  },
  cancelText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '700',
  },
  submitButton: {
    alignItems: 'center',
    backgroundColor: '#000000',
    borderRadius: 12,
    flex: 1,
    justifyContent: 'center',
    padding: 14,
  },
  submittingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  submitText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  disabled: {
    opacity: 0.6,
  },
  pressed: {
    opacity: 0.65,
  },
});
