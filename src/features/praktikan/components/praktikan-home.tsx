import { router } from 'expo-router';
import { useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Pressable,
  ScrollView,
  StatusBar,
  type LayoutChangeEvent,
  type ScrollViewInstance,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/context/AuthContext';
import type {
  PraktikanSession,
  SessionAttendanceDoc,
} from '@/features/praktikan/types';
import { formatMeetingTitle } from '@/features/praktikan/utils/format';
import { formatClock, formatSessionDate } from '@/utils/session-time';
import { TAB_BAR_SPACE, classColor } from '@/features/praktikan/ui/praktikan-ui';
import { FONT } from '@/constants/fonts';

const TIME_ZONE = 'Asia/Jakarta';

/** Palet putih, hitam, oranye; teks di atas oranye/hitam selalu putih. */
const COLORS = {
  page: '#FFFFFF',
  ink: '#111014',
  onColor: '#FFFFFF',
  muted: '#5F5F66',
  line: '#E4E4E7',
  accent: '#F47321',
};

const DAY_LABELS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

// ==========================================
// HELPER TANGGAL (WIB)
// ==========================================

/** "2026-11-21" untuk tanggal tersebut di zona WIB. */
function wibDayKey(date: Date): string {
  return date.toLocaleDateString('en-CA', { timeZone: TIME_ZONE });
}

interface CalendarDay {
  key: string;
  label: string;
  dayOfMonth: number;
}

/** Jumlah hari sebelum & sesudah hari ini yang bisa digeser di strip tanggal. */
const DAY_RANGE = 30;
const DAY_WIDTH = 56;
const DAY_GAP = 8;
const PAGE_PADDING = 20;

/** Hari ini ± DAY_RANGE hari (WIB); hari ini berada di indeks DAY_RANGE. */
function buildDayRange(today: Date): CalendarDay[] {
  const noon = new Date(`${wibDayKey(today)}T12:00:00+07:00`);
  return Array.from({ length: DAY_RANGE * 2 + 1 }, (_, index) => {
    const date = new Date(noon.getTime() + (index - DAY_RANGE) * 86_400_000);
    const key = wibDayKey(date);
    return {
      key,
      label: DAY_LABELS[date.getUTCDay()],
      dayOfMonth: Number(key.slice(8, 10)),
    };
  });
}

interface DayGroup {
  key: string;
  label: string;
  sessions: PraktikanSession[];
}

/** Mengelompokkan sesi per tanggal (WIB); sesi di hari yang sama ditumpuk dalam satu grup. */
function groupByDay(sessions: PraktikanSession[]): DayGroup[] {
  const groups: DayGroup[] = [];
  const byKey = new Map<string, DayGroup>();
  for (const session of sessions) {
    const key = sessionDayKey(session) ?? 'tanpa-tanggal';
    let group = byKey.get(key);
    if (!group) {
      group = {
        key,
        label: session.waktuMulai ? formatSessionDate(session.waktuMulai) : 'Tanpa tanggal',
        sessions: [],
      };
      byKey.set(key, group);
      groups.push(group);
    }
    group.sessions.push(session);
  }
  return groups;
}

function timeRangeLabel(session: PraktikanSession): string | null {
  const range = timeRange(session);
  return range ? `${range} WIB` : null;
}

function sessionDayKey(session: PraktikanSession): string | null {
  return session.waktuMulai ? wibDayKey(session.waktuMulai) : null;
}

function timeRange(session: PraktikanSession): string | null {
  if (!session.waktuMulai) return null;
  const start = formatClock(session.waktuMulai);
  return session.waktuSelesai ? `${start} - ${formatClock(session.waktuSelesai)}` : start;
}

// ==========================================
// STATUS
// ==========================================

type Tone = 'live' | 'done' | 'missed' | 'waiting';

function sessionChip(
  session: PraktikanSession,
  attendance: SessionAttendanceDoc | null | undefined,
): { label: string; tone: Tone } {
  if (attendance) return { label: 'Sudah presensi', tone: 'done' };
  if (session.status === 'dibuka') return { label: 'Berlangsung', tone: 'live' };
  if (session.status === 'ditutup') return { label: 'Tidak hadir', tone: 'missed' };
  return { label: 'Belum dibuka', tone: 'waiting' };
}

// ==========================================
// HALAMAN
// ==========================================

export interface PraktikanHomeProps {
  sessions: PraktikanSession[];
  attendanceBySessionId: Record<string, SessionAttendanceDoc | null>;
  /** Banner error / info yang ditampilkan di atas daftar. */
  banners?: ReactNode;
  /** Ditampilkan bila belum ada sesi sama sekali (loading, error, kosong). */
  emptyState?: ReactNode;
}

/**
 * Beranda Praktikan: sapaan, sorotan sesi terdekat, strip minggu ini, dan
 * kartu sesi berwarna per kelas.
 */
export default function PraktikanHome({
  sessions,
  attendanceBySessionId,
  banners,
  emptyState,
}: PraktikanHomeProps) {
  const { profile } = useAuth();
  // Hanya jadwal di tanggal yang dipilih yang ditampilkan; awalnya hari ini.
  const [selectedDay, setSelectedDay] = useState<string>(() => wibDayKey(new Date()));
  const daysScrollRef = useRef<ScrollViewInstance>(null);
  const centeredOnce = useRef(false);

  const now = new Date();
  const todayKey = wibDayKey(now);
  const days = useMemo(() => buildDayRange(now), [todayKey]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Menggeser strip tanggal supaya hari ini berada tepat di tengah. */
  function centerToday(event: LayoutChangeEvent) {
    if (centeredOnce.current) return;
    const width = event.nativeEvent.layout.width;
    const todayCenter = PAGE_PADDING + DAY_RANGE * (DAY_WIDTH + DAY_GAP) + DAY_WIDTH / 2;
    daysScrollRef.current?.scrollTo({ x: Math.max(0, todayCenter - width / 2), animated: false });
    centeredOnce.current = true;
  }

  // Urutan: sedang berlangsung, akan datang (terdekat dulu), lalu yang sudah lewat (terbaru dulu).
  const sorted = useMemo(() => {
    const rank = (s: PraktikanSession) =>
      s.status === 'dibuka' ? 0 : s.status === 'dijadwalkan' ? 1 : 2;
    return [...sessions].sort((a, b) => {
      const byRank = rank(a) - rank(b);
      if (byRank !== 0) return byRank;
      const aTime = a.waktuMulai?.getTime() ?? Number.MAX_SAFE_INTEGER;
      const bTime = b.waktuMulai?.getTime() ?? Number.MAX_SAFE_INTEGER;
      return rank(a) === 2 ? bTime - aTime : aTime - bTime;
    });
  }, [sessions]);

  const daysWithSessions = useMemo(
    () => new Set(sorted.map(sessionDayKey).filter((key): key is string => key !== null)),
    [sorted],
  );

  // Sorotan: sesi yang sedang berlangsung; bila tidak ada, sesi mendatang dengan waktu paling dekat.
  const featured =
    sorted.find((s) => s.status === 'dibuka') ??
    sorted
      .filter((s) => s.status === 'dijadwalkan' && s.waktuMulai && s.waktuMulai.getTime() >= now.getTime())
      .sort((a, b) => a.waktuMulai!.getTime() - b.waktuMulai!.getTime())[0] ??
    null;

  const visible = sorted
    .filter((s) => sessionDayKey(s) === selectedDay)
    .sort((a, b) => (a.waktuMulai?.getTime() ?? 0) - (b.waktuMulai?.getTime() ?? 0));

  const firstName = (profile?.nama ?? 'Praktikan').split(' ')[0];
  const initial = firstName.charAt(0).toUpperCase() || '?';
  const todayLabel = now.toLocaleDateString('id-ID', {
    timeZone: TIME_ZONE,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar barStyle="dark-content" />
      <ScrollView contentContainerStyle={styles.content}>
        {/* HEADER */}
        <View style={styles.header}>
          <View style={styles.avatar} accessibilityElementsHidden importantForAccessibility="no">
            <Text style={styles.avatarText}>{initial}</Text>
          </View>

          <View style={styles.greeting}>
            <Text style={styles.greetingTitle} numberOfLines={1}>
              Halo, {firstName}
            </Text>
            <Text style={styles.greetingDate}>{todayLabel}</Text>
          </View>

        </View>

        {banners}

        {/* SOROTAN */}
        <FeaturedCard
          session={featured}
          attendance={featured ? attendanceBySessionId[featured.id] : null}
        />

        {/* STRIP TANGGAL (bisa digeser, hari ini di tengah) */}
        <ScrollView
          ref={daysScrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          onLayout={centerToday}
          style={styles.daysScroll}
          contentContainerStyle={styles.days}
          accessibilityRole="tablist"
        >
          {days.map((day) => {
            const isToday = day.key === todayKey;
            const isSelected = day.key === selectedDay;
            const hasSession = daysWithSessions.has(day.key);
            const active = isSelected;
            return (
              <Pressable
                key={day.key}
                accessibilityRole="tab"
                accessibilityState={{ selected: isSelected }}
                accessibilityLabel={`${day.label} ${day.dayOfMonth}${isToday ? ', hari ini' : ''}${hasSession ? ', ada sesi' : ''}`}
                onPress={() => setSelectedDay(day.key)}
                style={({ pressed }) => [
                  styles.day,
                  isToday && !active && styles.dayToday,
                  active && styles.dayActive,
                  pressed && styles.pressed,
                ]}
              >
                <View
                  style={[
                    styles.dayDot,
                    !hasSession && styles.dayDotHidden,
                    active && styles.dayDotActive,
                  ]}
                />
                <Text style={[styles.dayLabel, active && styles.dayTextActive]}>{day.label}</Text>
                <Text style={[styles.dayNumber, active && styles.dayTextActive]}>
                  {day.dayOfMonth}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* DAFTAR SESI */}
        <Text style={styles.sectionTitle}>Jadwal Kamu</Text>

        {sessions.length === 0 ? (
          emptyState
        ) : visible.length === 0 ? (
          <View style={styles.dayEmpty}>
            <Text style={styles.dayEmptyText}>Tidak ada jadwal praktikum di tanggal ini.</Text>
          </View>
        ) : (
          <View style={styles.groups}>
            {groupByDay(visible).map((group) => (
              <View key={group.key} style={styles.dayGroup}>
                <Text style={styles.dayGroupLabel}>{group.label}</Text>
                <View style={styles.stack}>
                  {group.sessions.map((session) => (
                    <SessionTile
                      key={session.id}
                      session={session}
                      color={classColor(session.classId ?? session.practicumName)}
                      attendance={attendanceBySessionId[session.id]}
                    />
                  ))}
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ==========================================
// KOMPONEN
// ==========================================

function FeaturedCard({
  session,
  attendance,
}: {
  session: PraktikanSession | null;
  attendance: SessionAttendanceDoc | null | undefined;
}) {
  if (!session) {
    return (
      <View style={styles.featured}>
        <Shapes />
        <Text style={styles.featuredEyebrow}>Praktikum terdekat</Text>
        <Text style={styles.featuredTitle}>Tidak ada praktikum mendatang</Text>
      </View>
    );
  }

  const isOpen = session.status === 'dibuka';
  const canAttend = isOpen && !attendance;
  const timeLine = timeRangeLabel(session);

  return (
    <View style={styles.featured}>
      <Shapes />
      <Text style={styles.featuredEyebrow}>
        {isOpen ? 'Sedang berlangsung' : 'Praktikum terdekat'}
      </Text>
      <Text style={styles.featuredTitle} numberOfLines={2}>
        {session.practicumName}
      </Text>
      <Text style={styles.featuredModule} numberOfLines={2}>
        {formatMeetingTitle(session.moduleTitle)}
      </Text>

      <View style={styles.featuredDetails}>
        {session.waktuMulai ? (
          <>
            <Text style={styles.featuredMeta}>{formatSessionDate(session.waktuMulai)}</Text>
            {timeLine ? <Text style={styles.featuredMeta}>{timeLine}</Text> : null}
          </>
        ) : (
          <Text style={styles.featuredMeta}>{session.scheduleTime}</Text>
        )}
        <Text style={styles.featuredMeta}>{session.classRoom}</Text>
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={() =>
          canAttend
            ? router.push({ pathname: '/attendance/[sessionId]', params: { sessionId: session.id } })
            : router.push({ pathname: '/session/[id]', params: { id: session.id } })
        }
        style={({ pressed }) => [styles.featuredButton, pressed && styles.pressed]}
      >
        <Text style={styles.featuredButtonText}>
          {canAttend ? 'Presensi sekarang' : attendance ? 'Sudah presensi · Lihat detail' : 'Lihat detail'}
        </Text>
      </Pressable>
    </View>
  );
}

function SessionTile({
  session,
  color,
  attendance,
}: {
  session: PraktikanSession;
  color: string;
  attendance: SessionAttendanceDoc | null | undefined;
}) {
  const chip = sessionChip(session, attendance);
  const range = timeRange(session);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${session.practicumName}, ${chip.label}`}
      onPress={() => router.push({ pathname: '/session/[id]', params: { id: session.id } })}
      style={({ pressed }) => [styles.tile, { backgroundColor: color }, pressed && styles.pressed]}
    >
      <View style={[styles.chip, chip.tone === 'live' && styles.chipLive]}>
        <Text style={[styles.chipText, chip.tone === 'live' && styles.chipTextLive]}>
          {chip.label}
        </Text>
      </View>

      <Text style={styles.tileTitle} numberOfLines={3}>
        {session.practicumName}
      </Text>
      <Text style={styles.tileModule} numberOfLines={2}>
        {formatMeetingTitle(session.moduleTitle)}
      </Text>

      <View style={styles.tileMeta}>
        {session.waktuMulai ? (
          <Text style={styles.tileMetaText}>{range} WIB</Text>
        ) : (
          <Text style={styles.tileMetaText}>{session.scheduleTime}</Text>
        )}
        <Text style={styles.tileMetaText} numberOfLines={1}>
          {session.classRoom}
        </Text>
      </View>
    </Pressable>
  );
}

/** Bentuk geometris sederhana di sudut kartu sorotan. */
function Shapes() {
  return (
    <View style={styles.shapes} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={[styles.shape, styles.shapeLarge]} />
      <View style={[styles.shape, styles.shapeRing]} />
      <View style={[styles.shape, styles.shapeSmall]} />
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: COLORS.page,
    flex: 1,
  },
  content: {
    gap: 22,
    // Ruang untuk navbar melayang supaya konten terakhir tidak tertutup.
    paddingBottom: TAB_BAR_SPACE,
    paddingHorizontal: PAGE_PADDING,
    paddingTop: 16,
  },
  pressed: {
    opacity: 0.7,
  },

  // Header
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  avatar: {
    alignItems: 'center',
    backgroundColor: COLORS.ink,
    borderRadius: 24,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  avatarText: {
    fontFamily: FONT.extrabold,
    color: '#FFFFFF',
    fontSize: 19,
  },
  greeting: {
    flex: 1,
    gap: 2,
  },
  greetingTitle: {
    fontFamily: FONT.extrabold,
    color: COLORS.ink,
    fontSize: 19,
  },
  greetingDate: {
    fontFamily: FONT.regular,
    color: COLORS.muted,
    fontSize: 13,
  },

  // Sorotan
  featured: {
    backgroundColor: COLORS.accent,
    borderRadius: 28,
    gap: 6,
    minHeight: 190,
    overflow: 'hidden',
    padding: 22,
  },
  featuredEyebrow: {
    fontFamily: FONT.bold,
    color: COLORS.onColor,
    fontSize: 13,
    opacity: 0.85,
  },
  featuredTitle: {
    fontFamily: FONT.extrabold,
    color: COLORS.onColor,
    fontSize: 26,
    letterSpacing: -0.5,
    lineHeight: 30,
  },
  featuredModule: {
    fontFamily: FONT.semibold,
    color: COLORS.onColor,
    fontSize: 15,
    lineHeight: 20,
    maxWidth: '72%',
  },
  featuredDetails: {
    gap: 1,
    marginTop: 2,
  },
  featuredMeta: {
    fontFamily: FONT.regular,
    color: COLORS.onColor,
    fontSize: 14,
    lineHeight: 20,
    maxWidth: '72%',
  },
  featuredButton: {
    // Selebar kartu supaya label tidak terpotong.
    alignItems: 'center',
    alignSelf: 'stretch',
    backgroundColor: COLORS.onColor,
    borderRadius: 999,
    marginTop: 10,
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  featuredButtonText: {
    fontFamily: FONT.bold,
    color: COLORS.ink,
    fontSize: 14,
  },
  shapes: {
    bottom: -26,
    height: 130,
    position: 'absolute',
    right: -22,
    width: 130,
  },
  shape: {
    position: 'absolute',
  },
  shapeLarge: {
    backgroundColor: COLORS.ink,
    borderRadius: 48,
    height: 96,
    right: 0,
    top: 18,
    width: 96,
  },
  shapeRing: {
    borderColor: COLORS.onColor,
    borderRadius: 26,
    borderWidth: 10,
    height: 52,
    left: 6,
    top: 74,
    width: 52,
  },
  shapeSmall: {
    backgroundColor: COLORS.onColor,
    borderRadius: 16,
    height: 32,
    left: 30,
    top: 14,
    width: 32,
  },

  // Strip tanggal
  daysScroll: {
    marginHorizontal: -PAGE_PADDING,
  },
  days: {
    gap: DAY_GAP,
    paddingHorizontal: PAGE_PADDING,
  },
  day: {
    alignItems: 'center',
    borderColor: COLORS.line,
    borderRadius: 999,
    borderWidth: 1,
    gap: 3,
    paddingBottom: 12,
    paddingTop: 8,
    width: DAY_WIDTH,
  },
  dayToday: {
    borderColor: COLORS.ink,
  },
  dayActive: {
    backgroundColor: COLORS.ink,
    borderColor: COLORS.ink,
  },
  dayDot: {
    backgroundColor: COLORS.ink,
    borderRadius: 3,
    height: 6,
    width: 6,
  },
  dayDotHidden: {
    opacity: 0,
  },
  dayDotActive: {
    backgroundColor: '#FFFFFF',
  },
  dayLabel: {
    fontFamily: FONT.regular,
    color: COLORS.muted,
    fontSize: 12,
  },
  dayNumber: {
    fontFamily: FONT.bold,
    color: COLORS.ink,
    fontSize: 16,
  },
  dayTextActive: {
    color: '#FFFFFF',
  },

  // Daftar sesi
  sectionTitle: {
    fontFamily: FONT.extrabold,
    color: COLORS.ink,
    fontSize: 24,
    letterSpacing: -0.3,
    marginBottom: -8,
  },
  dayEmpty: {
    borderColor: '#8E8E93',
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
  },
  dayEmptyText: {
    fontFamily: FONT.regular,
    color: COLORS.muted,
    fontSize: 14,
    textAlign: 'center',
  },
  groups: {
    gap: 20,
  },
  dayGroup: {
    gap: 10,
  },
  dayGroupLabel: {
    fontFamily: FONT.bold,
    color: COLORS.muted,
    fontSize: 13,
  },
  stack: {
    gap: 12,
  },
  tile: {
    borderRadius: 26,
    gap: 10,
    padding: 16,
  },
  chip: {
    alignSelf: 'flex-start',
    borderColor: COLORS.onColor,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  chipLive: {
    backgroundColor: COLORS.onColor,
  },
  chipText: {
    fontFamily: FONT.bold,
    color: COLORS.onColor,
    fontSize: 11,
  },
  chipTextLive: {
    color: COLORS.ink,
  },
  tileTitle: {
    fontFamily: FONT.extrabold,
    color: COLORS.onColor,
    fontSize: 18,
    letterSpacing: -0.3,
    lineHeight: 22,
  },
  tileModule: {
    fontFamily: FONT.semibold,
    color: COLORS.onColor,
    fontSize: 14,
    lineHeight: 19,
  },
  tileMeta: {
    gap: 2,
    marginTop: 2,
  },
  tileMetaText: {
    fontFamily: FONT.regular,
    color: COLORS.onColor,
    fontSize: 13,
  },
});
