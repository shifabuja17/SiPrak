/**
 * Mengubah prefiks "Modul X:" menjadi "Pertemuan X:" agar konsisten di seluruh UI Praktikan.
 */
export function formatMeetingTitle(moduleTitle: string): string {
  return moduleTitle.replace(/^Modul\s*(\d+)\s*:\s*/i, 'Pertemuan $1: ');
}

const INDONESIAN_SHORT_MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'Mei',
  'Jun',
  'Jul',
  'Agu',
  'Sep',
  'Okt',
  'Nov',
  'Des',
] as const;

function padTwo(value: number): string {
  return String(value).padStart(2, '0');
}

function toWibDate(date: Date | null | undefined): Date | null {
  if (!date || Number.isNaN(date.getTime())) return null;
  const wibTimeMs = date.getTime() + 7 * 60 * 60 * 1000;
  return new Date(wibTimeMs);
}

/**
 * Memformat `Date` ke string jam WIB (`HH:mm:ss WIB`) secara deterministik (UTC+7).
 * Mengembalikan `null` jika timestamp belum tersedia (mis. `serverTimestamp()` masih pending).
 */
export function formatAttendanceTimeWIB(date: Date | null | undefined): string | null {
  const wibDate = toWibDate(date);
  if (!wibDate) return null;

  const hours = padTwo(wibDate.getUTCHours());
  const minutes = padTwo(wibDate.getUTCMinutes());
  const seconds = padTwo(wibDate.getUTCSeconds());

  return `${hours}:${minutes}:${seconds} WIB`;
}

/**
 * Memformat `Date` ke tanggal dan jam WIB (`13 Nov 2026, 21:15 WIB`) secara deterministik (UTC+7).
 * Mengembalikan `null` jika timestamp belum tersedia.
 */
export function formatDateTimeWIB(date: Date | null | undefined): string | null {
  const wibDate = toWibDate(date);
  if (!wibDate) return null;

  const day = wibDate.getUTCDate();
  const month = INDONESIAN_SHORT_MONTHS[wibDate.getUTCMonth()];
  const year = wibDate.getUTCFullYear();
  const hours = padTwo(wibDate.getUTCHours());
  const minutes = padTwo(wibDate.getUTCMinutes());

  return `${day} ${month} ${year}, ${hours}:${minutes} WIB`;
}
