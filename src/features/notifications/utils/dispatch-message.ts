/**
 * Mengubah hasil pengiriman notifikasi menjadi kalimat untuk Asisten.
 * Kalimat sengaja berbunyi "diteruskan ke layanan notifikasi", bukan "sudah diterima
 * praktikan", karena penerimaan di perangkat tidak bisa dipastikan (NFR-03).
 */
import type { NotificationDispatchResult } from '../types';

export function describeDispatch(
  result: NotificationDispatchResult | null | undefined,
): string {
  if (!result) return '';

  switch (result.status) {
    case 'sent':
      return `Notifikasi diteruskan ke layanan notifikasi untuk ${result.acceptedCount} perangkat praktikan.`;
    case 'partial':
      return `Notifikasi diteruskan untuk ${result.acceptedCount} dari ${result.tokenCount} perangkat; ${result.failedCount} gagal${result.reason ? ` (${result.reason})` : ''}.`;
    case 'failed':
      return `Notifikasi gagal dikirim${result.reason ? `: ${result.reason}` : '.'}`;
    case 'no_recipients':
      return 'Belum ada praktikan di kelas ini, jadi tidak ada notifikasi yang dikirim.';
    case 'no_tokens':
      return 'Belum ada perangkat praktikan yang mengaktifkan notifikasi, jadi tidak ada notifikasi yang dikirim.';
  }
}

/** Menempelkan status notifikasi di belakang pesan keberhasilan aksi utama. */
export function withNotificationNote(
  baseMessage: string,
  result: NotificationDispatchResult | null | undefined,
): string {
  const note = describeDispatch(result);
  return note ? `${baseMessage} ${note}` : baseMessage;
}
