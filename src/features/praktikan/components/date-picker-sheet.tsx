import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FigmaIcon } from '@/components/common/FigmaIcon';
import { BORDER_COLOR, CARD_BG } from '@/constants/colors';
import { FONT } from '@/constants/fonts';

const ACCENT = '#F47321';
const MUTED = '#8E8E93';
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];
/** Minggu dimulai Senin. */
const WEEKDAYS = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/** Sel kalender bulan `year`-`month` (1-12): null untuk kotak kosong sebelum tanggal 1. */
function monthCells(year: number, month: number): (number | null)[] {
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  // getUTCDay: 0 = Minggu. Geser supaya Senin = 0.
  const leading = (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() + 6) % 7;
  const cells: (number | null)[] = Array.from({ length: leading }, () => null);
  for (let day = 1; day <= daysInMonth; day += 1) cells.push(day);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

/**
 * Modal kalender dari bawah untuk filter tanggal Riwayat Kehadiran. Tahun digeser dengan
 * panah, bulan dipilih dari 12 pilihan, lalu tanggal dipilih dari kalender. Tanggal yang
 * punya riwayat diberi titik oranye; "Semua Tanggal" menghapus filter.
 */
export default function DatePickerSheet({
  visible,
  value,
  todayKey,
  markedDays,
  onClose,
  onSelect,
}: {
  visible: boolean;
  /** Tanggal terpilih "YYYY-MM-DD", atau null untuk semua tanggal. */
  value: string | null;
  /** Hari ini "YYYY-MM-DD" (WIB). */
  todayKey: string;
  /** Tanggal "YYYY-MM-DD" yang punya riwayat. */
  markedDays: ReadonlySet<string>;
  onClose: () => void;
  onSelect: (dayKey: string | null) => void;
}) {
  const insets = useSafeAreaInsets();
  const start = value ?? todayKey;
  const [year, setYear] = useState(() => Number(start.slice(0, 4)));
  const [month, setMonth] = useState(() => Number(start.slice(5, 7)));

  // Setiap dibuka, tampilkan bulan dari tanggal terpilih (atau hari ini).
  useEffect(() => {
    if (!visible) return;
    const key = value ?? todayKey;
    setYear(Number(key.slice(0, 4)));
    setMonth(Number(key.slice(5, 7)));
  }, [visible, value, todayKey]);

  const cells = useMemo(() => monthCells(year, month), [year, month]);
  const monthsWithHistory = useMemo(
    () => new Set([...markedDays].map((key) => key.slice(0, 7))),
    [markedDays],
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Tutup" />

        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 12) + 16 }]}>
          <View style={styles.handle} />

          <View style={styles.titleRow}>
            <Text style={styles.title}>Pilih Tanggal</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Tampilkan semua tanggal"
              onPress={() => onSelect(null)}
              style={({ pressed }) => [styles.resetButton, value === null && styles.resetActive, pressed && styles.pressed]}
            >
              <Text style={[styles.resetText, value === null && styles.resetTextActive]}>Semua Tanggal</Text>
            </Pressable>
          </View>

          {/* TAHUN */}
          <View style={styles.yearRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Tahun sebelumnya"
              onPress={() => setYear((y) => y - 1)}
              style={({ pressed }) => [styles.arrowButton, pressed && styles.pressed]}
            >
              <FigmaIcon name="arrowLeft2" size={18} color="#000000" />
            </Pressable>
            <Text style={styles.yearText}>{year}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Tahun berikutnya"
              onPress={() => setYear((y) => y + 1)}
              style={({ pressed }) => [styles.arrowButton, pressed && styles.pressed]}
            >
              <FigmaIcon name="arrowRight2" size={18} color="#000000" />
            </Pressable>
          </View>

          {/* BULAN */}
          <View style={styles.monthGrid}>
            {MONTHS.map((label, index) => {
              const monthNumber = index + 1;
              const active = monthNumber === month;
              const hasHistory = monthsWithHistory.has(`${year}-${pad(monthNumber)}`);
              return (
                <Pressable
                  key={label}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={`${MONTH_NAMES[index]} ${year}`}
                  onPress={() => setMonth(monthNumber)}
                  style={({ pressed }) => [styles.month, active && styles.monthActive, pressed && styles.pressed]}
                >
                  {hasHistory ? <View style={[styles.monthDot, active && styles.dotOnAccent]} /> : null}
                  <Text style={[styles.monthText, active && styles.textOnAccent]}>{label}</Text>
                </Pressable>
              );
            })}
          </View>

          {/* TANGGAL */}
          <View style={styles.calendar}>
            <Text style={styles.calendarTitle}>
              {MONTH_NAMES[month - 1]} {year}
            </Text>
            <View style={styles.week}>
              {WEEKDAYS.map((label) => (
                <Text key={label} style={styles.weekday}>
                  {label}
                </Text>
              ))}
            </View>
            <View style={styles.days}>
              {cells.map((day, index) => {
                if (day === null) return <View key={`empty-${index}`} style={styles.dayCell} />;
                const key = `${year}-${pad(month)}-${pad(day)}`;
                const selected = key === value;
                const today = key === todayKey;
                const marked = markedDays.has(key);
                return (
                  <View key={key} style={styles.dayCell}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      accessibilityLabel={`${day} ${MONTH_NAMES[month - 1]} ${year}${marked ? ', ada riwayat' : ''}`}
                      onPress={() => onSelect(key)}
                      style={({ pressed }) => [
                        styles.day,
                        today && !selected && styles.dayToday,
                        selected && styles.daySelected,
                        pressed && styles.pressed,
                      ]}
                    >
                      <Text style={[styles.dayText, selected && styles.textOnAccent]}>{day}</Text>
                      {marked ? <View style={[styles.dayDot, selected && styles.dotOnAccent]} /> : null}
                    </Pressable>
                  </View>
                );
              })}
            </View>
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
    gap: 14,
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
  titleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  title: {
    color: '#000000',
    fontFamily: FONT.bold,
    fontSize: 18.5,
  },
  resetButton: {
    borderColor: ACCENT,
    borderRadius: 16,
    borderWidth: 1,
    height: 32,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  resetActive: {
    backgroundColor: ACCENT,
  },
  resetText: {
    color: ACCENT,
    fontFamily: FONT.semibold,
    fontSize: 12.5,
  },
  resetTextActive: {
    color: '#FFFFFF',
  },
  yearRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  arrowButton: {
    alignItems: 'center',
    borderColor: BORDER_COLOR,
    borderRadius: 18,
    borderWidth: 1,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  yearText: {
    color: '#000000',
    fontFamily: FONT.semibold,
    fontSize: 16,
  },
  monthGrid: {
    columnGap: 6,
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 6,
  },
  month: {
    alignItems: 'center',
    borderColor: BORDER_COLOR,
    borderRadius: 12,
    borderWidth: 1,
    // 6 kolom: (100% - 5 x 6) / 6
    flexBasis: '14%',
    flexGrow: 1,
    height: 36,
    justifyContent: 'center',
  },
  monthActive: {
    backgroundColor: ACCENT,
    borderColor: ACCENT,
  },
  monthText: {
    color: '#000000',
    fontFamily: FONT.semibold,
    fontSize: 13,
  },
  monthDot: {
    alignSelf: 'center',
    backgroundColor: ACCENT,
    borderRadius: 2,
    height: 4,
    position: 'absolute',
    top: 4,
    width: 4,
  },
  calendar: {
    borderColor: BORDER_COLOR,
    borderRadius: 20,
    borderWidth: 1,
    paddingBottom: 8,
    paddingHorizontal: 8,
    paddingTop: 12,
  },
  calendarTitle: {
    color: '#000000',
    fontFamily: FONT.bold,
    fontSize: 15,
    marginBottom: 8,
    textAlign: 'center',
  },
  week: {
    flexDirection: 'row',
  },
  weekday: {
    color: MUTED,
    flex: 1,
    fontFamily: FONT.medium,
    fontSize: 12,
    paddingBottom: 4,
    textAlign: 'center',
  },
  days: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    alignItems: 'center',
    height: 42,
    justifyContent: 'center',
    width: `${100 / 7}%`,
  },
  day: {
    alignItems: 'center',
    borderRadius: 19,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  dayToday: {
    borderColor: ACCENT,
    borderWidth: 1,
  },
  daySelected: {
    backgroundColor: ACCENT,
  },
  dayText: {
    color: '#000000',
    fontFamily: FONT.semibold,
    fontSize: 14,
  },
  dayDot: {
    alignSelf: 'center',
    backgroundColor: ACCENT,
    borderRadius: 2,
    bottom: 5,
    height: 4,
    position: 'absolute',
    width: 4,
  },
  dotOnAccent: {
    backgroundColor: '#FFFFFF',
  },
  textOnAccent: {
    color: '#FFFFFF',
  },
  pressed: {
    opacity: 0.7,
  },
});
