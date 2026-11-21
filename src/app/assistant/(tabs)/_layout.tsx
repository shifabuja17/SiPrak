import { PillTabs, type PillTab } from '@/components/app-tabs';

const ASSISTANT_TABS: PillTab[] = [
  { name: 'index', path: '/assistant', icon: 'home', label: 'Beranda' },
  { name: 'profile', path: '/assistant/profile', icon: 'profile', label: 'Profil' },
];

/** Tab bar Asisten: pill melayang yang sama dengan Praktikan (Beranda, Peta, Profil). */
export default function AssistantTabsLayout() {
  return <PillTabs tabs={ASSISTANT_TABS} mapAfter={1} />;
}
