import { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import type { DateTimeFieldProps } from './DateTimeField';
import { FONT } from '@/constants/fonts';

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function toText(mode: 'date' | 'time', value: Date): string {
  return mode === 'date'
    ? `${pad(value.getDate())}/${pad(value.getMonth() + 1)}/${value.getFullYear()}`
    : `${pad(value.getHours())}:${pad(value.getMinutes())}`;
}

/** Mengurai "DD/MM/YYYY" atau "HH:MM"; null bila tidak valid. */
function parseText(mode: 'date' | 'time', text: string, base: Date): Date | null {
  if (mode === 'date') {
    const match = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(text.trim());
    if (!match) return null;
    const [day, month, year] = [Number(match[1]), Number(match[2]), Number(match[3])];
    const result = new Date(base);
    result.setFullYear(year, month - 1, day);
    return result.getDate() === day && result.getMonth() === month - 1 ? result : null;
  }

  const match = /^(\d{1,2})[.:](\d{2})$/.exec(text.trim());
  if (!match) return null;
  const [hours, minutes] = [Number(match[1]), Number(match[2])];
  if (hours > 23 || minutes > 59) return null;
  const result = new Date(base);
  result.setHours(hours, minutes, 0, 0);
  return result;
}

/**
 * Versi web: picker native tidak tersedia di browser, jadi dipakai input teks
 * berformat (DD/MM/YYYY untuk tanggal, HH:MM untuk jam).
 */
export default function DateTimeField({
  mode,
  value,
  onChange,
  disabled = false,
  minimumDate,
  accessibilityLabel,
}: DateTimeFieldProps) {
  const [text, setText] = useState(() => toText(mode, value));
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    setText(toText(mode, value));
    setInvalid(false);
  }, [mode, value]);

  function commit() {
    const parsed = parseText(mode, text, value);
    const minimumDay = minimumDate ? new Date(minimumDate) : null;
    minimumDay?.setHours(0, 0, 0, 0);
    const tooEarly = parsed && minimumDay && mode === 'date' && parsed < minimumDay;
    if (!parsed || tooEarly) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    onChange(parsed);
  }

  return (
    <View style={styles.wrapper}>
      <TextInput
        accessibilityLabel={accessibilityLabel}
        value={text}
        onChangeText={(next) => {
          setText(next);
          setInvalid(false);
        }}
        onBlur={commit}
        onSubmitEditing={commit}
        editable={!disabled}
        placeholder={mode === 'date' ? 'DD/MM/YYYY' : 'HH:MM'}
        placeholderTextColor="#8E8E93"
        style={[styles.input, invalid && styles.inputInvalid, disabled && styles.disabled]}
      />
      {invalid ? (
        <Text style={styles.hint}>
          {mode === 'date'
            ? 'Format tanggal DD/MM/YYYY dan tidak boleh sebelum hari ini.'
            : 'Format jam HH:MM (00:00 - 23:59).'}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: 4,
  },
  input: {
    fontFamily: FONT.regular,
    backgroundColor: '#FFFFFF',
    borderColor: '#8E8E93',
    borderRadius: 12,
    borderWidth: 1,
    color: '#111014',
    fontSize: 14,
    minHeight: 48,
    paddingHorizontal: 14,
  },
  inputInvalid: {
    borderColor: '#E00000',
  },
  hint: {
    fontFamily: FONT.regular,
    color: '#E00000',
    fontSize: 12,
  },
  disabled: {
    opacity: 0.5,
  },
});
