import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { PraktikanInlineErrorBanner } from '@/features/praktikan/components/praktikan-state-view';
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
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

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
    if (submitting || buttonState.disabled) {
      return;
    }
    clearError();
    setSheetVisible(true);
  }

  async function handleConfirmSubmit() {
    let ok = false;
    try {
      ok = await submitAttendance();
    } finally {
      if (mountedRef.current) {
        setSheetVisible(false);
      }
    }

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
        <PraktikanInlineErrorBanner
          title="Gangguan Presensi"
          message={error}
          onRetry={retry}
          onDismiss={clearError}
        />
      ) : null}

      <AttendanceSheet
        visible={sheetVisible}
        practicumName={session.practicumName}
        moduleTitle={session.moduleTitle}
        submitting={submitting}
        error={sheetVisible ? error : null}
        onCancel={() => {
          if (!submitting) setSheetVisible(false);
        }}
        onSubmit={() => handleConfirmSubmit()}
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
  pressed: {
    opacity: 0.65,
  },
});
