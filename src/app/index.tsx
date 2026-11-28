import { Redirect, type Href } from 'expo-router';

import { useAuth } from '@/context/AuthContext';
import { getHomeRouteForRole } from '@/types/user';

/**
 * Pintu masuk untuk pengguna yang sudah login (rute ini dilindungi guard di
 * _layout.tsx). Pengguna yang belum login diarahkan ke /login.
 * Tujuan diarahkan berdasarkan role akun di Firestore:
 * ASLAB -> /aslab, ASPRAK (termasuk legacy ASISTEN) -> /assistant/(tabs), PRAKTIKAN -> /(tabs)/schedule.
 */
export default function Index() {
  const { profile } = useAuth();

  return <Redirect href={getHomeRouteForRole(profile?.role) as Href} />;
}
