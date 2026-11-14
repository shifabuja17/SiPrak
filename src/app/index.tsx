import { Redirect } from 'expo-router';

/**
 * Pintu masuk untuk pengguna yang sudah login (rute ini dilindungi guard di
 * _layout.tsx). Pengguna yang belum login tidak pernah sampai ke sini: mereka
 * diarahkan ke /login. Pemilihan peran manual (data dummy sprint 1) sudah
 * diganti oleh Firebase Authentication, perannya datang dari akun.
 */
export default function Index() {
  return <Redirect href="/(tabs)/schedule" />;
}