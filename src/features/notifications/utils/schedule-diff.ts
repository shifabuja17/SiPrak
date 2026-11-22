/**
 * Mendeteksi perubahan jadwal/sesi supaya notifikasi hanya dikirim bila ada perubahan
 * yang berarti bagi Praktikan (bukan setiap kali Asisten menekan "Simpan").
 */
import { formatSessionTimeRange, toDateValue } from '@/utils/session-time';

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Perubahan pada dokumen `schedules/{id}` (field teks). Modul/materi tidak dibandingkan
 * karena sekarang milik tiap sesi, bukan jadwal.
 */
export function diffScheduleChanges(
  before: Record<string, unknown>,
  after: {
    practicumName: string;
    classRoom: string;
    scheduleTime: string;
  },
): string[] {
  const changes: string[] = [];

  if (text(before.scheduleTime) !== after.scheduleTime.trim()) {
    changes.push(`waktu menjadi ${after.scheduleTime.trim()}`);
  }
  if (text(before.classRoom) !== after.classRoom.trim()) {
    changes.push(`lokasi menjadi ${after.classRoom.trim()}`);
  }
  if (text(before.practicumName) !== after.practicumName.trim()) {
    changes.push(`nama praktikum menjadi ${after.practicumName.trim()}`);
  }

  return changes;
}

/** Perubahan pada dokumen `sessions/{id}` (tanggal/jam, lokasi, materi). */
export function diffSessionChanges(
  before: Record<string, unknown>,
  after: {
    practicumName: string;
    moduleTitle: string;
    classRoom: string;
    labId: string;
    labName: string;
    waktuMulai: Date;
    waktuSelesai: Date;
  },
): string[] {
  const changes: string[] = [];

  const oldStart = toDateValue(before.waktuMulai);
  const oldEnd = toDateValue(before.waktuSelesai);
  const timeChanged =
    oldStart?.getTime() !== after.waktuMulai.getTime() ||
    oldEnd?.getTime() !== after.waktuSelesai.getTime();

  if (timeChanged) {
    changes.push(
      `waktu menjadi ${formatSessionTimeRange(after.waktuMulai, after.waktuSelesai)}`,
    );
  }
  if (text(before.labId) !== after.labId.trim()) {
    changes.push(`lokasi menjadi ${after.labName.trim() || after.classRoom.trim()}`);
  }
  if (text(before.moduleTitle) !== after.moduleTitle.trim()) {
    changes.push(`materi menjadi ${after.moduleTitle.trim()}`);
  }

  return changes;
}
