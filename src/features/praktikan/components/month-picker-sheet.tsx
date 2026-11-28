import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FigmaIcon } from '@/components/common/FigmaIcon';
import { BORDER_COLOR, CARD_BG } from '@/constants/colors';
import { FONT } from '@/constants/fonts';

const ACCENT = '#F47321';
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

/**
 * Modal dari bawah untuk memilih bulan di beranda Praktikan. Tahun bisa digeser;
 * bulan yang punya sesi diberi titik oranye.
 */
export default function MonthPickerSheet({
  visible,
  selectedMonth,
  monthsWithSessions,
  onClose,
  onSelect,
}: {
  visible: boolean;
  /** "YYYY-MM" */
  selectedMonth: string;
  monthsWithSessions: ReadonlySet<string>;
  onClose: () => void;
  onSelect: (monthKey: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const [year, setYear] = useState(() => Number(selectedMonth.slice(0, 4)));

  // Setiap dibuka, mulai dari tahun bulan yang sedang dipilih.
  useEffect(() => {
    if (visible) setYear(Number(selectedMonth.slice(0, 4)));
  }, [visible, selectedMonth]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Tutup" />

        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 12) + 16 }]}>
          <View style={styles.handle} />
          <Text style={styles.title}>Pilih Bulan</Text>

          <View style={styles.yearRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Tahun sebelumnya"
              onPress={() => setYear((y) => y - 1)}
              style={({ pressed }) => [styles.yearButton, pressed && styles.pressed]}
            >
              <FigmaIcon name="arrowLeft2" size={18} color="#000000" />
            </Pressable>
            <Text style={styles.yearText}>{year}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Tahun berikutnya"
              onPress={() => setYear((y) => y + 1)}
              style={({ pressed }) => [styles.yearButton, pressed && styles.pressed]}
            >
              <FigmaIcon name="arrowRight2" size={18} color="#000000" />
            </Pressable>
          </View>

          <View style={styles.grid}>
            {MONTHS.map((label, index) => {
              const key = `${year}-${String(index + 1).padStart(2, '0')}`;
              const active = key === selectedMonth;
              return (
                <Pressable
                  key={key}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={`${label} ${year}`}
                  onPress={() => onSelect(key)}
                  style={({ pressed }) => [styles.month, active && styles.monthActive, pressed && styles.pressed]}
                >
                  {/* Titik (bulan yang punya sesi) melayang di atas, jadi nama bulan tetap di tengah. */}
                  {monthsWithSessions.has(key) ? (
                    <View style={[styles.dot, active && styles.dotActive]} />
                  ) : null}
                  <Text style={[styles.monthText, active && styles.monthTextActive]}>{label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: CARD_BG,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    gap: 16,
    paddingHorizontal: 26,
    paddingTop: 12,
  },
  handle: {
    alignSelf: 'center',
    backgroundColor: BORDER_COLOR,
    borderRadius: 3,
    height: 5,
    width: 44,
  },
  title: {
    color: '#000000',
    fontFamily: FONT.bold,
    fontSize: 18.5,
  },
  yearRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  yearButton: {
    alignItems: 'center',
    borderColor: BORDER_COLOR,
    borderRadius: 20,
    borderWidth: 1,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  yearText: {
    color: '#000000',
    fontFamily: FONT.semibold,
    fontSize: 16,
  },
  grid: {
    columnGap: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 10,
  },
  month: {
    alignItems: 'center',
    backgroundColor: CARD_BG,
    borderColor: BORDER_COLOR,
    borderRadius: 20,
    borderWidth: 1,
    flexBasis: '30%',
    flexGrow: 1,
    height: 56,
    justifyContent: 'center',
  },
  monthActive: {
    backgroundColor: ACCENT,
    borderColor: ACCENT,
  },
  monthText: {
    color: '#000000',
    fontFamily: FONT.semibold,
    fontSize: 15,
  },
  monthTextActive: {
    color: '#FFFFFF',
  },
  dot: {
    alignSelf: 'center',
    backgroundColor: ACCENT,
    borderRadius: 3,
    height: 6,
    position: 'absolute',
    top: 9,
    width: 6,
  },
  dotActive: {
    backgroundColor: '#FFFFFF',
  },
  pressed: {
    opacity: 0.7,
  },
});
