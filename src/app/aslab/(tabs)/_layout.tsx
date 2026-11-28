import { PillTabs, type PillTab } from '@/components/app-tabs';

const ASLAB_TABS: PillTab[] = [
  { name: 'index', path: '/aslab', icon: 'home', label: 'Dashboard' },
  {
    name: 'laboratories',
    path: '/aslab/laboratories',
    icon: 'class',
    label: 'Laboratorium',
  },
  { name: 'maps', path: '/aslab/maps', icon: 'map', label: 'Peta' },
  {
    name: 'profile',
    path: '/aslab/profile',
    icon: 'profile',
    label: 'Profil',
  },
];

export default function AslabTabsLayout() {
  return <PillTabs tabs={ASLAB_TABS} />;
}
