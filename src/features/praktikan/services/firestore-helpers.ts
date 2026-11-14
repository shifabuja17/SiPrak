import { authErrorMessage } from '@/context/AuthContext';

function readErrorMessageLower(error: unknown): string {
  if (error instanceof Error && typeof error.message === 'string') {
    return error.message.toLowerCase();
  }
  return '';
}

/**
 * Mengubah error Firestore/Firebase atau kegagalan jaringan menjadi `Error`
 * dengan pesan berbahasa Indonesia yang jelas untuk UI (NFR-05).
 */
export function mapPraktikanFirestoreError(error: unknown): Error {
  const code = (error as { code?: string })?.code;
  switch (code) {
    case 'permission-denied':
    case 'firestore/permission-denied':
      return new Error('Anda tidak memiliki izin akses untuk operasi ini.');
    case 'unauthenticated':
    case 'firestore/unauthenticated':
      return new Error('Sesi autentikasi berakhir. Silakan login kembali.');
    case 'unavailable':
    case 'firestore/unavailable':
      return new Error('Layanan Firestore tidak dapat dijangkau. Periksa koneksi internet Anda.');
    case 'network-request-failed':
    case 'auth/network-request-failed':
      return new Error('Koneksi internet bermasalah. Periksa jaringan Anda lalu coba lagi.');
    case 'not-found':
    case 'firestore/not-found':
      return new Error('Data praktikum atau sesi tidak ditemukan.');
    case 'already-exists':
    case 'firestore/already-exists':
      return new Error('Data sudah tercatat sebelumnya.');
    case 'failed-precondition':
    case 'firestore/failed-precondition':
      return new Error('Prasyarat atau indeks Firestore belum tersedia.');
    case 'deadline-exceeded':
    case 'firestore/deadline-exceeded':
      return new Error('Koneksi ke server melebihi batas waktu. Periksa internet Anda.');
    case 'cancelled':
    case 'firestore/cancelled':
    case 'aborted':
    case 'firestore/aborted':
      return new Error('Permintaan ke server terputus atau dibatalkan. Silakan coba lagi.');
    case 'invalid-argument':
    case 'firestore/invalid-argument':
      return new Error('Data yang dikirim tidak sesuai format yang diharapkan.');
    case 'resource-exhausted':
    case 'firestore/resource-exhausted':
      return new Error('Layanan sedang sibuk. Coba lagi beberapa saat.');
    case 'internal':
    case 'firestore/internal':
    case 'unknown':
    case 'firestore/unknown':
    case 'data-loss':
    case 'firestore/data-loss':
      return new Error('Terjadi gangguan pada layanan server. Silakan coba beberapa saat lagi.');
  }

  const lowerMessage = readErrorMessageLower(error);
  if (
    lowerMessage.includes('client is offline') ||
    lowerMessage.includes('network request failed') ||
    lowerMessage.includes('failed to fetch') ||
    lowerMessage.includes('network error')
  ) {
    return new Error('Koneksi internet terputus atau offline. Periksa jaringan Anda lalu coba lagi.');
  }

  if (lowerMessage.includes('timeout') || lowerMessage.includes('timed out')) {
    return new Error('Koneksi ke server melebihi batas waktu. Silakan coba lagi.');
  }

  if (code) {
    return new Error(authErrorMessage(error));
  }

  if (error instanceof Error && error.message.trim().length > 0) {
    return error;
  }

  return new Error('Terjadi kesalahan komunikasi dengan server. Silakan coba lagi.');
}

export function readString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function toDateOrNull(value: unknown): Date | null {
  if (value == null) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (
    typeof value === 'object' &&
    'toDate' in value &&
    typeof (value as { toDate?: unknown }).toDate === 'function'
  ) {
    const parsed = (value as { toDate: () => Date }).toDate();
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (typeof value === 'number' || typeof value === 'string') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}
