/**
 * FR-17 — Menghubungkan token perangkat dengan identitas pengguna di Firestore.
 *
 * Struktur dokumen `pushTokens/{uid}`:
 *   { uid, role, tokens: string[], platform, updatedAt }
 * Satu pengguna dapat memiliki beberapa perangkat, jadi token disimpan sebagai array.
 */
import {
  arrayRemove,
  arrayUnion,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';

import { db } from '@/lib/firebase';
import type { Role } from '@/types/user';

import { getCurrentDeviceToken, setCurrentDeviceToken } from './device-token-store';
import { PUSH_TOKENS_COLLECTION, type TokenRecipient } from '../types';

/** Menyimpan (atau memperbarui) token perangkat milik pengguna yang sedang login. */
export async function saveDeviceToken(
  uid: string,
  role: Role,
  token: string,
  platform: string,
) {
  await setDoc(
    doc(db, PUSH_TOKENS_COLLECTION, uid),
    {
      uid,
      role,
      tokens: arrayUnion(token),
      platform,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

/** Menghapus satu token dari dokumen pengguna (logout atau token tidak valid). */
export async function removeDeviceToken(uid: string, token: string) {
  await updateDoc(doc(db, PUSH_TOKENS_COLLECTION, uid), {
    tokens: arrayRemove(token),
  });
}

/**
 * Dipanggil sebelum logout agar perangkat ini tidak lagi menerima notifikasi
 * milik akun yang baru keluar. Best-effort: kegagalan tidak boleh menghalangi logout.
 */
export async function unregisterDeviceForUser(uid: string) {
  const token = getCurrentDeviceToken();
  if (!token) return;

  try {
    await removeDeviceToken(uid, token);
  } catch (error) {
    console.warn('Gagal menghapus token perangkat saat logout:', error);
  } finally {
    setCurrentDeviceToken(null);
  }
}

/** Mengambil seluruh token milik daftar pengguna. Pengguna tanpa token dilewati. */
export async function getTokensForUids(uids: string[]): Promise<TokenRecipient[]> {
  const uniqueUids = [...new Set(uids)];

  const snapshots = await Promise.all(
    uniqueUids.map((uid) => getDoc(doc(db, PUSH_TOKENS_COLLECTION, uid))),
  );

  const recipients: TokenRecipient[] = [];
  snapshots.forEach((snapshot, index) => {
    if (!snapshot.exists()) return;

    const tokens: unknown = snapshot.data().tokens;
    if (!Array.isArray(tokens)) return;

    for (const token of tokens) {
      if (typeof token === 'string' && token.length > 0) {
        recipients.push({ uid: uniqueUids[index], token });
      }
    }
  });

  return recipients;
}

/** FR-24 — Membersihkan token yang dilaporkan tidak valid (DeviceNotRegistered). */
export async function removeInvalidTokens(invalid: TokenRecipient[]) {
  await Promise.allSettled(
    invalid.map((item) => removeDeviceToken(item.uid, item.token)),
  );
}
