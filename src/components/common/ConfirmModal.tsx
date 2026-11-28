import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { FONT } from '@/constants/fonts';
import { BORDER_COLOR } from '@/constants/colors';

interface ConfirmModalProps {
  visible: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({
  visible,
  title,
  message,
  confirmText = 'Konfirmasi',
  cancelText = 'Batal',
  destructive = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onCancel}
    >
      <View style={styles.backdrop}>
        <View style={styles.modal}>
          <View style={styles.handle} />

          <Text style={styles.title}>{title}</Text>

          <Text style={styles.message}>{message}</Text>

          <View style={styles.actions}>
            <Pressable
              onPress={onCancel}
              style={({ pressed }) => [
                styles.button,
                styles.cancelButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.cancelText}>
                {cancelText}
              </Text>
            </Pressable>

            <Pressable
              onPress={onConfirm}
              style={({ pressed }) => [
                styles.button,
                destructive
                  ? styles.dangerButton
                  : styles.confirmButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.confirmText}>
                {confirmText}
              </Text>
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
  modal: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    gap: 14,
    padding: 22,
    paddingBottom: 32,
  },
  handle: {
    alignSelf: 'center',
    backgroundColor: '#8E8E93',
    borderRadius: 3,
    height: 5,
    marginBottom: 2,
    width: 40,
  },
  title: {
    fontFamily: FONT.extrabold,
    color: '#111014',
    fontSize: 20,
  },
  message: {
    fontFamily: FONT.regular,
    color: '#5F5F66',
    fontSize: 14,
    lineHeight: 21,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  button: {
    alignItems: 'center',
    borderRadius: 12,
    flex: 1,
    padding: 14,
  },
  cancelButton: {
    backgroundColor: '#FFFFFF',
    borderColor: BORDER_COLOR,
    borderWidth: 1,
  },
  confirmButton: {
    backgroundColor: '#111014',
  },
  dangerButton: {
    backgroundColor: '#E00000',
  },
  cancelText: {
    fontFamily: FONT.bold,
    color: '#111014',
    fontSize: 14,
  },
  confirmText: {
    fontFamily: FONT.bold,
    color: '#FFFFFF',
    fontSize: 14,
  },
  pressed: {
    opacity: 0.65,
  },
});