import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

type AttendanceStatus = 'HADIR' | 'IZIN' | 'SAKIT';

const STATUS_OPTIONS: {
  value: AttendanceStatus;
  label: string;
  noteLabel: string;
}[] = [
  {
    value: 'HADIR',
    label: 'Hadir',
    noteLabel: 'Hadir',
  },
  {
    value: 'IZIN',
    label: 'Izin',
    noteLabel: 'Izin',
  },
  {
    value: 'SAKIT',
    label: 'Sakit',
    noteLabel: 'Sakit',
  },
];

interface AttendanceSheetProps {
  visible: boolean;
  practicumName: string;
  moduleTitle: string;
  onCancel: () => void;
  onSubmit: (note: string) => void;
}

export default function AttendanceSheet({
  visible,
  practicumName,
  moduleTitle,
  onCancel,
  onSubmit,
}: AttendanceSheetProps) {
  const [status, setStatus] =
    useState<AttendanceStatus>('HADIR');
  const [extraNote, setExtraNote] = useState('');

  function resetForm() {
    setStatus('HADIR');
    setExtraNote('');
  }

  function handleCancel() {
    resetForm();
    onCancel();
  }

  function handleSubmit() {
    const option = STATUS_OPTIONS.find(
      (item) => item.value === status,
    );

    const trimmedNote = extraNote.trim();
    const note = trimmedNote
      ? `${option?.noteLabel}. ${trimmedNote}`
      : (option?.noteLabel ?? '');

    resetForm();
    onSubmit(note);
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleCancel}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.backdrop}
      >
        <View style={styles.sheet}>
          <View style={styles.handle} />

          <Text style={styles.title}>Konfirmasi Presensi</Text>

          <View style={styles.sessionInfo}>
            <Text style={styles.sessionName}>
              {practicumName}
            </Text>

            <Text style={styles.sessionModule}>
              {moduleTitle.replace(
                /^Modul\s*(\d+)\s*:\s*/i,
                'Pertemuan $1: ',
              )}
            </Text>
          </View>

          <Text style={styles.label}>Status kehadiran</Text>

          <View style={styles.options}>
            {STATUS_OPTIONS.map((option) => {
              const selected = status === option.value;

              return (
                <Pressable
                  key={option.value}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  onPress={() => setStatus(option.value)}
                  style={({ pressed }) => [
                    styles.option,
                    selected && styles.optionSelected,
                    pressed && styles.pressed,
                  ]}
                >
                  <View
                    style={[
                      styles.radio,
                      selected && styles.radioSelected,
                    ]}
                  >
                    {selected && <View style={styles.radioDot} />}
                  </View>

                  <Text
                    style={[
                      styles.optionText,
                      selected && styles.optionTextSelected,
                    ]}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.label}>
            Catatan tambahan (opsional)
          </Text>

          <TextInput
            value={extraNote}
            onChangeText={setExtraNote}
            placeholder="Contoh: alasan izin atau keterangan sakit"
            placeholderTextColor="#777777"
            multiline
            maxLength={200}
            textAlignVertical="top"
            style={styles.noteInput}
          />

          <View style={styles.actions}>
            <Pressable
              onPress={handleCancel}
              style={({ pressed }) => [
                styles.cancelButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.cancelText}>Batal</Text>
            </Pressable>

            <Pressable
              onPress={handleSubmit}
              style={({ pressed }) => [
                styles.submitButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.submitText}>
                Kirim Presensi
              </Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
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
  label: {
    color: '#000000',
    fontSize: 13,
    fontWeight: '700',
  },
  options: {
    gap: 8,
  },
  option: {
    alignItems: 'center',
    borderColor: '#BFBFBF',
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 14,
  },
  optionSelected: {
    backgroundColor: '#F2F2F2',
    borderColor: '#000000',
  },
  radio: {
    alignItems: 'center',
    borderColor: '#808080',
    borderRadius: 10,
    borderWidth: 2,
    height: 20,
    justifyContent: 'center',
    width: 20,
  },
  radioSelected: {
    borderColor: '#000000',
  },
  radioDot: {
    backgroundColor: '#000000',
    borderRadius: 5,
    height: 10,
    width: 10,
  },
  optionText: {
    color: '#404040',
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  optionTextSelected: {
    color: '#000000',
    fontWeight: '700',
  },
  noteInput: {
    borderColor: '#BFBFBF',
    borderRadius: 12,
    borderWidth: 1,
    color: '#000000',
    minHeight: 80,
    padding: 12,
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
    padding: 14,
  },
  submitText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.65,
  },
});