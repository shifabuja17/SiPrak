import { Redirect, type Href } from 'expo-router';

import { useAuth } from '@/context/AuthContext';

/**
 * Pintu masuk untuk pengguna yang sudah login (rute ini dilindungi guard di
 * _layout.tsx). Pengguna yang belum login diarahkan ke /login.
 * Tujuan diarahkan berdasarkan role akun di Firestore.
 */
export default function Index() {
  const { profile } = useAuth();

  if (profile?.role === 'asisten') {
    return <Redirect href={'/assistant/(tabs)' as Href} />;
  }

  return <Redirect href="/(tabs)/schedule" />;
}
