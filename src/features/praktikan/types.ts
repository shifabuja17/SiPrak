/**
 * Status sesi praktikum di Cloud Firestore sesuai `firestore.rules`.
 */
export type FirestoreSessionStatus = 'dijadwalkan' | 'dibuka' | 'ditutup';

/**
 * Kontrak data kelas praktikum dari koleksi `classes/{classId}`.
 * Mendukung variasi penamaan field yang mungkin digunakan oleh modul P2.
 */
export interface PraktikanClass {
  id: string;
  practicumName?: string;
  className?: string;
  name?: string;
  code?: string;
  classRoom?: string;
  room?: string;
  description?: string;
  createdAt?: Date | null;
}

/**
 * Kontrak data jadwal praktikum dari koleksi `schedules/{scheduleId}`.
 * Mendukung referensi `classId` serta variasi penamaan field dari modul P2.
 */
export interface PraktikanSchedule {
  id: string;
  classId?: string;
  practicumName?: string;
  className?: string;
  classRoom?: string;
  room?: string;
  scheduleTime?: string;
  dayTime?: string;
  day?: string;
  time?: string;
  createdAt?: Date | null;
}

/**
 * Kontrak data sesi praktikum dari koleksi `sessions/{sessionId}` untuk modul Praktikan.
 * Field standar UI (`practicumName`, `moduleTitle`, `classRoom`, `scheduleTime`, `sessionNote`)
 * disandingkan dengan referensi relasi dan alias field opsional dari modul P2.
 */
export interface PraktikanSession {
  id: string;
  classId?: string;
  scheduleId?: string;
  practicumName: string;
  className?: string;
  moduleTitle: string;
  topic?: string;
  classRoom: string;
  room?: string;
  scheduleTime: string;
  dayTime?: string;
  status: FirestoreSessionStatus;
  sessionNote: string;
  createdAt?: Date | null;
  openedAt?: Date | null;
  closedAt?: Date | null;
}

/**
 * Dokumen presensi pada subkoleksi `sessions/{sessionId}/attendance/{uid}`.
 * Selaras dengan aturan `keys().hasOnly(['uid', 'nama', 'waktu'])` di `firestore.rules`.
 */
export interface SessionAttendanceDoc {
  uid: string;
  nama: string;
  waktu: Date | null;
}
