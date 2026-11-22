import { useMemo, useRef, type ReactNode } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
  type ScrollViewInstance,
} from 'react-native';

import { FONT } from '@/constants/fonts';
import { MetaLine } from '@/features/praktikan/ui/praktikan-ui';
import { formatMeetingTitle } from '@/features/praktikan/utils/format';
import { formatClock, formatSessionDate } from '@/utils/session-time';

/**
 * Komponen jadwal yang dipakai bersama beranda Praktikan dan Asisten:
 * kartu sorotan, strip tanggal, dan kartu sesi oranye.
 */

const TIME_ZONE = 'Asia/Jakarta';

const COLORS = {
  ink: '#111014',
  onColor: '#FFFFFF',
  muted: '#5F5F66',
  line: '#E4E4E7',
  border: '#8E8E93',
  accent: '#F47321',
};

const DAY_LABELS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

/** Jumlah hari sebelum & sesudah hari ini yang bisa digeser di strip tanggal. */
const DAY_RANGE = 30;
const DAY_WIDTH = 56;
const DAY_GAP = 8;
export const PAGE_PADDING = 20;

/** Bentuk minimum sesi yang bisa ditampilkan (sesi Praktikan maupun Asisten). */
export interface ScheduleSession {
  id: string;
  practicumName: string;
  moduleTitle: string;
  classRoom: string;
  scheduleTime: string;
  waktuMulai?: Date | null;
  waktuSelesai?: Date | null;
  status: 'dijadwalkan' | 'dibuka' | 'ditutup';
}

// ==========================================
// HELPER TANGGAL (WIB)
// ==========================================

/** "2026-11-21" untuk tanggal tersebut di zona WIB. */
export function wibDayKey(date: Date): string {
  return date.toLocaleDateString('en-CA', { timeZone: TIME_ZONE });
}

export function sessionDayKey(session: ScheduleSession): string | null {
  return session.waktuMulai ? wibDayKey(session.waktuMulai) : null;
}

export function timeRange(session: ScheduleSession): string | null {
  if (!session.waktuMulai) return null;
  const start = formatClock(session.waktuMulai);
  return session.waktuSelesai ? `${start} - ${formatClock(session.waktuSelesai)}` : start;
}

