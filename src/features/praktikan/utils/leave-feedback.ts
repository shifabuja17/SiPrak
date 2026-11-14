import { Alert } from 'react-native';

import type { SubmitLeaveRequestOutcome } from '@/features/praktikan/types';

/**
 * Menampilkan dialog konfirmasi hasil pengajuan izin Praktikan, termasuk
 * info kategori AI pendukung atau catatan fallback non-blocking saat AI gagal (FR-21, NFR-06).
 */
export function showLeaveSubmitSuccessAlert(outcome: SubmitLeaveRequestOutcome): void {
  if (!outcome.ok) {
    return;
  }

  const category =
    typeof outcome.kategoriAI === 'string' && outcome.kategoriAI.trim().length > 0
      ? outcome.kategoriAI.trim()
      : null;

  if (outcome.aiClassified && category) {
    Alert.alert(
      'Pengajuan Izin Terkirim',
      `Pengajuan izin berhasil dikirim.\n\nKategori AI (Info Pendukung): ${category}\nStatus saat ini: Menunggu keputusan Asisten.\n\nKategori AI tidak menentukan persetujuan atau penolakan.`,
    );
    return;
  }

  const warningDetail =
    typeof outcome.aiWarning === 'string' && outcome.aiWarning.trim().length > 0
      ? outcome.aiWarning.trim()
      : 'Layanan klasifikasi AI tidak merespons.';

  Alert.alert(
    'Pengajuan Izin Terkirim',
    `Pengajuan izin Anda tetap terkirim dengan status Menunggu keputusan Asisten.\n\nInfo AI (non-blocking): ${warningDetail} Tidak ada keputusan otomatis; Asisten akan meninjau alasan Anda secara langsung.`,
  );
}
