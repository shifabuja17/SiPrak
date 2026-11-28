import { Pressable, StyleSheet, Text, View } from 'react-native';

import { FONT } from '@/constants/fonts';
import { BORDER_COLOR } from '@/constants/colors';

/** Pilihan tab berbentuk pil (dipakai di tab Sesi dan halaman Cek Presensi). */
export default function SegmentedTabs<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { key: T; label: string }[];
  value: T;
  onChange: (key: T) => void;
}) {
  return (
    <View style={styles.switch} accessibilityRole="tablist">
      {options.map((item) => {
        const active = item.key === value;
        return (
          <Pressable
            key={item.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(item.key)}
            style={({ pressed }) => [
              styles.option,
              active && styles.optionActive,
              pressed && !active && styles.pressed,
            ]}
          >
            <Text style={[styles.optionText, active && styles.optionTextActive]}>
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  switch: {
    backgroundColor: '#FFFFFF',
    borderColor: BORDER_COLOR,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    padding: 4,
  },
  option: {
    alignItems: 'center',
    borderRadius: 999,
    flex: 1,
    justifyContent: 'center',
    minHeight: 40,
  },
  optionActive: {
    backgroundColor: '#111014',
  },
  optionText: {
    fontFamily: FONT.semibold,
    color: '#111014',
    fontSize: 13,
  },
  optionTextActive: {
    color: '#FFFFFF',
  },
  pressed: {
    opacity: 0.7,
  },
});
