import TabScreen from '@/components/common/tab-screen';
import AssistantClassesScreen from '@/app/assistant/classes';

/** Tab Praktikum & Peserta (FR-05 s.d. FR-07): kelas, peserta, dan jadwal per kelas. */
export default function PraktikumTab() {
  return (
    <TabScreen>
      <AssistantClassesScreen />
    </TabScreen>
  );
}
