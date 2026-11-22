/**
 * FR-19 s.d. FR-22 & FR-24 — Pengiriman push notification.
 *
 * Pengiriman memakai Expo Push Service (https://exp.host/--/api/v2/push/send), yang
 * meneruskan pesan ke FCM (Android) / APNs (iOS). Dipanggil dari perangkat Asisten
 * sesaat setelah peristiwa berhasil disimpan ke Firestore, sehingga tidak butuh server
 * atau Cloud Functions.
 *
 * Catatan kejujuran status (NFR-03): ticket `ok` berarti pesan DITERIMA layanan push,
 * bukan sudah sampai ke perangkat. Aplikasi tidak menyatakan "terkirim ke perangkat".
 */
import { NOTIFICATION_CHANNEL_ID, type NotificationPayload, type TokenRecipient } from '../types';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const MAX_MESSAGES_PER_REQUEST = 100;
const REQUEST_TIMEOUT_MS = 12_000;

export interface SendOutcome {
  accepted: number;
  failed: number;
  /** Token yang dilaporkan tidak terdaftar lagi; layak dihapus dari Firestore. */
  invalid: TokenRecipient[];
  /** Pesan singkat untuk pengguna jika ada kegagalan. */
  reason?: string;
}

interface ExpoTicket {
  status: 'ok' | 'error';
  message?: string;
  details?: { error?: string };
}

function chunk<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
}

async function postWithTimeout(body: unknown): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    return await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

export async function sendExpoPush(
  recipients: TokenRecipient[],
  payload: NotificationPayload,
): Promise<SendOutcome> {
  // Satu token cukup dikirim sekali.
  const seen = new Set<string>();
  const unique = recipients.filter((item) => {
    if (seen.has(item.token)) return false;
    seen.add(item.token);
    return true;
  });

  const outcome: SendOutcome = { accepted: 0, failed: 0, invalid: [] };

  for (const group of chunk(unique, MAX_MESSAGES_PER_REQUEST)) {
    const messages = group.map((item) => ({
      to: item.token,
      title: payload.title,
      body: payload.body,
      data: { ...payload.data, type: payload.type },
      sound: 'default',
      priority: 'high',
      channelId: NOTIFICATION_CHANNEL_ID,
    }));

    try {
      const response = await postWithTimeout(messages);

      if (!response.ok) {
        outcome.failed += group.length;
        outcome.reason = `Layanan notifikasi menolak permintaan (HTTP ${response.status}).`;
        continue;
      }

      const json = (await response.json()) as { data?: ExpoTicket[] };
      const tickets = Array.isArray(json.data) ? json.data : [];

      group.forEach((item, index) => {
        const ticket = tickets[index];

        if (ticket?.status === 'ok') {
          outcome.accepted += 1;
          return;
        }

        outcome.failed += 1;
        if (ticket?.details?.error === 'DeviceNotRegistered') {
          outcome.invalid.push(item);
        } else if (!outcome.reason) {
          outcome.reason = ticket?.message ?? 'Layanan notifikasi menolak sebagian pesan.';
        }
      });
    } catch (error) {
      outcome.failed += group.length;
      const aborted = error instanceof Error && error.name === 'AbortError';
      outcome.reason = aborted
        ? 'Permintaan ke layanan notifikasi melewati batas waktu.'
        : 'Koneksi bermasalah, notifikasi tidak dapat dikirim.';
    }
  }

  return outcome;
}
