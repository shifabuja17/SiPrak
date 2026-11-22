import { PillTabs, type PillTab } from '@/components/app-tabs';

const ASSISTANT_TABS: PillTab[] = [
  { name: 'index', path: '/assistant', icon: 'home', label: 'Beranda' },
  { name: 'praktikum', path: '/assistant/praktikum', icon: 'class', label: 'Praktikum & Peserta' },
  { name: 'sesi', path: '/assistant/sesi', icon: 'session', label: 'Sesi & Izin' },
  { name: 'maps', path: '/assistant/maps', icon: 'map', label: 'Peta' },
  { name: 'profile', path: '/assistant/profile', icon: 'profile', label: 'Profil' },
];

/**
 * Tab bar Asisten: pill melayang yang sama dengan Praktikan.
 * Beranda, Praktikum & Peserta (kelas, peserta, jadwal), Sesi & Izin, Peta (+ atur lokasi lab), Profil.
 */
export default function AssistantTabsLayout() {
  return <PillTabs tabs={ASSISTANT_TABS} />;
}
