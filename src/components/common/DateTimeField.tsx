import RNDateTimePicker, {
  DateTimePickerAndroid,
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { formatClock, formatSessionDate } from '@/utils/session-time';

export interface DateTimeFieldProps {
  mode: 'date' | 'time';
  value: Date;
  onChange: (value: Date) => void;
  disabled?: boolean;
  minimumDate?: Date;
  accessibilityLabel?: string;
}

function formatValue(mode: 'date' | 'time', value: Date): string {
  return mode === 'date' ? formatSessionDate(value) : `${formatClock(value)} WIB`;
}

/** Pemilih tanggal / jam bawaan perangkat (Android: dialog, iOS: compact picker). */
export default function DateTimeField({
  mode,
  value,
  onChange,
  disabled = false,
  minimumDate,
  accessibilityLabel,
}: DateTimeFieldProps) {
  function handleChange(event: DateTimePickerEvent, selected?: Date) {
    if (event.type === 'set' && selected) {
      onChange(selected);
    }
  }

  if (Platform.OS === 'ios') {
    return (
      <View style={[styles.field, styles.iosField, disabled && styles.disabled]}>
        <RNDateTimePicker
          value={value}
          mode={mode}
          display="compact"
          locale="id-ID"
          minimumDate={minimumDate}
          disabled={disabled}
          onChange={handleChange}
          accessibilityLabel={accessibilityLabel}
        />
      </View>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      disabled={disabled}
      onPress={() =>
        DateTimePickerAndroid.open({
          value,
          mode,
          is24Hour: true,
          minimumDate,
          onChange: handleChange,
        })
      }
      style={({ pressed }) => [
        styles.field,
        disabled && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      <Text style={styles.value}>{formatValue(mode, value)}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  field: {
    backgroundColor: '#FFFFFF',
    borderColor: '#D9D9D9',
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  iosField: {
    alignItems: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 6,
  },
  value: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '600',
  },
  disabled: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.65,
  },
});
