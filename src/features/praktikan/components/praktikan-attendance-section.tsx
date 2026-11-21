import { router } from 'expo-router';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { PraktikanInlineErrorBanner } from '@/features/praktikan/components/praktikan-state-view';
import { useSessionAttendance } from '@/features/praktikan/hooks/use-session-attendance';
import type { PraktikanSession } from '@/features/praktikan/types';
import { formatAttendanceTimeWIB } from '@/features/praktikan/utils/format';

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
 * Ringkasan status presensi di Detail Sesi. Presensi sendiri dilakukan di halaman
 * terpisah `/attendance/[sessionId]` yang memeriksa lokasi (Sprint 3 FR-01).
 */
export default function PraktikanAttendanceSection({
  session,
}: PraktikanAttendanceSectionProps) {
  const {
    attendance,
    loading,
    error,
    clearError,
    retry,
  } = useSessionAttendance(session.id);

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
        label: 'Buka Halaman Presensi',
        variant: 'ACTIVE',
        disabled: false,
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

  function handleOpenAttendance() {
    if (buttonState.disabled) return;
    clearError();
    router.push({
      pathname: '/attendance/[sessionId]',
      params: { sessionId: session.id },
    });
  }

  return (
    <View style={styles.container}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: buttonState.disabled }}
        disabled={buttonState.disabled}
        onPress={handleOpenAttendance}
        style={({ pressed }) => [
          styles.button,
          buttonState.variant === 'ACTIVE' && styles.buttonActive,
          buttonState.variant === 'DISABLED' && styles.buttonDisabled,
          buttonState.variant === 'SUCCESS' && styles.buttonSuccess,
          pressed && isInteractive && styles.pressed,
        ]}
      >
        {loading ? (
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
        <PraktikanInlineErrorBanner
          title="Gangguan Presensi"
          message={error}
          onRetry={retry}
          onDismiss={clearError}
        />
      ) : null}

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
  pressed: {
    opacity: 0.65,
  },
});
