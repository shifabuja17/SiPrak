/**
 * FR-19 s.d. FR-24 — Pemicu notifikasi untuk tiga peristiwa aplikasi.
 *
 * Fungsi di sini dipanggil SETELAH data peristiwa berhasil disimpan ke Firestore
 * (buka sesi, ubah jadwal/sesi, keputusan izin). Semuanya:
 * - tidak pernah melempar error, sehingga gagal kirim tidak membatalkan aksi Asisten;
 * - mengembalikan `NotificationDispatchResult` agar UI bisa menampilkan status yang jujur.
 */
import { doc, getDoc } from 'firebase/firestore';

import { db } from '@/lib/firebase';

import { sendExpoPush } from './expo-push-sender';
import {
  getMemberUidsOfClasses,
  resolveClassIdOfSession,
} from './notification-recipients';
import { getTokensForUids, removeInvalidTokens } from './push-token-service';
import type { NotificationDispatchResult, NotificationPayload } from '../types';

function emptyResult(
  status: NotificationDispatchResult['status'],
  extra: Partial<NotificationDispatchResult> = {},
): NotificationDispatchResult {
  return {
    status,
    recipientCount: 0,
    tokenCount: 0,
    acceptedCount: 0,
    failedCount: 0,
    ...extra,
  };
}

function failedResult(reason: string): NotificationDispatchResult {
  return emptyResult('failed', { reason });
}

function readText(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback;
}

/** Mengirim `payload` ke seluruh perangkat milik `uids`. */
async function dispatch(
  uids: string[],
  payload: NotificationPayload,
): Promise<NotificationDispatchResult> {
  const uniqueUids = [...new Set(uids)];

  if (uniqueUids.length === 0) {
    return emptyResult('no_recipients');
  }

  let recipients;
  try {
    recipients = await getTokensForUids(uniqueUids);
  } catch (error) {
    console.warn('Gagal membaca token perangkat:', error);
    return failedResult('Data perangkat penerima tidak dapat dibaca. Periksa koneksi internet.');
  }

  if (recipients.length === 0) {
    return emptyResult('no_tokens', { recipientCount: uniqueUids.length });
  }

  const outcome = await sendExpoPush(recipients, payload);

  if (outcome.invalid.length > 0) {
    // Best-effort; kegagalan pembersihan tidak mengubah hasil pengiriman.
    void removeInvalidTokens(outcome.invalid);
  }

  const tokenCount = outcome.accepted + outcome.failed;
  const status: NotificationDispatchResult['status'] =
    outcome.accepted === 0 ? 'failed' : outcome.failed === 0 ? 'sent' : 'partial';

  return {
    status,
    recipientCount: uniqueUids.length,
    tokenCount,
    acceptedCount: outcome.accepted,
    failedCount: outcome.failed,
    ...(outcome.reason ? { reason: outcome.reason } : {}),
  };
}

// ==========================================
// FR-19 — SESI DIBUKA
// ==========================================

export async function notifySessionOpened(
  sessionId: string,
): Promise<NotificationDispatchResult> {
  try {
    const snapshot = await getDoc(doc(db, 'sessions', sessionId));
    if (!snapshot.exists()) {
      return failedResult('Data sesi tidak ditemukan untuk dikirimkan notifikasi.');
    }

    const data = snapshot.data();
    const classId = await resolveClassIdOfSession(data);
    const memberUids = classId ? await getMemberUidsOfClasses([classId]) : [];

    const practicumName = readText(data.practicumName, 'Praktikum');
    const moduleTitle = readText(data.moduleTitle, '');
    const place = readText(data.labName, readText(data.classRoom, 'laboratorium'));

    return await dispatch(memberUids, {
      type: 'session_opened',
      title: 'Sesi praktikum dibuka',
      body: `${practicumName}${moduleTitle ? ` — ${moduleTitle}` : ''} di ${place} sudah dibuka. Segera lakukan presensi.`,
      data: { sessionId },
    });
  } catch (error) {
    console.warn('Notifikasi pembukaan sesi gagal:', error);
    return failedResult('Notifikasi pembukaan sesi gagal diproses.');
  }
}

// ==========================================
// FR-20 — JADWAL / SESI BERUBAH
// ==========================================

export interface ScheduleChangeNotice {
  /** Kelas yang terdampak (kelas lama + baru jika kelas diganti). */
  classIds: string[];
  practicumName: string;
  /** Ringkasan perubahan, satu butir per baris. */
  changes: string[];
  sessionId?: string;
  scheduleId?: string;
}

export async function notifyScheduleChanged(
  notice: ScheduleChangeNotice,
): Promise<NotificationDispatchResult> {
  try {
    const memberUids = await getMemberUidsOfClasses(notice.classIds);

    return await dispatch(memberUids, {
      type: 'schedule_changed',
      title: 'Jadwal praktikum berubah',
      body: `${readText(notice.practicumName, 'Praktikum')}: ${notice.changes.join('; ')}.`,
      data: {
        ...(notice.sessionId ? { sessionId: notice.sessionId } : {}),
        ...(notice.scheduleId ? { scheduleId: notice.scheduleId } : {}),
      },
    });
  } catch (error) {
    console.warn('Notifikasi perubahan jadwal gagal:', error);
    return failedResult('Notifikasi perubahan jadwal gagal diproses.');
  }
}

// ==========================================
// FR-21 & FR-22 — KEPUTUSAN IZIN
// ==========================================

export async function notifyLeaveDecision(input: {
  uid: string;
  sessionId: string;
  decision: 'diterima' | 'ditolak';
}): Promise<NotificationDispatchResult> {
  try {
    let practicumName = 'praktikum';
    try {
      const sessionSnapshot = await getDoc(doc(db, 'sessions', input.sessionId));
      if (sessionSnapshot.exists()) {
        practicumName = readText(sessionSnapshot.data().practicumName, practicumName);
      }
    } catch {
      // Nama praktikum hanya pelengkap pesan; notifikasi tetap dikirim tanpanya.
    }

    const accepted = input.decision === 'diterima';

    return await dispatch([input.uid], {
      type: accepted ? 'leave_accepted' : 'leave_rejected',
      title: accepted ? 'Pengajuan izin diterima' : 'Pengajuan izin ditolak',
      body: accepted
        ? `Pengajuan izin untuk ${practicumName} diterima oleh Asisten.`
        : `Pengajuan izin untuk ${practicumName} ditolak oleh Asisten.`,
      data: { sessionId: input.sessionId },
    });
  } catch (error) {
    console.warn('Notifikasi keputusan izin gagal:', error);
    return failedResult('Notifikasi keputusan izin gagal diproses.');
  }
}