export function todayLabel(now = new Date()): string {
  return now.toLocaleDateString('id-ID', {
    timeZone: TIME_ZONE,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

/** Sesi yang sedang dibuka; bila tidak ada, sesi terjadwal dengan waktu paling dekat. */
export function pickFeatured<T extends ScheduleSession>(sessions: T[], now = Date.now()): T | null {
  return (
    sessions.find((s) => s.status === 'dibuka') ??
    sessions
      .filter((s) => s.status === 'dijadwalkan' && s.waktuMulai && s.waktuMulai.getTime() >= now)
      .sort((a, b) => a.waktuMulai!.getTime() - b.waktuMulai!.getTime())[0] ??
    null
  );
}

/** Sesi pada tanggal terpilih, urut jam mulai. */
export function sessionsOnDay<T extends ScheduleSession>(sessions: T[], dayKey: string): T[] {
  return sessions
    .filter((s) => sessionDayKey(s) === dayKey)
    .sort((a, b) => (a.waktuMulai?.getTime() ?? 0) - (b.waktuMulai?.getTime() ?? 0));
}

interface CalendarDay {
  key: string;
  label: string;
  dayOfMonth: number;
}

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

// ==========================================
// STRIP TANGGAL
// ==========================================

/** Strip tanggal yang bisa digeser; hari ini di tengah, titik menandai hari yang ada sesi. */
export function DateStrip({
  sessions,
  selectedDay,
  onSelect,
}: {
  sessions: ScheduleSession[];
  selectedDay: string;
  onSelect: (dayKey: string) => void;
}) {
  const scrollRef = useRef<ScrollViewInstance>(null);
  const centeredOnce = useRef(false);

  const todayKey = wibDayKey(new Date());
  const days = useMemo(() => buildDayRange(new Date()), [todayKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const daysWithSessions = useMemo(
    () => new Set(sessions.map(sessionDayKey).filter((key): key is string => key !== null)),
    [sessions],
  );

  function centerToday(event: LayoutChangeEvent) {
    if (centeredOnce.current) return;
    const width = event.nativeEvent.layout.width;
    const todayCenter = PAGE_PADDING + DAY_RANGE * (DAY_WIDTH + DAY_GAP) + DAY_WIDTH / 2;
    scrollRef.current?.scrollTo({ x: Math.max(0, todayCenter - width / 2), animated: false });
    centeredOnce.current = true;
  }

  return (
    <ScrollView
      ref={scrollRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      onLayout={centerToday}
      style={styles.daysScroll}
      contentContainerStyle={styles.days}
      accessibilityRole="tablist"
    >
      {days.map((day) => {
        const isToday = day.key === todayKey;
        const active = day.key === selectedDay;
        const hasSession = daysWithSessions.has(day.key);
        return (
          <Pressable
            key={day.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={`${day.label} ${day.dayOfMonth}${isToday ? ', hari ini' : ''}${hasSession ? ', ada sesi' : ''}`}
            onPress={() => onSelect(day.key)}
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
            <Text style={[styles.dayNumber, active && styles.dayTextActive]}>{day.dayOfMonth}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

// ==========================================
// KARTU SOROTAN
// ==========================================

export function FeaturedSessionCard({
  session,
  emptyEyebrow,
  emptyTitle,
  upcomingEyebrow,
  buttonLabel,
  onPress,
}: {
  session: ScheduleSession | null;
  emptyEyebrow: string;
  emptyTitle: string;
  upcomingEyebrow: string;
  buttonLabel: string;
  onPress: () => void;
}) {
  if (!session) {
    return (
      <View style={styles.featured}>
        <Text style={styles.featuredEyebrow}>{emptyEyebrow}</Text>
        <Text style={styles.featuredTitle}>{emptyTitle}</Text>
      </View>
    );
  }

  const range = timeRange(session);

  return (
    <View style={styles.featured}>
      <Text style={styles.featuredEyebrow}>
        {session.status === 'dibuka' ? 'Sedang berlangsung' : upcomingEyebrow}
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
            <MetaLine icon="date" textStyle={styles.featuredMeta}>
              {formatSessionDate(session.waktuMulai)}
            </MetaLine>
            {range ? (
              <MetaLine icon="time" textStyle={styles.featuredMeta}>{`${range} WIB`}</MetaLine>
            ) : null}
          </>
        ) : (
          <MetaLine icon="time" textStyle={styles.featuredMeta}>{session.scheduleTime}</MetaLine>
        )}
        <MetaLine icon="place" textStyle={styles.featuredMeta}>{session.classRoom}</MetaLine>
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [styles.featuredButton, pressed && styles.pressed]}
      >
        <Text style={styles.featuredButtonText}>{buttonLabel}</Text>
      </Pressable>
    </View>
  );
}

// ==========================================
// KARTU SESI
// ==========================================

export function SessionTile({
  session,
  chipLabel,
  live,
  color = COLORS.accent,
  footer,
  children,
  showDate = false,
  chipInCorner = false,
  onPress,
}: {
  session: ScheduleSession;
  chipLabel: string;
  /** Chip putih solid untuk sesi yang sedang berlangsung. */
  live: boolean;
  color?: string;
  /** Baris tambahan di bawah kartu, mis. jumlah praktikan hadir. */
  footer?: string;
  /** Isi tambahan di dalam kartu, mis. rekap kehadiran dan tombol aksi. */
  children?: ReactNode;
  /** Tampilkan tanggal (untuk daftar yang tidak dikelompokkan per hari). */
  showDate?: boolean;
  /** Letakkan chip status di pojok kanan atas, sejajar judul. */
  chipInCorner?: boolean;
  /** Tanpa onPress, kartu tidak bisa ditekan (hanya tombol di dalamnya). */
  onPress?: () => void;
}) {
  const range = timeRange(session);

  const chip = (
    <View style={[styles.chip, live && styles.chipLive]}>
      <Text style={[styles.chipText, live && styles.chipTextLive]}>{chipLabel}</Text>
    </View>
  );

  const title = (
    <Text style={[styles.tileTitle, chipInCorner && styles.flex]} numberOfLines={3}>
      {session.practicumName}
    </Text>
  );

  const content = (
    <>
      {chipInCorner ? (
        <View style={styles.tileHeader}>
          {title}
          {chip}
        </View>
      ) : (
        <>
          {chip}
          {title}
        </>
      )}
      <Text style={styles.tileModule} numberOfLines={2}>
        {formatMeetingTitle(session.moduleTitle)}
      </Text>

      <View style={styles.tileMeta}>
        {showDate && session.waktuMulai ? (
          <MetaLine icon="date" textStyle={styles.tileMetaText}>
            {formatSessionDate(session.waktuMulai)}
          </MetaLine>
        ) : null}
        <MetaLine icon="time" textStyle={styles.tileMetaText}>
          {range ? `${range} WIB` : session.scheduleTime}
        </MetaLine>
        <MetaLine icon="place" textStyle={styles.tileMetaText} numberOfLines={1}>
          {session.classRoom}
        </MetaLine>
      </View>

      {footer ? <Text style={styles.tileFooter}>{footer}</Text> : null}

      {children}
    </>
  );

  if (!onPress) {
    return <View style={[styles.tile, { backgroundColor: color }]}>{content}</View>;
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${session.practicumName}, ${chipLabel}`}
      onPress={onPress}
      style={({ pressed }) => [styles.tile, { backgroundColor: color }, pressed && styles.pressed]}
    >
      {content}
    </Pressable>
  );
}

/** Judul bagian daftar sesi + daftar sesi tanggal terpilih (atau pesan kosong). */
export function DaySessionList<T extends ScheduleSession>({
  sessions,
  dayKey,
  renderSession,
}: {
  sessions: T[];
  dayKey: string;
  renderSession: (session: T) => ReactNode;
}) {
  const visible = sessionsOnDay(sessions, dayKey);

  if (visible.length === 0) {
    return (
      <View style={styles.dayEmpty}>
        <Text style={styles.dayEmptyText}>Tidak ada jadwal praktikum di tanggal ini.</Text>
      </View>
    );
  }

  const label = visible[0].waktuMulai ? formatSessionDate(visible[0].waktuMulai) : 'Tanpa tanggal';

  return (
    <View style={styles.dayGroup}>
      <Text style={styles.dayGroupLabel}>{label}</Text>
      <View style={styles.stack}>{visible.map((session) => renderSession(session))}</View>
    </View>
  );
}

export const scheduleStyles = StyleSheet.create({
  sectionTitle: {
    fontFamily: FONT.extrabold,
    color: COLORS.ink,
    fontSize: 24,
    letterSpacing: -0.3,
    marginBottom: -8,
  },
});

const styles = StyleSheet.create({
  pressed: {
    opacity: 0.7,
  },

  // Sorotan
  featured: {
    backgroundColor: COLORS.accent,
    borderRadius: 28,
    gap: 6,
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
  },
  featuredButton: {
    alignItems: 'center',
    alignSelf: 'stretch',
    backgroundColor: COLORS.onColor,
    borderRadius: 999,
    justifyContent: 'center',
    marginTop: 10,
    minHeight: 44,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  featuredButtonText: {
    fontFamily: FONT.bold,
    color: COLORS.ink,
    fontSize: 14,
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
    backgroundColor: COLORS.onColor,
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
    color: COLORS.onColor,
  },

  // Daftar sesi
  dayEmpty: {
    borderColor: COLORS.border,
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
  flex: {
    flex: 1,
  },
  tileHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
  },
  tile: {
    borderRadius: 26,
    gap: 10,
    padding: 16,
  },
  chip: {
    alignSelf: 'flex-start',
    borderColor: COLORS.onColor,
    borderRadius: 999,
    borderWidth: 1,
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
  tileFooter: {
    borderTopColor: 'rgba(255,255,255,0.45)',
    borderTopWidth: 1,
    color: COLORS.onColor,
    fontFamily: FONT.semibold,
    fontSize: 13,
    paddingTop: 10,
  },
});
