import {
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';

import { FONT } from '@/constants/fonts';
import { BORDER_COLOR } from '@/constants/colors';

/**
 * Kolom teks dengan garis tepi digambar oleh View pembungkus, bukan oleh TextInput.
 * Di Android, garis tepi yang dipasang langsung di TextInput kadang terpotong di sisi
 * kanan (terutama dengan placeholder panjang); dengan pembungkus, garisnya selalu utuh.
 */
export default function FramedTextInput({
  frameStyle,
  disabled = false,
  style,
  multiline,
  ...props
}: TextInputProps & {
  frameStyle?: StyleProp<ViewStyle>;
  disabled?: boolean;
}) {
  return (
    <View style={[styles.frame, multiline && styles.frameMultiline, disabled && styles.disabled, frameStyle]}>
      <TextInput
        multiline={multiline}
        placeholderTextColor="#8E8E93"
        textAlignVertical={multiline ? 'top' : 'center'}
        {...props}
        style={[styles.input, multiline && styles.inputMultiline, style]}
      />
    </View>
  );
}


const styles = StyleSheet.create({
  frame: {
    backgroundColor: '#FFFFFF',
    borderColor: BORDER_COLOR,
    borderRadius: 11,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 48,
    overflow: 'hidden',
  },
  frameMultiline: {
    minHeight: 96,
  },
  disabled: {
    opacity: 0.6,
  },
  input: {
    color: '#111014',
    fontFamily: FONT.regular,
    fontSize: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  inputMultiline: {
    lineHeight: 20,
    minHeight: 96,
  },
});
