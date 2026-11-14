import type { LeaveAiClassificationResult } from '@/features/praktikan/types';
import { LEAVE_AI_CATEGORY_MAX_LENGTH } from '@/features/praktikan/utils/leave-validation';

const AI_CLASSIFY_TIMEOUT_MS = 6000;
const CATEGORY_FIELD_CANDIDATES = ['category', 'kategori', 'label', 'prediction'] as const;

function readAiClassifyConfig(): {
  endpoint: string;
  apiKey: string;
  endpointValid: boolean;
} {
  const endpoint = process.env.EXPO_PUBLIC_AI_CLASSIFY_URL?.trim() ?? '';
  const apiKey = process.env.EXPO_PUBLIC_AI_API_KEY?.trim() ?? '';

  if (!endpoint) {
    return { endpoint: '', apiKey, endpointValid: false };
  }

  try {
    const parsed = new URL(endpoint);
    const endpointValid = parsed.protocol === 'http:' || parsed.protocol === 'https:';
    return { endpoint, apiKey, endpointValid };
  } catch {
    return { endpoint, apiKey, endpointValid: false };
  }
}

function formatAiNetworkErrorReason(error: unknown): string {
  const lowerMessage =
    error instanceof Error && typeof error.message === 'string'
      ? error.message.toLowerCase()
      : '';

  if (
    lowerMessage.includes('network request failed') ||
    lowerMessage.includes('failed to fetch') ||
    lowerMessage.includes('load failed') ||
    lowerMessage.includes('networkerror') ||
    lowerMessage.includes('offline')
  ) {
    return 'Tidak dapat menghubungi layanan AI karena koneksi internet bermasalah atau offline.';
  }

  return 'Gagal menghubungi layanan AI.';
}

/**
 * Membentuk header HTTP untuk API klasifikasi AI pengajar.
 * Sesuaikan di sini bila endpoint membutuhkan header autentikasi selain Bearer (mis. `x-api-key`).
 */
function buildAiClassifyHeaders(apiKey: string): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };

  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  return headers;
}

/**
 * Membentuk body JSON untuk request API klasifikasi AI pengajar.
 * Saat ini mengirim `{ reason }`; ubah di sini bila endpoint tim/pengajar memakai `alasan` atau `text`.
 */
function buildAiClassifyBody(trimmedReason: string): string {
  return JSON.stringify({
    reason: trimmedReason,
  });
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readCategoryFromRecord(record: Record<string, unknown>): string | null {
  for (const field of CATEGORY_FIELD_CANDIDATES) {
    const candidate = record[field];
    if (typeof candidate === 'string' && candidate.trim().length > 0) {
      return candidate;
    }
  }
  return null;
}

function normalizeCategoryLength(rawCategory: string): string | null {
  const collapsed = rawCategory.trim().replace(/\s+/g, ' ');
  if (!collapsed) {
    return null;
  }

  if (collapsed.length > LEAVE_AI_CATEGORY_MAX_LENGTH) {
    return collapsed.slice(0, LEAVE_AI_CATEGORY_MAX_LENGTH).trimEnd();
  }

  return collapsed;
}

function extractAiCategory(payload: unknown): string | null {
  if (!isPlainRecord(payload)) {
    return null;
  }

  const directMatch = readCategoryFromRecord(payload);
  if (directMatch) {
    return normalizeCategoryLength(directMatch);
  }

  const nestedData = payload.data;
  if (typeof nestedData === 'string' && nestedData.trim().length > 0) {
    return normalizeCategoryLength(nestedData);
  }

  if (isPlainRecord(nestedData)) {
    const nestedMatch = readCategoryFromRecord(nestedData);
    if (nestedMatch) {
      return normalizeCategoryLength(nestedMatch);
    }
  }

  return null;
}

function isTimeoutError(error: unknown, signal: AbortSignal): boolean {
  return signal.aborted || (error instanceof Error && error.name === 'AbortError');
}

/**
 * Mengklasifikasikan kategori alasan izin Praktikan via API AI eksternal (FR-16, FR-21, NFR-06).
 * Hanya menghasilkan label kategori pendukung (`category`) atau kegagalan aman (`category: null`),
 * dan tidak pernah menentukan status keputusan (`diterima` / `ditolak`) maupun melempar error
 * yang memblokir pengajuan izin.
 */
export async function classifyLeaveReason(
  alasan: string,
): Promise<LeaveAiClassificationResult> {
  const { endpoint, apiKey, endpointValid } = readAiClassifyConfig();
  if (!endpoint) {
    return {
      ok: false,
      category: null,
      reason: 'Endpoint layanan AI belum dikonfigurasi.',
    };
  }

  if (!endpointValid) {
    return {
      ok: false,
      category: null,
      reason: 'Konfigurasi URL layanan AI tidak valid.',
    };
  }

  const trimmedReason = typeof alasan === 'string' ? alasan.trim() : '';
  if (!trimmedReason) {
    return {
      ok: false,
      category: null,
      reason: 'Alasan izin kosong sehingga tidak dapat diklasifikasikan.',
    };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, AI_CLASSIFY_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: buildAiClassifyHeaders(apiKey),
      body: buildAiClassifyBody(trimmedReason),
      signal: controller.signal,
    });
  } catch (error) {
    clearTimeout(timeoutId);
    if (isTimeoutError(error, controller.signal)) {
      return {
        ok: false,
        category: null,
        reason: 'Permintaan ke layanan AI melewati batas waktu (timeout).',
      };
    }

    return {
      ok: false,
      category: null,
      reason: formatAiNetworkErrorReason(error),
    };
  }

  // Biarkan timeout melindungi fase pembacaan body response juga sebelum clearTimeout di finally.
  try {
    if (!response.ok) {
      return {
        ok: false,
        category: null,
        reason: `Layanan AI mengembalikan status HTTP ${response.status}.`,
      };
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      return {
        ok: false,
        category: null,
        reason: 'Respons layanan AI tidak berupa JSON yang valid.',
      };
    }

    const category = extractAiCategory(payload);
    if (!category) {
      return {
        ok: false,
        category: null,
        reason: 'Respons layanan AI tidak memuat label kategori yang valid.',
      };
    }

    return {
      ok: true,
      category,
    };
  } catch (error) {
    if (isTimeoutError(error, controller.signal)) {
      return {
        ok: false,
        category: null,
        reason: 'Permintaan ke layanan AI melewati batas waktu (timeout).',
      };
    }

    return {
      ok: false,
      category: null,
      reason:
        error instanceof Error && error.message
          ? `Gagal membaca respons layanan AI: ${error.message}`
          : 'Gagal membaca respons layanan AI.',
    };
  } finally {
    clearTimeout(timeoutId);
  }
}
