import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';

import { db } from '@/lib/firebase';
import { notifyLeaveDecision } from '@/features/notifications/services/notification-triggers';
import type { NotificationDispatchResult } from '@/features/notifications/types';

export type LeaveRequestStatus =
  | 'menunggu'
  | 'diterima'
  | 'ditolak';

export interface LeaveRequestRecord {
  id: string;
  uid: string;
  nama: string;
  sessionId: string;
  alasan: string;
  kategoriAI: string | null;
  status: LeaveRequestStatus;
  createdAt: Date | null;
}

interface TimestampLike {
  toDate: () => Date;
}

function convertTimestamp(value: unknown): Date | null {
  if (value instanceof Date) {
    return value;
  }

  if (
    typeof value === 'object' &&
    value !== null &&
    'toDate' in value &&
    typeof (value as TimestampLike).toDate === 'function'
  ) {
    return (value as TimestampLike).toDate();
  }

  return null;
}

// Mengambil daftar pengajuan izin secara real-time.
export function subscribeLeaveRequests(
  onData: (requests: LeaveRequestRecord[]) => void,
  onError?: (error: Error) => void
) {
  const requestsQuery = query(
    collection(db, 'leaveRequests'),
    orderBy('createdAt', 'desc')
  );

  return onSnapshot(
    requestsQuery,
    (snapshot) => {
      const requests: LeaveRequestRecord[] = snapshot.docs.map((item) => {
        const data = item.data();

        return {
          id: item.id,
          uid: data.uid,
          nama: data.nama || 'Nama tidak tersedia',
          sessionId: data.sessionId,
          alasan: data.alasan,
          kategoriAI: data.kategoriAI || null,
          status: data.status,
          createdAt: convertTimestamp(data.createdAt),
        };
      });

      onData(requests);
    },
    (error) => {
      console.error('Gagal mengambil pengajuan izin:', error);
      onError?.(error);
    }
  );
}

// Menerima atau menolak pengajuan izin.
export async function reviewLeaveRequest(
  requestId: string,
  status: 'diterima' | 'ditolak',
  reviewedBy: string
): Promise<NotificationDispatchResult> {
  const requestRef = doc(db, 'leaveRequests', requestId);

  const target = await runTransaction(db, async (transaction) => {
    const requestSnapshot = await transaction.get(requestRef);

    if (!requestSnapshot.exists()) {
      throw new Error('Pengajuan izin tidak ditemukan.');
    }

    if (requestSnapshot.data().status !== 'menunggu') {
      throw new Error('Pengajuan izin sudah diproses.');
    }

    transaction.update(requestRef, {
      status,
      reviewedBy,
      reviewedAt: serverTimestamp(),
    });

    return {
      uid: String(requestSnapshot.data().uid ?? ''),
      sessionId: String(requestSnapshot.data().sessionId ?? ''),
    };
  });

  // FR-21 / FR-22: keputusan sudah tersimpan; kegagalan notifikasi tidak membatalkannya.
  return notifyLeaveDecision({
    uid: target.uid,
    sessionId: target.sessionId,
    decision: status,
  });
}