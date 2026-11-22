/**
 * FR-23 — Menentukan penerima notifikasi berdasarkan peristiwa.
 *
 * Aturan:
 * - Pembukaan sesi & perubahan jadwal -> seluruh anggota kelas terkait
 *   (`classes/{classId}/members/{uid}`), sama dengan aturan yang dipakai halaman Praktikan.
 * - Keputusan izin -> hanya praktikan pemilik pengajuan.
 * `classId` pada sesi bisa kosong; jika demikian diselesaikan lewat `schedules/{scheduleId}.classId`.
 */
import { collection, doc, getDoc, getDocs } from 'firebase/firestore';

import { db } from '@/lib/firebase';

function readText(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

/** UID seluruh anggota sebuah kelas. */
export async function getClassMemberUids(classId: string): Promise<string[]> {
  const snapshot = await getDocs(collection(db, 'classes', classId, 'members'));
  return snapshot.docs.map((item) => item.id);
}

/** Gabungan anggota beberapa kelas tanpa duplikat. */
export async function getMemberUidsOfClasses(classIds: string[]): Promise<string[]> {
  const uniqueClassIds = [...new Set(classIds.filter(Boolean))];
  const groups = await Promise.all(uniqueClassIds.map(getClassMemberUids));
  return [...new Set(groups.flat())];
}

/** Menentukan kelas dari data dokumen sesi. */
export async function resolveClassIdOfSession(
  sessionData: Record<string, unknown>,
): Promise<string | null> {
  const direct = readText(sessionData.classId);
  if (direct) return direct;

  const scheduleId = readText(sessionData.scheduleId);
  if (!scheduleId) return null;

  const scheduleSnapshot = await getDoc(doc(db, 'schedules', scheduleId));
  return scheduleSnapshot.exists() ? readText(scheduleSnapshot.data().classId) : null;
}
