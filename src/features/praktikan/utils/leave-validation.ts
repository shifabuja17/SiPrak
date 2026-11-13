/**
 * Batas panjang input pengajuan izin mengikuti aturan di `firestore.rules`.
 */
export const LEAVE_REASON_MIN_LENGTH = 5;
export const LEAVE_REASON_MAX_LENGTH = 500;
export const LEAVE_AI_CATEGORY_MAX_LENGTH = 50;

/**
 * Memvalidasi alasan pengajuan izin setelah `.trim()`.
 * Mengembalikan pesan error berbahasa Indonesia atau `null` jika valid.
 */
export function validateLeaveReason(alasan: string): string | null {
  const trimmed = typeof alasan === 'string' ? alasan.trim() : '';

  if (!trimmed) {
    return 'Alasan ketidakhadiran wajib diisi.';
  }

  if (trimmed.length < LEAVE_REASON_MIN_LENGTH) {
    return `Alasan izin minimal ${LEAVE_REASON_MIN_LENGTH} karakter.`;
  }

  if (trimmed.length > LEAVE_REASON_MAX_LENGTH) {
    return `Alasan izin maksimal ${LEAVE_REASON_MAX_LENGTH} karakter.`;
  }

  return null;
}
