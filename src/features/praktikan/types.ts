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
  /** Titik lokasi sesi (`laboratories/{labId}`), dipakai validasi radius presensi. */
  labId?: string;
  practicumName: string;
  className?: string;
  moduleTitle: string;
  topic?: string;
  classRoom: string;
  room?: string;
  /** Teks waktu siap tampil; berisi tanggal lengkap bila sesi punya `waktuMulai`. */
  scheduleTime: string;
  dayTime?: string;
  waktuMulai?: Date | null;
  waktuSelesai?: Date | null;
  status: FirestoreSessionStatus;
  sessionNote: string;
  createdAt?: Date | null;
  openedAt?: Date | null;
  closedAt?: Date | null;
}

/**
 * Dokumen presensi pada subkoleksi `sessions/{sessionId}/attendance/{uid}`.
 * Field lokasi hanya ada pada presensi berbasis lokasi (Sprint 3).
 */
export interface SessionAttendanceDoc {
  uid: string;
  nama: string;
  waktu: Date | null;
  labId?: string;
  latitude?: number;
  longitude?: number;
  /** Jarak ke titik lokasi saat presensi, dalam meter. */
  jarak?: number;
}

/**
 * Status pengajuan izin Praktikan di koleksi `leaveRequests/{requestId}` sesuai `firestore.rules`.
 */
export type LeaveRequestStatus = 'menunggu' | 'diterima' | 'ditolak';

/**
 * Dokumen pengajuan izin pada koleksi `leaveRequests/{sessionId}_{uid}`.
 */
export interface LeaveRequestDoc {
  id: string;
  uid: string;
  nama: string | null;
  sessionId: string;
  alasan: string;
  kategoriAI: string | null;
  status: LeaveRequestStatus;
  createdAt: Date | null;
  reviewedBy?: string | null;
  reviewedAt?: Date | null;
  catatanAsisten?: string | null;
}

/**
 * Input pengiriman pengajuan izin Praktikan sebelum ditulis ke Firestore.
 */
export interface SubmitLeaveRequestInput {
  sessionId: string;
  uid: string;
  nama: string;
  alasan: string;
  kategoriAI?: string | null;
}

/**
 * Hasil klasifikasi kategori alasan izin oleh layanan AI eksternal (FR-16).
 * Bersifat informasi pendukung dan tidak pernah menentukan keputusan izin.
 */
export type LeaveAiClassificationResult =
  | { ok: true; category: string }
  | { ok: false; category: null; reason: string };

/**
 * Ringkasan hasil pengiriman pengajuan izin termasuk status klasifikasi AI (NFR-06).
 */
export interface SubmitLeaveRequestOutcome {
  ok: boolean;
  aiClassified: boolean;
  kategoriAI: string | null;
  aiWarning: string | null;
}
