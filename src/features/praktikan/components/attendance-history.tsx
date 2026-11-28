import { useMemo, useState, type ReactNode } from 'react';
import { Pressable, StatusBar, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';

import { useTabBarOverlap } from '@/components/app-tabs';
import { FigmaIcon } from '@/components/common/FigmaIcon';
import { wibDayKey } from '@/components/common/session-schedule';
import { BORDER_COLOR, CARD_BG, PAGE_BG } from '@/constants/colors';
import { FONT } from '@/constants/fonts';
import type { LeaveRequestDoc, PraktikanSession, SessionAttendanceDoc } from '@/features/praktikan/types';
import { formatAttendanceTimeWIB, formatMeetingTitle } from '@/features/praktikan/utils/format';
import { useFitCount } from '@/features/praktikan/hooks/use-fit-count';
import { formatClock } from '@/utils/session-time';

import DatePickerSheet from './date-picker-sheet';
import FilterDropdown, { FilterChip, type FilterOption } from './filter-dropdown';
import HistoryHeader from './history-header';
import { BookIcon, FunnelIcon } from './praktikan-home-icons';

/**
 * Riwayat Kehadiran Praktikan sesuai desain Figma "RIWAYAT KEHADIRAN PRAKTIKAN":
 * header bunga, filter kelas / tanggal / urutan (menu melayang), kartu riwayat
 * (tidak bisa ditekan), dan halaman berisi 5 kartu.
 */

// ==========================================
// DATA RIWAYAT
// ==========================================

const TIME_ZONE = 'Asia/Jakarta';
/** Tinggi kartu riwayat terlengkap (3 baris info) sebelum terukur, dan jarak antar-kartu. */
const CARD_HEIGHT_ESTIMATE = 117;
const CARD_GAP = 6;
/** Jarak konten terakhir (tombol halaman) ke navbar melayang. */
const NAVBAR_GAP = 40;
const ALL = 'all';

const C = {
  ink: '#000000',
  accent: '#F47321',
  green: '#34C759',
  yellow: '#FFCC00',
  red: '#FF383C',
  grey: '#C7C7CC',
  muted: '#8E8E93',
  white: '#FFFFFF',
};

type HistoryKind = 'hadir' | 'izin' | 'tidak-hadir';

export interface HistoryEntry {
  kind: HistoryKind;
  session: PraktikanSession;
  /** Jam presensi tercatat ("13:07:56 WIB"); kosong bila tidak hadir. */
  recordedTime: string | null;
  /** Siapa yang mencatat kehadiran; kosong bila tidak hadir. */
  recordedBy: 'Praktikan' | 'Asisten Praktikum' | null;
  /** Inisial mata kuliah, mis. "PPK". */
  classKey: string;
  /** Tanggal sesi "YYYY-MM-DD" (WIB). */
  dayKey: string | null;
  sortTime: number;
}

const CHIP: Record<HistoryKind, { label: string; color: string }> = {
  hadir: { label: 'HADIR', color: C.green },
  izin: { label: 'IZIN', color: C.yellow },
  'tidak-hadir': { label: 'TIDAK HADIR', color: C.red },
};

/** Kata sambung yang tidak ikut jadi inisial. */
const SKIPPED_WORDS = new Set(['dan', 'di', 'ke', 'untuk', '&', 'and', 'of']);

/**
 * Inisial mata kuliah dari nama praktikum: "Pengembangan Platform Khusus D1" -> "PPK",
 * "Praktikum Sistem Operasi E2" -> "SO". Kata "Praktikum" di depan dan kode kelas di
 * belakang dibuang.
 */
function classInitials(practicumName: string): string {
  let words = practicumName.split(/\s+/).filter(Boolean);
  if (words.length > 1 && words[0].toLowerCase() === 'praktikum') words = words.slice(1);
  const last = words[words.length - 1] ?? '';
  const looksLikeCode = /\d/.test(last) || (last.length <= 2 && last === last.toUpperCase());
  if (words.length > 1 && looksLikeCode) words = words.slice(0, -1);
  const meaningful = words.filter((word) => !SKIPPED_WORDS.has(word.toLowerCase()));
  if (meaningful.length === 0) return practicumName.trim() || '-';
  if (meaningful.length === 1) return meaningful[0];
  return meaningful.map((word) => word[0].toUpperCase()).join('');
}

function clock(date: Date): string {
  return formatClock(date).replace('.', ':');
}

/** "Selasa, 24 November · 13:00 - 15:00 WIB" */
function sessionDateLine(session: PraktikanSession): string {
  if (!session.waktuMulai) return session.scheduleTime;
  const day = session.waktuMulai.toLocaleDateString('id-ID', {
    timeZone: TIME_ZONE,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  const range = session.waktuSelesai
    ? `${clock(session.waktuMulai)} - ${clock(session.waktuSelesai)} WIB`
    : `${clock(session.waktuMulai)} WIB`;
  return `${day} · ${range}`;
}

/** "24 Nov 2026" untuk label tombol filter tanggal. */
function dayLabel(dayKey: string): string {
  const date = new Date(`${dayKey}T12:00:00+07:00`);
  return date.toLocaleDateString('id-ID', {
    timeZone: TIME_ZONE,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

const SORT_OPTIONS: FilterOption[] = [
  { value: 'newest', label: 'Terbaru' },
  { value: 'oldest', label: 'Terlama' },
];

/**
 * Hadir (presensi sendiri), izin yang diterima Asisten, atau tidak hadir
 * (sesi sudah ditutup tanpa presensi dan tanpa izin yang diterima). Izin yang masih
 * menunggu tidak ditampilkan sampai diputuskan Asisten.
 */
export function buildHistoryEntries(
  sessions: readonly PraktikanSession[],
  attendanceBySessionId: Readonly<Record<string, SessionAttendanceDoc | null | undefined>>,
  leaveBySessionId: Readonly<Record<string, LeaveRequestDoc | null | undefined>>,
): HistoryEntry[] {
  const list: HistoryEntry[] = [];
  for (const session of sessions) {
    const attendance = attendanceBySessionId[session.id];
    const leave = leaveBySessionId[session.id];
    const base = {
      session,
      classKey: classInitials(session.practicumName),
      dayKey: session.waktuMulai ? wibDayKey(session.waktuMulai) : null,
      sortTime: session.waktuMulai?.getTime() ?? session.createdAt?.getTime() ?? 0,
    };
    if (attendance) {
      list.push({
        ...base,
        kind: 'hadir',
        recordedTime: formatAttendanceTimeWIB(attendance.waktu),
        recordedBy: 'Praktikan',
      });
    } else if (leave?.status === 'diterima') {
      list.push({
        ...base,
        kind: 'izin',
        recordedTime: formatAttendanceTimeWIB(leave.reviewedAt ?? null),
        recordedBy: 'Asisten Praktikum',
      });
    } else if (session.status === 'ditutup' && leave?.status !== 'menunggu') {
      list.push({ ...base, kind: 'tidak-hadir', recordedTime: null, recordedBy: null });
    }
  }
  return list;
}

// ==========================================
// HALAMAN
// ==========================================

export default function AttendanceHistory({
  entries,
  banners,
  placeholder,
}: {
  entries: readonly HistoryEntry[];
  /** Banner galat ringan di bawah filter. */
  banners?: ReactNode;
  /** Pengganti daftar saat memuat / galat. */
  placeholder?: ReactNode;
}) {
  const [classFilter, setClassFilter] = useState(ALL);
  const [dayFilter, setDayFilter] = useState(ALL);
  const [sort, setSort] = useState('newest');
  const [page, setPage] = useState(0);
  // Halaman tidak digulir: jumlah kartu per halaman = yang muat di atas tombol halaman.
  const tabBarOverlap = useTabBarOverlap();
  // Ukuran kartu diukur ulang dari awal hanya saat filter/data berganti (lihat useFitCount).
  // Minimal 4 kartu per halaman; judul dibatasi 1 baris supaya tinggi kartu seragam.
  const { count: pageSize, onAreaLayout, itemLayout } = useFitCount(CARD_HEIGHT_ESTIMATE, CARD_GAP, {
    fallback: 4,
    min: 4,
    resetKey: `${classFilter}|${dayFilter}|${sort}|${entries.length}`,
  });

  const classOptions = useMemo<FilterOption[]>(() => {
    const keys = [...new Set(entries.map((entry) => entry.classKey))].sort((a, b) =>
      a.localeCompare(b, 'id'),
    );
    return [{ value: ALL, label: 'Semua Kelas' }, ...keys.map((key) => ({ value: key, label: key }))];
  }, [entries]);

  // Tanggal yang punya riwayat (mengikuti kelas terpilih) diberi titik di kalender.
  const markedDays = useMemo(() => {
    const days = new Set<string>();
    for (const entry of entries) {
      if (entry.dayKey && (classFilter === ALL || entry.classKey === classFilter)) days.add(entry.dayKey);
    }
    return days;
  }, [entries, classFilter]);
  const [datePickerVisible, setDatePickerVisible] = useState(false);

  const filtered = useMemo(() => {
    const list = entries.filter(
      (entry) =>
        (classFilter === ALL || entry.classKey === classFilter) &&
        (dayFilter === ALL || entry.dayKey === dayFilter),
    );
    const direction = sort === 'oldest' ? 1 : -1;
    return list.sort((a, b) => (a.sortTime - b.sortTime) * direction);
  }, [entries, classFilter, dayFilter, sort]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pageCount - 1);
  const visible = filtered.slice(currentPage * pageSize, (currentPage + 1) * pageSize);

  const applyFilter = (setter: (value: string) => void) => (value: string) => {
    setter(value);
    setPage(0);
  };

  const isFiltered = classFilter !== ALL || dayFilter !== ALL;

  return (
    <View style={styles.page}>
      <StatusBar barStyle="dark-content" />
      <HistoryHeader title="Riwayat Kehadiran" />

      <View style={styles.filters}>
        <FilterDropdown
          accessibilityLabel="Filter kelas"
          icon={<BookIcon size={14} color={C.accent} />}
          label={classFilter === ALL ? 'Semua Kelas' : classFilter}
          options={classOptions}
          value={classFilter}
          onChange={applyFilter(setClassFilter)}
        />
        <FilterChip
          accessibilityLabel="Filter tanggal"
          icon={<FigmaIcon name="calendar" size={14} color={C.accent} />}
          label={dayFilter === ALL ? 'Semua Tanggal' : dayLabel(dayFilter)}
          active={datePickerVisible}
          onPress={() => setDatePickerVisible(true)}
        />
        <FilterDropdown
          accessibilityLabel="Urutkan"
          icon={<FunnelIcon size={14} color={C.accent} />}
          label={sort === 'oldest' ? 'Terlama' : 'Terbaru'}
          options={SORT_OPTIONS}
          value={sort}
          onChange={applyFilter(setSort)}
        />
      </View>

      {banners ? <View style={styles.banners}>{banners}</View> : null}

      {/* Isi berhenti di atas navbar melayang; halaman tidak bisa digulir. */}
      <View style={[styles.body, { paddingBottom: tabBarOverlap + NAVBAR_GAP }]}>
        {placeholder ? (
          placeholder
        ) : visible.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>
              {isFiltered
                ? 'Tidak ada riwayat yang cocok dengan filter'
                : 'Riwayat kehadiran kamu akan muncul disini'}
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.list} onLayout={onAreaLayout}>
              {visible.map((entry) => (
                <HistoryCard key={entry.session.id} entry={entry} onLayout={itemLayout(entry.session.id)} />
              ))}
            </View>
            {/* Tempat tombol halaman selalu disisihkan supaya posisinya tetap. */}
            <View style={styles.pagerSlot}>
              {pageCount > 1 ? (
                <Pager page={currentPage} pageCount={pageCount} onChange={setPage} />
              ) : null}
            </View>
          </>
        )}
      </View>

      <DatePickerSheet
        visible={datePickerVisible}
        value={dayFilter === ALL ? null : dayFilter}
        todayKey={wibDayKey(new Date())}
        markedDays={markedDays}
        onClose={() => setDatePickerVisible(false)}
        onSelect={(dayKey) => {
          applyFilter(setDayFilter)(dayKey ?? ALL);
          setDatePickerVisible(false);
        }}
      />
    </View>
  );
}

// ==========================================
// KARTU RIWAYAT
// ==========================================

function HistoryCard({
  entry,
  onLayout,
}: {
  entry: HistoryEntry;
  onLayout?: (event: LayoutChangeEvent) => void;
}) {
  const { session } = entry;
  const chip = CHIP[entry.kind];

  return (
    <View
      style={styles.card}
      onLayout={onLayout}
      accessible
      accessibilityLabel={`${session.practicumName}, ${chip.label.toLowerCase()}`}
    >
      {/* Judul & badge sejajar: judul memakai sisa lebar setelah badge. */}
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {session.practicumName}
        </Text>
        <View style={[styles.chip, { backgroundColor: chip.color }]}>
          <Text style={styles.chipText}>{chip.label}</Text>
        </View>
      </View>
      <Text style={styles.cardModule} numberOfLines={1}>
        {formatMeetingTitle(session.moduleTitle)}
      </Text>

      {/* Info per baris: tanggal & jam sesi / lokasi / jam presensi & pencatat. */}
      <View style={styles.metaList}>
        <View style={styles.metaRow}>
          <MetaItem icon="calendarBold" text={sessionDateLine(session)} />
        </View>
        <View style={styles.metaRow}>
          <MetaItem icon="locationBold" text={session.classRoom} />
        </View>
        {entry.recordedBy ? (
          <View style={styles.metaRow}>
            {entry.recordedTime ? <MetaItem icon="timeBold" text={entry.recordedTime} /> : null}
            <MetaItem icon="profileBold" text={`Oleh: ${entry.recordedBy}`} />
          </View>
        ) : null}
      </View>
    </View>
  );
}

function MetaItem({
  icon,
  text,
}: {
  icon: 'calendarBold' | 'locationBold' | 'timeBold' | 'profileBold';
  text: string;
}) {
  return (
    <View style={styles.metaItem}>
      <FigmaIcon name={icon} size={13} color={C.accent} />
      <Text style={styles.metaText} numberOfLines={1}>
        {text}
      </Text>
    </View>
  );
}

// ==========================================
// HALAMAN (sebelumnya / nomor / berikutnya)
// ==========================================

function Pager({
  page,
  pageCount,
  onChange,
}: {
  page: number;
  pageCount: number;
  onChange: (page: number) => void;
}) {
  const canPrev = page > 0;
  const canNext = page < pageCount - 1;

  return (
    <View style={styles.pager}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Halaman sebelumnya"
        accessibilityState={{ disabled: !canPrev }}
        disabled={!canPrev}
        onPress={() => onChange(page - 1)}
        style={({ pressed }) => [
          styles.pagerButton,
          canPrev ? styles.pagerEnabled : styles.pagerDisabled,
          pressed && styles.pressed,
        ]}
      >
        <FigmaIcon name="arrowLeft2" size={24} color={canPrev ? C.white : C.grey} />
      </Pressable>
      <View style={[styles.pagerButton, styles.pagerNumber]} accessibilityLabel={`Halaman ${page + 1} dari ${pageCount}`}>
        <Text style={styles.pagerNumberText}>{page + 1}</Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Halaman berikutnya"
        accessibilityState={{ disabled: !canNext }}
        disabled={!canNext}
        onPress={() => onChange(page + 1)}
        style={({ pressed }) => [
          styles.pagerButton,
          canNext ? styles.pagerEnabled : styles.pagerDisabled,
          pressed && styles.pressed,
        ]}
      >
        <FigmaIcon name="arrowRight2" size={24} color={canNext ? C.white : C.grey} />
      </Pressable>
    </View>
  );
}

// ==========================================
// STYLE (berdasar desain 402pt, font & kartu diperbesar agar terbaca)
// ==========================================

const H_PADDING = 26;

const styles = StyleSheet.create({
  page: {
    backgroundColor: PAGE_BG,
    flex: 1,
  },
  filters: {
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'flex-end',
    marginTop: 14,
    paddingHorizontal: H_PADDING,
  },
  banners: {
    gap: 8,
    marginTop: 15,
    paddingHorizontal: H_PADDING,
  },
  body: {
    marginTop: 12,
    paddingHorizontal: H_PADDING,
    flex: 1,
  },
  list: {
    gap: CARD_GAP,
    flex: 1,
    overflow: 'hidden',
  },

  // Kartu: lebar 350, radius 18
  card: {
    backgroundColor: CARD_BG,
    borderColor: BORDER_COLOR,
    borderRadius: 18,
    borderWidth: 1,
    paddingBottom: 12,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  cardHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 8,
  },
  cardTitle: {
    color: C.ink,
    fontFamily: FONT.bold,
    fontSize: 14,
    letterSpacing: -0.3,
    lineHeight: 18,
    flex: 1,
  },
  cardModule: {
    color: C.accent,
    fontFamily: FONT.semibold,
    fontSize: 13,
    letterSpacing: -0.2,
    lineHeight: 16,
    marginTop: 2,
  },
  metaList: {
    gap: 3,
    marginTop: 7,
  },
  metaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 14,
  },
  metaItem: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 5,
    flexShrink: 1,
  },
  metaText: {
    color: C.accent,
    flexShrink: 1,
    fontFamily: FONT.medium,
    fontSize: 11,
    letterSpacing: -0.15,
    lineHeight: 14,
  },
  chip: {
    alignItems: 'center',
    borderRadius: 9,
    height: 18,
    justifyContent: 'center',
    paddingHorizontal: 10,
    marginRight: -3,
    marginTop: -1,
  },
  chipText: {
    color: C.white,
    fontFamily: FONT.bold,
    fontSize: 7.5,
    letterSpacing: 0.2,
  },

  // Kosong: kartu putih bergaris putus-putus, radius 20
  emptyCard: {
    alignItems: 'center',
    backgroundColor: CARD_BG,
    borderColor: C.grey,
    borderRadius: 20,
    borderStyle: 'dashed',
    borderWidth: 1,
    height: 96,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  emptyText: {
    color: C.muted,
    fontFamily: FONT.medium,
    fontSize: 13.5,
    letterSpacing: -0.2,
    textAlign: 'center',
  },

  // Halaman: kotak 39, radius 10, jarak 11
  pager: {
    flexDirection: 'row',
    gap: 11,
    justifyContent: 'center',
  },
  pagerSlot: {
    height: 42,
    marginTop: 8,
  },
  pagerButton: {
    alignItems: 'center',
    borderRadius: 11,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  pagerEnabled: {
    backgroundColor: C.accent,
  },
  pagerDisabled: {
    borderColor: C.grey,
    borderWidth: 1,
    backgroundColor: CARD_BG,
  },
  pagerNumber: {
    backgroundColor: CARD_BG,
    borderColor: C.grey,
    borderWidth: 1,
  },
  pagerNumberText: {
    color: C.ink,
    fontFamily: FONT.medium,
    fontSize: 19,
  },
  pressed: {
    opacity: 0.7,
  },
});
