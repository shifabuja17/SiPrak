import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { FONT } from '@/constants/fonts';

export interface DropdownOption {
  value: string;
  label: string;
  /** Keterangan kecil di bawah label, mis. ruangan & jam jadwal. */
  detail?: string;
}

function Chevron({ open }: { open: boolean }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path
        d={open ? 'M6 15L12 9L18 15' : 'M6 9L12 15L18 9'}
        stroke="#111014"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function Check() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Path
        d="M5 12.5L10 17.5L19 7"
        stroke="#F47321"
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/**
 * Dropdown sederhana: kolom berisi pilihan terpilih; bila ditekan, daftar pilihan
 * terbuka tepat di bawahnya. Tidak memakai Modal supaya aman dipakai di dalam modal form.
 */
export default function Dropdown({
  value,
  options,
  onChange,
  placeholder = 'Pilih salah satu',
  disabled = false,
  accessibilityLabel,
}: {
  value: string;
  options: DropdownOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  accessibilityLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value);

  return (
    <View style={styles.wrapper}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ expanded: open, disabled }}
        disabled={disabled}
        onPress={() => setOpen((previous) => !previous)}
        style={({ pressed }) => [
          styles.field,
          open && styles.fieldOpen,
          (pressed || disabled) && styles.dim,
        ]}
      >
        <View style={styles.fieldText}>
          <Text style={[styles.value, !selected && styles.placeholder]} numberOfLines={1}>
            {selected ? selected.label : placeholder}
          </Text>
          {selected?.detail ? (
            <Text style={styles.detail} numberOfLines={1}>
              {selected.detail}
            </Text>
          ) : null}
        </View>
        <Chevron open={open} />
      </Pressable>

      {open ? (
        <View style={styles.list}>
          {options.map((option, index) => {
            const active = option.value === value;
            return (
              <Pressable
                key={option.value}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                style={({ pressed }) => [
                  styles.option,
                  index > 0 && styles.optionDivider,
                  pressed && styles.optionPressed,
                ]}
              >
                <View style={styles.fieldText}>
                  <Text style={[styles.value, active && styles.valueActive]}>{option.label}</Text>
                  {option.detail ? <Text style={styles.detail}>{option.detail}</Text> : null}
                </View>
                {active ? <Check /> : null}
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: 6,
  },
  field: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#8E8E93',
    borderRadius: 11,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    minHeight: 48,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  fieldOpen: {
    borderColor: '#111014',
  },
  dim: {
    opacity: 0.6,
  },
  fieldText: {
    flex: 1,
    gap: 2,
  },
  value: {
    fontFamily: FONT.semibold,
    color: '#111014',
    fontSize: 14,
  },
  valueActive: {
    fontFamily: FONT.bold,
  },
  placeholder: {
    color: '#8E8E93',
  },
  detail: {
    fontFamily: FONT.regular,
    color: '#5F5F66',
    fontSize: 12,
  },
  list: {
    backgroundColor: '#FFFFFF',
    borderColor: '#8E8E93',
    borderRadius: 11,
    borderWidth: 1,
    overflow: 'hidden',
  },
  option: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  optionDivider: {
    borderTopColor: '#E4E4E7',
    borderTopWidth: 1,
  },
  optionPressed: {
    backgroundColor: '#F4F4F5',
  },
});
