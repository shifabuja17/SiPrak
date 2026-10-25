import { useState } from 'react';
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  usePracticum,
  type PracticumSession,
} from '@/context/PracticumContext';

import AttendanceSheet from './attendance-sheet';

type ButtonVariant = 'ACTIVE' | 'DISABLED' | 'SUCCESS';

interface ButtonState {
  label: string;
  variant: ButtonVariant;
}

interface PraktikanAttendanceSectionProps {
  session: PracticumSession;
}

export default function PraktikanAttendanceSection({
  session,
}: PraktikanAttendanceSectionProps) {
  const { currentUser, submitAttendance } = usePracticum();

  const [sheetVisible, setSheetVisible] = useState(false);

  const attendance = session.attendances.find(
    (record) => record.userId === currentUser.id,
  );

  function getButtonState(): ButtonState {
    if (attendance) {
      return {
        label: `Anda Sudah Presensi pada ${attendance.timestamp}`,
        variant: 'SUCCESS',
      };
    }

    if (session.status === 'OPEN') {
      return {
        label: 'Lakukan Presensi Sekarang',
        variant: 'ACTIVE',
      };
    }

    if (session.status === 'CLOSED') {
      return {
        label: 'Sesi Telah Ditutup - Tidak Hadir',
        variant: 'DISABLED',
      };
    }

    return {
      label: 'Sesi Belum Dibuka Asisten',
      variant: 'DISABLED',
    };
  }

  const buttonState = getButtonState();
  const isActive = buttonState.variant === 'ACTIVE';

  function handleSubmit(note: string) {
    setSheetVisible(false);

    try {
      submitAttendance(session.id, currentUser, note);

      Alert.alert('Berhasil', 'Presensi kamu sudah tercatat.');
    } catch (error) {
      Alert.alert(
        'Gagal',
        error instanceof Error
          ? error.message
          : 'Terjadi kesalahan.',
      );
    }
  }

  return (
    <View style={styles.container}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: !isActive }}
        disabled={!isActive}
        onPress={() => setSheetVisible(true)}
        style={({ pressed }) => [
          styles.button,
          buttonState.variant === 'ACTIVE' && styles.buttonActive,
          buttonState.variant === 'DISABLED' &&
            styles.buttonDisabled,
          buttonState.variant === 'SUCCESS' &&
            styles.buttonSuccess,
          pressed && isActive && styles.pressed,
        ]}
      >
        <Text
          style={[
            styles.buttonText,
            buttonState.variant === 'ACTIVE' &&
              styles.buttonTextActive,
            buttonState.variant === 'DISABLED' &&
              styles.buttonTextDisabled,
            buttonState.variant === 'SUCCESS' &&
              styles.buttonTextSuccess,
          ]}
        >
          {buttonState.variant === 'SUCCESS' ? '✓  ' : ''}
          {buttonState.label}
        </Text>
      </Pressable>

      {attendance?.note ? (
        <View style={styles.noteContainer}>
          <Text style={styles.noteLabel}>Catatan Presensi</Text>

          <Text style={styles.noteText}>{attendance.note}</Text>
        </View>
      ) : null}

      <AttendanceSheet
        visible={sheetVisible}
        practicumName={session.practicumName}
        moduleTitle={session.moduleTitle}
        onCancel={() => setSheetVisible(false)}
        onSubmit={handleSubmit}
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
    backgroundColor: '#FFFFFF',
    borderColor: '#000000',
    borderWidth: 1,
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
    color: '#000000',
  },
  noteContainer: {
    backgroundColor: '#F2F2F2',
    borderRadius: 12,
    gap: 5,
    padding: 12,
  },
  noteLabel: {
    color: '#666666',
    fontSize: 12,
    fontWeight: '600',
  },
  noteText: {
    color: '#404040',
    fontSize: 13,
    lineHeight: 20,
  },
  pressed: {
    opacity: 0.65,
  },
});