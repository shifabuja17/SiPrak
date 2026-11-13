/**
 * Mengubah prefiks "Modul X:" menjadi "Pertemuan X:" agar konsisten di seluruh UI Praktikan.
 */
export function formatMeetingTitle(moduleTitle: string): string {
  return moduleTitle.replace(/^Modul\s*(\d+)\s*:\s*/i, 'Pertemuan $1: ');
}

function padTwo(value: number): string {
  return String(value).padStart(2, '0');
}

/**
 * Memformat `Date` ke string jam WIB (`HH:mm:ss WIB`) secara deterministik (UTC+7).
 * Mengembalikan `null` jika timestamp belum tersedia (mis. `serverTimestamp()` masih pending).
 */
export function formatAttendanceTimeWIB(date: Date | null): string | null {
  if (!date || Number.isNaN(date.getTime())) return null;

  const wibTimeMs = date.getTime() + 7 * 60 * 60 * 1000;
  const wibDate = new Date(wibTimeMs);

  const hours = padTwo(wibDate.getUTCHours());
  const minutes = padTwo(wibDate.getUTCMinutes());
  const seconds = padTwo(wibDate.getUTCSeconds());

  return `${hours}:${minutes}:${seconds} WIB`;
}
