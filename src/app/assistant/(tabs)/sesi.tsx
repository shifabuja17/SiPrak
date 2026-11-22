import AssistantSessionsScreen from '@/app/assistant/sessions';
import TabScreen from '@/components/common/tab-screen';

/**
 * Tab Sesi Asisten: Sesi & Presensi (FR-08, FR-12, FR-13). Pengajuan izin (FR-18, FR-19)
 * diperiksa per sesi lewat tombol "Cek Presensi" di kartu sesi.
 */
export default function SesiTab() {
  return (
    <TabScreen>
      <AssistantSessionsScreen />
    </TabScreen>
  );
}
