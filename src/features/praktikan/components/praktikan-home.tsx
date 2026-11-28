import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
  type ScrollViewInstance,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';

import { useTabBarOverlap } from '@/components/app-tabs';
import { FigmaIcon } from '@/components/common/FigmaIcon';
import { pickFeatured, sessionDayKey, wibDayKey } from '@/components/common/session-schedule';
import { BORDER_COLOR, CARD_BG, PAGE_BG } from '@/constants/colors';
import { FONT } from '@/constants/fonts';
import { useAuth } from '@/context/AuthContext';
import { NotificationStatusBanner } from '@/features/notifications/components/notification-status-banner';
import type { PraktikanSession, SessionAttendanceDoc } from '@/features/praktikan/types';
import { useFitCount } from '@/features/praktikan/hooks/use-fit-count';
import { formatMeetingTitle } from '@/features/praktikan/utils/format';
import { formatClock } from '@/utils/session-time';

import { CheckIcon } from './praktikan-home-icons';
import MonthPickerSheet from './month-picker-sheet';

/**
 * Beranda Praktikan sesuai desain Figma "BERANDA PRAKTIKAN" (4 skenario):
 * - sorotan sesi berlangsung, belum presensi  -> tombol "Presensi"
 * - sorotan sesi berlangsung, sudah presensi  -> tombol "Sudah Presensi"
 * - sorotan sesi mendatang                     -> chip "MENDATANG", tombol "Cek Detail"
 * - tidak ada sesi mendatang                   -> teks pengganti di kartu sorotan
 * Di bawahnya: pil bulan, strip tanggal, dan daftar "Jadwal Kamu" berhalaman.
 */

const TIME_ZONE = 'Asia/Jakarta';

const C = {
  ink: '#000000',
  muted: '#8E8E93',
  mutedText: '#A7A8AB',
  accent: '#F47321',
  sky: '#65D0F4',
  green: '#34C759',
  white: '#FFFFFF',
  chipSoft: '#F2F2F7',
  chipDone: '#E5E5EA',
};

const H_PADDING = 26;
/** Tanggal bulan sebelum/sesudah yang ikut tampil (abu-abu) di ujung strip. */
const EDGE_DAYS = 7;
const DAY_WIDTH = 60;
const DAY_GAP = 10;
/** Tinggi kartu sesi sebelum terukur & jarak antar-kartu (jumlah per halaman dihitung dari ruang). */
const CARD_HEIGHT_ESTIMATE = 94;
const CARD_GAP = 10;
/** Abu-abu tombol halaman nonaktif (sama dengan Riwayat Kehadiran). */
const PAGER_GREY = '#C7C7CC';
/** Jarak kartu terakhir ke navbar melayang. */
const NAVBAR_GAP = 16;

const DAY_LABELS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

// ==========================================
// HELPER TANGGAL (WIB)
// ==========================================

/** Tengah hari WIB untuk kunci "YYYY-MM-DD" (aman dari pergeseran zona waktu). */
function dateFromKey(key: string): Date {
  return new Date(`${key}T12:00:00+07:00`);
}

/** "24, November 2026" (format sapaan pada desain). */
function greetingDate(date: Date): string {
  const day = date.toLocaleDateString('id-ID', { timeZone: TIME_ZONE, day: 'numeric' });
  const monthYear = date.toLocaleDateString('id-ID', {
    timeZone: TIME_ZONE,
    month: 'long',
    year: 'numeric',
  });
  return `${day}, ${monthYear}`;
}

/** "November 2026" */
function monthLabel(date: Date): string {
  return date.toLocaleDateString('id-ID', { timeZone: TIME_ZONE, month: 'long', year: 'numeric' });
}

