/**
 * Tipe bersama modul Push Notification (Sprint 3 — Programmer 3).
 */

/** ID channel notifikasi Android. Harus sama dengan `defaultChannel` pada app.json. */
export const NOTIFICATION_CHANNEL_ID = 'siprak-default';

/** Koleksi Firestore tempat token perangkat disimpan: `pushTokens/{uid}`. */
export const PUSH_TOKENS_COLLECTION = 'pushTokens';

export type NotificationEventType =
  | 'session_opened'
  | 'schedule_changed'
  | 'leave_accepted'
  | 'leave_rejected';

export interface NotificationPayload {
  type: NotificationEventType;
  title: string;
  body: string;
  /** Hanya string, dipakai untuk navigasi ketika notifikasi diketuk. */
  data: Record<string, string>;
}

/** Satu token perangkat beserta pemiliknya (dipakai untuk membersihkan token tidak valid). */
export interface TokenRecipient {
  uid: string;
  token: string;
}

export type DispatchStatus =
  /** Semua token diterima layanan push. */
  | 'sent'
  /** Sebagian token diterima, sebagian gagal. */
  | 'partial'
  /** Tidak ada token yang diterima layanan push (jaringan/layanan bermasalah). */
  | 'failed'
  /** Tidak ada pengguna yang berkepentingan (mis. kelas belum punya anggota). */
  | 'no_recipients'
  /** Ada pengguna terkait, tetapi tidak ada perangkat yang terdaftar/mengizinkan notifikasi. */
  | 'no_tokens';

export interface NotificationDispatchResult {
  status: DispatchStatus;
  /** Jumlah pengguna yang berkepentingan. */
  recipientCount: number;
  /** Jumlah token perangkat yang dituju. */
  tokenCount: number;
  /** Jumlah token yang diterima layanan push. */
  acceptedCount: number;
  /** Jumlah token yang ditolak/gagal. */
  failedCount: number;
  /** Alasan singkat untuk ditampilkan ke pengguna jika gagal. */
  reason?: string;
}

export type PushRegistrationStatus =
  | 'idle'
  | 'registering'
  | 'registered'
  | 'permission_denied'
  | 'unsupported'
  | 'error';
