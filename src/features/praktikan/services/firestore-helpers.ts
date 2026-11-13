import { authErrorMessage } from '@/context/AuthContext';

/**
 * Mengubah error Firestore/Firebase menjadi `Error` dengan pesan yang rapi untuk UI.
 */
export function mapPraktikanFirestoreError(error: unknown): Error {
  const code = (error as { code?: string })?.code;
  switch (code) {
    case 'unauthenticated':
    case 'firestore/unauthenticated':
      return new Error('Sesi autentikasi berakhir. Silakan login kembali.');
    case 'not-found':
    case 'firestore/not-found':
      return new Error('Data praktikum atau sesi tidak ditemukan.');
    case 'failed-precondition':
    case 'firestore/failed-precondition':
      return new Error('Prasyarat atau indeks Firestore belum tersedia.');
    case 'deadline-exceeded':
    case 'firestore/deadline-exceeded':
      return new Error('Koneksi ke server melebihi batas waktu. Periksa internet kamu.');
    case 'resource-exhausted':
    case 'firestore/resource-exhausted':
      return new Error('Layanan sedang sibuk. Coba lagi beberapa saat.');
    default:
      return new Error(authErrorMessage(error));
  }
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