/** "Selasa, 24 November 2026" */
function fullDate(date: Date): string {
  return date.toLocaleDateString('id-ID', {
    timeZone: TIME_ZONE,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function timeRange(session: PraktikanSession): string {
  if (!session.waktuMulai) return session.scheduleTime;
  const start = formatClock(session.waktuMulai).replace('.', ':');
  const end = session.waktuSelesai ? formatClock(session.waktuSelesai).replace('.', ':') : null;
  return end ? `${start} - ${end} WIB` : `${start} WIB`;
}

interface CalendarDay {
  key: string;
  label: string;
  dayOfMonth: number;
}

/** Seluruh tanggal bulan `monthKey` ("YYYY-MM") ditambah EDGE_DAYS hari di kiri & kanan. */
function buildDays(monthKey: string): CalendarDay[] {
  const [year, month] = monthKey.split('-').map(Number);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const first = dateFromKey(`${monthKey}-01`);
  const total = daysInMonth + EDGE_DAYS * 2;
  return Array.from({ length: total }, (_, index) => {
    const date = new Date(first.getTime() + (index - EDGE_DAYS) * 86_400_000);
    const key = wibDayKey(date);
    return { key, label: DAY_LABELS[date.getUTCDay()], dayOfMonth: Number(key.slice(8, 10)) };
  });
}

// ==========================================
// STATUS KARTU
// ==========================================

type ChipKind = 'waiting' | 'live' | 'done';

const CHIP_LABEL: Record<ChipKind, string> = {
  waiting: 'BELUM DIBUKA',
  live: 'BERLANGSUNG',
  done: 'SELESAI',
};

function chipKind(session: PraktikanSession): ChipKind {
  if (session.status === 'dibuka') return 'live';
  if (session.status === 'ditutup') return 'done';
  return 'waiting';
}

function openAttendance(sessionId: string) {
  router.push({ pathname: '/attendance/[sessionId]', params: { sessionId } });
}

// ==========================================
// HALAMAN
// ==========================================

export interface PraktikanHomeProps {
  sessions: PraktikanSession[];
  attendanceBySessionId: Record<string, SessionAttendanceDoc | null>;
  /** Banner error / info yang ditampilkan di atas kartu sorotan. */
  banners?: ReactNode;
  /** Ditampilkan bila belum ada sesi sama sekali (loading, error, kosong). */
  emptyState?: ReactNode;
}

export default function PraktikanHome({
  sessions,
  attendanceBySessionId,
  banners,
  emptyState,
}: PraktikanHomeProps) {
  const { profile } = useAuth();

  const now = new Date();
  const todayKey = wibDayKey(now);
  const [selectedDay, setSelectedDay] = useState<string>(todayKey);
  const [page, setPage] = useState(0);
  const [monthPickerVisible, setMonthPickerVisible] = useState(false);
  // Beranda tidak digulir: kartu "Jadwal Kamu" per halaman = yang muat di atas navbar,
  // minimal 2.
  const tabBarOverlap = useTabBarOverlap();
  const { count: pageSize, onAreaLayout, itemLayout } = useFitCount(CARD_HEIGHT_ESTIMATE, CARD_GAP, {
    fallback: 2,
    min: 2,
    resetKey: selectedDay,
  });

  // Halaman daftar kembali ke awal setiap tanggal berganti.
  useEffect(() => {
    setPage(0);
  }, [selectedDay]);

  const featured = pickFeatured(sessions);

  const monthsWithSessions = useMemo(
    () =>
      new Set(
        sessions
          .map(sessionDayKey)
          .filter((k): k is string => k !== null)
          .map((k) => k.slice(0, 7)),
      ),
    [sessions],
  );

  const daySessions = useMemo(
    () =>
      sessions
        .filter((s) => sessionDayKey(s) === selectedDay)
        .sort((a, b) => (a.waktuMulai?.getTime() ?? 0) - (b.waktuMulai?.getTime() ?? 0)),
    [sessions, selectedDay],
  );
  const pageCount = Math.max(1, Math.ceil(daySessions.length / pageSize));
  const currentPage = Math.min(page, pageCount - 1);
  const visible = daySessions.slice(currentPage * pageSize, currentPage * pageSize + pageSize);

  const name = profile?.nama?.trim() || 'Praktikan';
  const selectedDate = dateFromKey(selectedDay);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar barStyle="dark-content" />
      <View style={[styles.content, { paddingBottom: tabBarOverlap + NAVBAR_GAP }]}>
        {/* SAPAAN: avatar kiri, teks di tengah layar */}
        <View style={styles.header}>
          <View style={styles.avatar} accessibilityElementsHidden importantForAccessibility="no">
            <FigmaIcon name="profile" size={24} color={C.muted} />
          </View>
          <View style={styles.greeting}>
            <Text style={styles.greetingTitle} numberOfLines={1}>
              Halo, {name}
            </Text>
            <Text style={styles.greetingDate}>{greetingDate(now)}</Text>
          </View>
          <View style={styles.avatarSpacer} />
        </View>

        {banners ? <View style={styles.banners}>{banners}</View> : null}

        {/* KARTU SOROTAN */}
        <FeaturedCard
          session={featured}
          attended={featured ? Boolean(attendanceBySessionId[featured.id]) : false}
        />

        {/* PIL BULAN: ditekan untuk memilih bulan lain */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Bulan ${monthLabel(selectedDate)}, pilih bulan lain`}
          onPress={() => setMonthPickerVisible(true)}
          style={({ pressed }) => [styles.monthPill, pressed && styles.pressed]}
        >
          <Text style={styles.monthText}>{monthLabel(selectedDate)}</Text>
        </Pressable>

        {/* STRIP TANGGAL */}
        <DayStrip
          key={selectedDay.slice(0, 7)}
          sessions={sessions}
          todayKey={todayKey}
          selectedDay={selectedDay}
          onSelect={setSelectedDay}
        />

        <NotificationStatusBanner />

        {/* JADWAL KAMU */}
        <View style={styles.section}>
          <View style={styles.sectionText}>
            <Text style={styles.sectionTitle}>Jadwal Kamu</Text>
            <Text style={styles.sectionSubtitle}>{fullDate(selectedDate)}</Text>
          </View>

          {/* Halaman daftar, di kanan judul */}
          {visible.length > 0 ? (
            <Pager page={currentPage} pageCount={pageCount} onChange={setPage} />
          ) : null}
        </View>

        {/* Sisa ruang sampai navbar; jumlah kartu menyesuaikan tinggi area ini. */}
        <View style={styles.listArea} onLayout={onAreaLayout}>
          {sessions.length === 0 && emptyState ? (
            emptyState
          ) : visible.length === 0 ? (
            <View style={[styles.sessionCard, styles.emptyCard]}>
              <Text style={styles.emptyText}>Belum ada sesi untuk jadwal ini</Text>
            </View>
          ) : (
            <View style={styles.list}>
              {visible.map((session) => (
                <SessionCard key={session.id} session={session} onLayout={itemLayout(session.id)} />
              ))}
            </View>
          )}
        </View>
      </View>

      <MonthPickerSheet
        visible={monthPickerVisible}
        selectedMonth={selectedDay.slice(0, 7)}
        monthsWithSessions={monthsWithSessions}
        onClose={() => setMonthPickerVisible(false)}
        onSelect={(monthKey) => {
          // Bulan ini -> hari ini; bulan lain -> tanggal 1.
          setSelectedDay(monthKey === todayKey.slice(0, 7) ? todayKey : `${monthKey}-01`);
          setMonthPickerVisible(false);
        }}
      />
    </SafeAreaView>
  );
}

// ==========================================
// KARTU SOROTAN
// ==========================================

/** Lingkaran oranye di kanan bawah kartu sorotan: CIRCLES.png dari Figma (ekspor 3x, 1500px). */
const CIRCLES_IMAGE = require('../../../../assets/icons/figma/CIRCLES.png');

function FeaturedArcs() {
  return (
    <View
      style={styles.arcs}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {/* Ukuran pada desain: lingkaran terluar 310. */}
      <Image source={CIRCLES_IMAGE} style={styles.arcsImage} contentFit="contain" />
    </View>
  );
}

function FeaturedCard({
  session,
  attended,
}: {
  session: PraktikanSession | null;
  attended: boolean;
}) {
  if (!session) {
    return (
      <View style={[styles.featured, styles.featuredEmpty]}>
        <FeaturedArcs />
        <Text style={styles.featuredEmptyText}>
          Kamu tidak memiliki jadwal praktikum mendatang...
        </Text>
      </View>
    );
  }

  const isOpen = session.status === 'dibuka';

  return (
    <View style={styles.featured}>
      <FeaturedArcs />

      <View style={styles.featuredChip}>
        <Text style={styles.featuredChipText}>{isOpen ? 'BERLANGSUNG' : 'MENDATANG'}</Text>
      </View>

      <Text style={styles.featuredTitle} numberOfLines={1}>
        {session.practicumName}
      </Text>
      <Text style={styles.featuredModule} numberOfLines={1}>
        {formatMeetingTitle(session.moduleTitle)}
      </Text>

      <View style={styles.featuredMeta}>
        {session.waktuMulai ? (
          <FeaturedLine icon="calendarBold">{fullDate(session.waktuMulai)}</FeaturedLine>
        ) : null}
        <FeaturedLine icon="timeBold">{timeRange(session)}</FeaturedLine>
        <FeaturedLine icon="locationBold" besideButton>{session.classRoom}</FeaturedLine>
      </View>

      {isOpen && attended ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Sudah presensi, lihat presensi"
          onPress={() => openAttendance(session.id)}
          style={({ pressed }) => [styles.featuredButton, styles.doneButton, pressed && styles.pressed]}
        >
          <Text style={[styles.featuredButtonText, styles.doneText]}>Sudah Presensi</Text>
          <View style={[styles.buttonDot, styles.doneDot]}>
            <CheckIcon size={15} color={C.white} />
          </View>
        </Pressable>
      ) : (
        <Pressable
          accessibilityRole="button"
          onPress={() => openAttendance(session.id)}
          style={({ pressed }) => [styles.featuredButton, pressed && styles.pressed]}
        >
          <View style={styles.buttonDot}>
            <FigmaIcon name="arrowRight" size={16} color={C.white} />
          </View>
          <Text style={styles.featuredButtonText}>{isOpen ? 'Presensi' : 'Cek Detail'}</Text>
        </Pressable>
      )}
    </View>
  );
}

function FeaturedLine({
  icon,
  children,
  besideButton = false,
}: {
  icon: 'calendarBold' | 'timeBold' | 'locationBold';
  children: ReactNode;
  /** Baris terakhir sejajar tombol di kanan bawah: beri ruang supaya tidak tertimpa. */
  besideButton?: boolean;
}) {
  return (
    <View style={[styles.featuredLine, besideButton && styles.featuredLineBesideButton]}>
      <FigmaIcon name={icon} size={20} color={C.white} />
      <Text style={styles.featuredLineText} numberOfLines={1}>
        {children}
      </Text>
    </View>
  );
}

// ==========================================
// STRIP TANGGAL
// ==========================================

function DayStrip({
  sessions,
  todayKey,
  selectedDay,
  onSelect,
}: {
  sessions: PraktikanSession[];
  todayKey: string;
  selectedDay: string;
  onSelect: (key: string) => void;
}) {
  const scrollRef = useRef<ScrollViewInstance>(null);
  const width = useRef(0);
  const centered = useRef(false);
  const days = useMemo(() => buildDays(selectedDay.slice(0, 7)), [selectedDay]);
  const withSessions = useMemo(
    () => new Set(sessions.map(sessionDayKey).filter((k): k is string => k !== null)),
    [sessions],
  );

  function center(index: number, animated: boolean) {
    const mid = H_PADDING + index * (DAY_WIDTH + DAY_GAP) + DAY_WIDTH / 2;
    scrollRef.current?.scrollTo({ x: Math.max(0, mid - width.current / 2), animated });
  }

  const contentWidth = useRef(0);

  // Hari ini di tengah begitu lebar strip & isinya sama-sama sudah terukur.
  function tryCenter() {
    if (centered.current || width.current === 0 || contentWidth.current === 0) return;
    centered.current = true;
    const index = Math.max(0, days.findIndex((day) => day.key === selectedDay));
    requestAnimationFrame(() => center(index, false));
  }

  function handleLayout(event: LayoutChangeEvent) {
    width.current = event.nativeEvent.layout.width;
    tryCenter();
  }

  function handleContentSize(w: number) {
    contentWidth.current = w;
    tryCenter();
  }

  return (
    <ScrollView
      ref={scrollRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      onLayout={handleLayout}
      onContentSizeChange={(w) => handleContentSize(w)}
      style={styles.stripScroll}
      contentContainerStyle={styles.strip}
      accessibilityRole="tablist"
    >
      {days.map((day, index) => {
        const isToday = day.key === todayKey;
        const isSelected = day.key === selectedDay;
        const isPast = day.key.slice(0, 7) !== selectedDay.slice(0, 7);
        const hasSession = withSessions.has(day.key);
        return (
          <Pressable
            key={day.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: isSelected }}
            accessibilityLabel={`${day.label} ${day.dayOfMonth}${isToday ? ', hari ini' : ''}${hasSession ? ', ada sesi' : ''}`}
            onPress={() => {
              onSelect(day.key);
              center(index, true);
            }}
            style={({ pressed }) => [
              styles.day,
              isPast && styles.dayPast,
              isSelected && !isToday && styles.daySelected,
              isToday && styles.dayToday,
              pressed && styles.pressed,
            ]}
          >
            <View
              style={[
                styles.dayDot,
                !hasSession && styles.hidden,
                isToday && styles.dayDotOnAccent,
              ]}
            />
            <Text style={[styles.dayNumber, isPast && styles.dayTextPast, isToday && styles.dayTextOnAccent]}>
              {day.dayOfMonth}
            </Text>
            <Text style={[styles.dayLabel, isPast && styles.dayTextPast, isToday && styles.dayTextOnAccent]}>
              {day.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

// ==========================================
// KARTU JADWAL & HALAMAN
// ==========================================

function SessionCard({
  session,
  onLayout,
}: {
  session: PraktikanSession;
  onLayout?: (event: LayoutChangeEvent) => void;
}) {
  const kind = chipKind(session);
  return (
    <Pressable
      onLayout={onLayout}
      accessibilityRole="button"
      accessibilityLabel={`${session.practicumName}, ${CHIP_LABEL[kind].toLowerCase()}`}
      onPress={() => openAttendance(session.id)}
      style={({ pressed }) => [styles.sessionCard, pressed && styles.pressed]}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle} numberOfLines={2}>
          {session.practicumName}
        </Text>
        <View style={[styles.cardChip, chipStyle[kind]]}>
          <Text style={[styles.cardChipText, chipTextStyle[kind]]}>{CHIP_LABEL[kind]}</Text>
        </View>
      </View>

      <Text style={styles.cardModule} numberOfLines={1}>
        {formatMeetingTitle(session.moduleTitle)}
      </Text>

      <View style={styles.cardMeta}>
        <View style={styles.cardMetaItem}>
          <FigmaIcon name="timeBold" size={13} color={C.accent} />
          <Text style={styles.cardMetaText}>{timeRange(session)}</Text>
        </View>
        <View style={[styles.cardMetaItem, styles.flexShrink]}>
          <FigmaIcon name="locationBold" size={13} color={C.accent} />
          <Text style={styles.cardMetaText} numberOfLines={1}>
            {session.classRoom}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

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
          canPrev ? styles.pagerActive : styles.pagerDisabled,
          pressed && styles.pressed,
        ]}
      >
        <FigmaIcon name="arrowLeft2" size={17} color={canPrev ? C.white : PAGER_GREY} />
      </Pressable>
      <View
        style={[styles.pagerButton, styles.pagerNumber]}
        accessibilityLabel={`Halaman ${page + 1} dari ${pageCount}`}
      >
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
          canNext ? styles.pagerActive : styles.pagerDisabled,
          pressed && styles.pressed,
        ]}
      >
        <FigmaIcon name="arrowRight2" size={17} color={canNext ? C.white : PAGER_GREY} />
      </Pressable>
    </View>
  );
}

const chipStyle = StyleSheet.create({
  waiting: { backgroundColor: C.chipSoft, borderColor: BORDER_COLOR, borderWidth: 1 },
  live: { backgroundColor: C.accent },
  done: { backgroundColor: C.chipDone },
});

const chipTextStyle = StyleSheet.create({
  waiting: { color: C.muted },
  live: { color: C.white },
  done: { color: C.muted },
});

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: PAGE_BG,
    flex: 1,
  },
  content: {

    paddingHorizontal: H_PADDING,
    flex: 1,
  },
  pressed: {
    opacity: 0.75,
  },
  hidden: {
    opacity: 0,
  },
  flexShrink: {
    flexShrink: 1,
  },

  // Sapaan (tinggi 78)
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    height: 78,
  },
  avatar: {
    alignItems: 'center',
    backgroundColor: CARD_BG,
    borderColor: BORDER_COLOR,
    borderRadius: 25,
    borderWidth: 1,
    height: 50,
    justifyContent: 'center',
    width: 50,
  },
  avatarSpacer: {
    width: 50,
  },
  greeting: {
    alignItems: 'center',
    flex: 1,
  },
  greetingTitle: {
    color: C.ink,
    fontFamily: FONT.semibold,
    fontSize: 15,
    includeFontPadding: false,
    lineHeight: 19,
    textAlign: 'center',
  },
  greetingDate: {
    color: C.muted,
    fontFamily: FONT.regular,
    fontSize: 15,
    includeFontPadding: false,
    lineHeight: 19,
    textAlign: 'center',
  },
  banners: {
    gap: 8,
    marginBottom: 10,
  },

  // Kartu sorotan (350 x 166)
  featured: {
    backgroundColor: C.sky,
    borderRadius: 30,
    minHeight: 166,
    overflow: 'hidden',
    paddingBottom: 20,
    paddingHorizontal: 25,
    paddingTop: 24,
  },
  featuredEmpty: {
    justifyContent: 'center',
  },
  arcs: {
    bottom: -155,
    position: 'absolute',
    right: -155,
  },
  arcsImage: {
    height: 310,
    width: 310,
  },
  featuredEmptyText: {
    color: C.white,
    fontFamily: FONT.bold,
    fontSize: 22,
    lineHeight: 26,
    maxWidth: 260,
  },
  featuredChip: {
    alignItems: 'center',
    backgroundColor: C.white,
    borderRadius: 7.5,
    height: 15,
    justifyContent: 'center',
    paddingHorizontal: 8,
    position: 'absolute',
    right: 20,
    top: 20,
  },
  featuredChipText: {
    color: C.accent,
    fontFamily: FONT.bold,
    fontSize: 5.6,
  },
  featuredTitle: {
    color: C.white,
    fontFamily: FONT.bold,
    fontSize: 18.5,
    lineHeight: 22,
    paddingRight: 70,
  },
  featuredModule: {
    color: C.white,
    fontFamily: FONT.semibold,
    fontSize: 14.5,
    lineHeight: 18,
    marginTop: 4,
  },
  featuredMeta: {
    gap: 5,
    marginTop: 8,
  },
  featuredLine: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 7,
  },
  featuredLineBesideButton: {
    paddingRight: 130,
  },
  featuredLineText: {
    color: C.white,
    flexShrink: 1,
    fontFamily: FONT.medium,
    fontSize: 13,
  },
  featuredButton: {
    alignItems: 'center',
    backgroundColor: C.white,
    borderRadius: 17,
    bottom: 20,
    flexDirection: 'row',
    gap: 7,
    height: 34,
    paddingLeft: 3,
    paddingRight: 14,
    position: 'absolute',
    right: 20,
  },
  buttonDot: {
    alignItems: 'center',
    backgroundColor: C.sky,
    borderRadius: 14,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  featuredButtonText: {
    color: C.sky,
    fontFamily: FONT.semibold,
    fontSize: 12,
  },
  doneButton: {
    paddingLeft: 14,
    paddingRight: 3,
  },
  doneText: {
    color: C.green,
  },
  doneDot: {
    backgroundColor: C.green,
  },

  // Pil bulan (160 x 40)
  monthPill: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: CARD_BG,
    borderColor: BORDER_COLOR,
    borderRadius: 20,
    borderWidth: 1,
    height: 40,
    justifyContent: 'center',
    marginTop: 10,
    minWidth: 160,
    paddingHorizontal: 20,
  },
  monthText: {
    color: C.ink,
    fontFamily: FONT.semibold,
    fontSize: 15,
  },

  // Strip tanggal (60 x 80, jarak 10)
  stripScroll: {
    // Halaman tidak digulir: jangan biarkan strip ikut melar mengisi ruang kosong.
    flexGrow: 0,
    flexShrink: 0,
    marginHorizontal: -H_PADDING,
  },
  strip: {
    gap: DAY_GAP,
    paddingHorizontal: H_PADDING,
    paddingVertical: 6,
  },
  day: {
    alignItems: 'center',
    backgroundColor: CARD_BG,
    borderColor: BORDER_COLOR,
    borderRadius: 30,
    borderWidth: 1,
    height: 80,
    paddingTop: 10,
    width: DAY_WIDTH,
  },
  dayPast: {
    backgroundColor: PAGE_BG,
  },
  daySelected: {
    borderColor: C.accent,
  },
  dayToday: {
    backgroundColor: C.accent,
    borderColor: C.accent,
  },
  dayDot: {
    backgroundColor: C.accent,
    borderRadius: 3,
    height: 6,
    width: 6,
  },
  dayDotOnAccent: {
    backgroundColor: C.white,
  },
  dayNumber: {
    color: C.ink,
    fontFamily: FONT.semibold,
    fontSize: 20,
    lineHeight: 24,
    marginTop: 4,
  },
  dayLabel: {
    color: C.muted,
    fontFamily: FONT.regular,
    fontSize: 16,
    lineHeight: 19,
    marginTop: 2,
  },
  dayTextPast: {
    color: C.mutedText,
  },
  dayTextOnAccent: {
    color: C.white,
  },

  // Jadwal Kamu
  section: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    marginBottom: 10,
    marginTop: 6,
  },
  sectionText: {
    flex: 1,
    gap: 4,
  },
  sectionTitle: {
    color: C.ink,
    fontFamily: FONT.bold,
    fontSize: 18.5,
  },
  sectionSubtitle: {
    color: C.muted,
    fontFamily: FONT.regular,
    fontSize: 15,
  },
  list: {
    gap: CARD_GAP,
  },

  // Kartu jadwal (lebar 350)
  listArea: {
    flex: 1,
    overflow: 'hidden',
  },
  // Kartu sesi: proporsi sama dengan kartu Riwayat Kehadiran
  sessionCard: {
    backgroundColor: CARD_BG,
    borderColor: BORDER_COLOR,
    borderRadius: 18,
    borderWidth: 1,
    paddingBottom: 16,
    paddingHorizontal: 16,
    paddingTop: 15,
  },
  emptyCard: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 94,
  },
  emptyText: {
    color: C.muted,
    fontFamily: FONT.medium,
    fontSize: 13.5,
  },
  cardHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 8,
  },
  cardTitle: {
    color: C.ink,
    flex: 1,
    fontFamily: FONT.bold,
    fontSize: 14,
    lineHeight: 18,
    letterSpacing: -0.3,
  },
  cardChip: {
    alignItems: 'center',
    borderRadius: 9,
    height: 18,
    justifyContent: 'center',
    marginRight: -3,
    marginTop: -1,
    paddingHorizontal: 10,
  },
  cardChipText: {
    fontFamily: FONT.bold,
    fontSize: 7.5,
    letterSpacing: 0.2,
  },
  cardModule: {
    color: C.accent,
    fontFamily: FONT.semibold,
    fontSize: 13,
    marginTop: 2,
    letterSpacing: -0.2,
    lineHeight: 17,
  },
  cardMeta: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 14,
    marginTop: 9,
  },
  cardMetaItem: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 5,
  },
  cardMetaText: {
    color: C.accent,
    fontFamily: FONT.medium,
    fontSize: 11,
    letterSpacing: -0.15,
    lineHeight: 15,
  },

  // Halaman: gaya sama dengan tombol halaman Riwayat Kehadiran (kotak 42, radius 11),
  // diperkecil ke kotak 30.
  pager: {
    flexDirection: 'row',
    gap: 6,
  },
  pagerButton: {
    alignItems: 'center',
    borderRadius: 8,
    height: 30,
    justifyContent: 'center',
    width: 30,
  },
  pagerActive: {
    backgroundColor: C.accent,
  },
  pagerDisabled: {
    backgroundColor: CARD_BG,
    borderColor: PAGER_GREY,
    borderWidth: 1,
  },
  pagerNumber: {
    backgroundColor: CARD_BG,
    borderColor: PAGER_GREY,
    borderWidth: 1,
  },
  pagerNumberText: {
    color: C.ink,
    fontFamily: FONT.medium,
    fontSize: 14,
  },
});
