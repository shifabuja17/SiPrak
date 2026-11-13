import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useSessionAttendance } from '@/features/praktikan/hooks/use-session-attendance';
import type { PraktikanSession } from '@/features/praktikan/types';
import { formatAttendanceTimeWIB } from '@/features/praktikan/utils/format';

import AttendanceSheet from './attendance-sheet';

type ButtonVariant = 'ACTIVE' | 'DISABLED' | 'SUCCESS';

interface ButtonState {
  label: string;
  variant: ButtonVariant;
  disabled: boolean;
}

interface PraktikanAttendanceSectionProps {
  session: PraktikanSession;
}

/**
 * Seksi aksi presensi Praktikan pada halaman detail sesi (FR-10 & FR-11).
 * Mengatur 4 kondisi tombol berdasarkan status presensi pribadi (`attendance/{uid}`)
 * dan status sesi (`dijadwalkan` | `dibuka` | `ditutup`).
 */
export default function PraktikanAttendanceSection({
  session,
}: PraktikanAttendanceSectionProps) {
  const {
    attendance,
    loading,
    submitting,
    error,
    submitAttendance,
    clearError,
    retry,
  } = useSessionAttendance(session.id);

  const [sheetVisible, setSheetVisible] = useState(false);

  function getButtonState(): ButtonState {
    if (attendance !== null) {
      const formattedTime = formatAttendanceTimeWIB(attendance.waktu);
      return {
        label: formattedTime
          ? `Anda Sudah Presensi pada ${formattedTime}`
          : 'Anda Sudah Presensi',
        variant: 'SUCCESS',
        disabled: true,
      };
    }

    if (loading) {
      return {
        label: 'Memeriksa status presensi...',
        variant: 'DISABLED',
        disabled: true,
      };
    }

    if (session.status === 'dibuka') {
      return {
        label: submitting
          ? 'Mengirim Presensi...'
          : 'Lakukan Presensi Sekarang',
        variant: 'ACTIVE',
        disabled: submitting,
      };
    }

    if (session.status === 'ditutup') {
      return {
        label: 'Sesi Telah Ditutup - Tidak Hadir',
        variant: 'DISABLED',
        disabled: true,
      };
    }

    return {
      label: 'Sesi Belum Dibuka Asisten',
      variant: 'DISABLED',
      disabled: true,
    };
  }

  const buttonState = getButtonState();
  const isInteractive = !buttonState.disabled;

  function handleOpenSheet() {
    clearError();
    setSheetVisible(true);
  }

  async function handleConfirmSubmit() {
    const ok = await submitAttendance();
    setSheetVisible(false);

    if (ok) {
      Alert.alert('Berhasil', 'Presensi kamu sudah tercatat.');
    }
  }

  return (
    <View style={styles.container}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: buttonState.disabled }}
        disabled={buttonState.disabled}
        onPress={handleOpenSheet}
        style={({ pressed }) => [
          styles.button,
          buttonState.variant === 'ACTIVE' && styles.buttonActive,
          buttonState.variant === 'DISABLED' && styles.buttonDisabled,
          buttonState.variant === 'SUCCESS' && styles.buttonSuccess,
          pressed && isInteractive && styles.pressed,
        ]}
      >
        {loading || submitting ? (
          <View style={styles.buttonLoadingRow}>
            <ActivityIndicator
              size="small"
              color={buttonState.variant === 'ACTIVE' ? '#FFFFFF' : '#666666'}
            />
            <Text
              style={[
                styles.buttonText,
                buttonState.variant === 'ACTIVE'
                  ? styles.buttonTextActive
                  : styles.buttonTextDisabled,
              ]}
            >
              {buttonState.label}
            </Text>
          </View>
        ) : (
          <Text
            style={[
              styles.buttonText,
              buttonState.variant === 'ACTIVE' && styles.buttonTextActive,
              buttonState.variant === 'DISABLED' && styles.buttonTextDisabled,
              buttonState.variant === 'SUCCESS' && styles.buttonTextSuccess,
            ]}
          >
            {buttonState.variant === 'SUCCESS' ? '✓  ' : ''}
            {buttonState.label}
          </Text>
        )}
      </Pressable>

      {error ? (
        <View style={styles.errorCard}>
          <Text style={styles.errorText}>{error}</Text>

          <View style={styles.errorActions}>
            <Pressable
              onPress={retry}
              style={({ pressed }) => [
                styles.retryButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.retryText}>Coba Lagi</Text>
            </Pressable>

            <Pressable
              onPress={clearError}
              style={({ pressed }) => [
                styles.dismissButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.dismissText}>Tutup</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      <AttendanceSheet
        visible={sheetVisible}
        practicumName={session.practicumName}
        moduleTitle={session.moduleTitle}
        submitting={submitting}
        onCancel={() => {
          if (!submitting) setSheetVisible(false);
        }}
        onSubmit={() => void handleConfirmSubmit()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  button: {
    alignItems: 'center',
    borderRadius: 14,
    padding: 16,
  },
  buttonActive: {
    backgroundColor: '#000000',
  },
  buttonDisabled: {
    backgroundColor: '#E5E5E5',
  },
  buttonSuccess: {
    backgroundColor: '#DCFCE7',
    borderColor: '#15803D',
    borderWidth: 1,
  },
  buttonLoadingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 21,
    textAlign: 'center',
  },
  buttonTextActive: {
    color: '#FFFFFF',
  },
  buttonTextDisabled: {
    color: '#666666',
  },
  buttonTextSuccess: {
    color: '#15803D',
  },
  errorCard: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FCA5A5',
    borderRadius: 12,
    borderWidth: 1,
    gap: 10,
    padding: 12,
  },
  errorText: {
    color: '#B91C1C',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 19,
  },
  errorActions: {
    flexDirection: 'row',
    gap: 12,
  },
  retryButton: {
    backgroundColor: '#B91C1C',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  retryText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  dismissButton: {
    justifyContent: 'center',
    paddingHorizontal: 6,
    paddingVertical: 6,
  },
  dismissText: {
    color: '#7F1D1D',
    fontSize: 12,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.65,
  },
});
