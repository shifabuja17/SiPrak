/**
 * Helper tanggal & jam sesi praktikum. Waktu sesi disimpan sebagai
 * `waktuMulai` / `waktuSelesai` (timestamp) dan ditampilkan dalam WIB.
 */

const TIME_ZONE = 'Asia/Jakarta';

const DAY_NAMES = ['minggu', 'senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu'];

export interface ClockTime {
  hours: number;
  minutes: number;
}

/** Menggabungkan tanggal (hari) dan jam menjadi satu Date. */
export function combineDateAndTime(date: Date, time: ClockTime): Date {
  const result = new Date(date);
  result.setHours(time.hours, time.minutes, 0, 0);
  return result;
}

export function toClockTime(date: Date): ClockTime {
  return { hours: date.getHours(), minutes: date.getMinutes() };
}

export function startOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

/** "Kamis, 20 November 2026" */
export function formatSessionDate(date: Date): string {
  return date.toLocaleDateString('id-ID', {
    timeZone: TIME_ZONE,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/** "07.00" */
export function formatClock(date: Date): string {
  return date
    .toLocaleTimeString('id-ID', {
      timeZone: TIME_ZONE,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
    .replace(':', '.');
}

/** "Kamis, 20 November 2026 · 07.00 - 09.00 WIB" */
export function formatSessionTimeRange(start: Date, end: Date | null): string {
  const range = end ? `${formatClock(start)} - ${formatClock(end)}` : formatClock(start);
  return `${formatSessionDate(start)} · ${range} WIB`;
}

/**
 * Membaca teks jadwal lama seperti "Selasa, 07.00 - 09.00 WIB" untuk mengisi
 * nilai awal form. Mengembalikan null untuk bagian yang tidak dikenali.
 */
export function parseScheduleTimeText(text: string): {
  dayIndex: number | null;
  start: ClockTime | null;
  end: ClockTime | null;
} {
  const lower = text.toLowerCase().replace("jum'at", 'jumat');
  const dayIndex = DAY_NAMES.findIndex((day) => lower.includes(day));
  const times = [...lower.matchAll(/(\d{1,2})[.:](\d{2})/g)]
    .map((match) => ({ hours: Number(match[1]), minutes: Number(match[2]) }))
    .filter((t) => t.hours < 24 && t.minutes < 60);

  return {
    dayIndex: dayIndex >= 0 ? dayIndex : null,
    start: times[0] ?? null,
    end: times[1] ?? null,
  };
}

/** Tanggal terdekat (hari ini atau setelahnya) yang jatuh pada `dayIndex` (0 = Minggu). */
export function nextDateForDay(dayIndex: number, from: Date = new Date()): Date {
  const result = startOfDay(from);
  const diff = (dayIndex - result.getDay() + 7) % 7;
  result.setDate(result.getDate() + diff);
  return result;
}

/** Nilai awal form sesi dari teks jadwal; jatuh ke hari ini 07.00 - 09.00 bila tak terbaca. */
export function defaultSessionTimesFromSchedule(scheduleTime: string): {
  date: Date;
  start: ClockTime;
  end: ClockTime;
} {
  const parsed = parseScheduleTimeText(scheduleTime);
  const start = parsed.start ?? { hours: 7, minutes: 0 };
  const end =
    parsed.end ?? { hours: Math.min(start.hours + 2, 23), minutes: start.minutes };
  const date =
    parsed.dayIndex !== null ? nextDateForDay(parsed.dayIndex) : startOfDay(new Date());
  return { date, start, end };
}

/** Mengubah nilai Firestore (Timestamp/Date) menjadi Date. */
export function toDateValue(value: unknown): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (
    value &&
    typeof value === 'object' &&
    'toDate' in value &&
    typeof (value as { toDate: unknown }).toDate === 'function'
  ) {
    return (value as { toDate: () => Date }).toDate();
  }
  return null;
}
