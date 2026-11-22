/**
 * Menyimpan token perangkat ini di memori selama aplikasi berjalan, supaya token yang
 * sama bisa dihapus dari Firestore ketika pengguna logout.
 * Sengaja tanpa dependensi agar aman diimpor dari AuthContext.
 */
let currentDeviceToken: string | null = null;

export function setCurrentDeviceToken(token: string | null) {
  currentDeviceToken = token;
}

export function getCurrentDeviceToken(): string | null {
  return currentDeviceToken;
}
