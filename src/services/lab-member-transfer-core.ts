import {
  LAB_MEMBER_ROLES,
  buildLabMemberId,
  type LabMember,
  type LabMemberRole,
  type Laboratory,
} from '../types/laboratory';

/**
 * Setiap 1 anggota yang dipindahkan membutuhkan 2 operasi tulis dalam `writeBatch`
 * (nonaktifkan sumber + aktifkan/buat tujuan), sehingga batas atomik Firestore 500
 * operasi setara maksimal 250 anggota per pemindahan.
 */
export const MAX_ATOMIC_TRANSFER_USERS = 250;

export type TransferMemberItemStatus = 'transferred' | 'failed';

export interface TransferMemberItemResult {
  userId: string;
  sourceMemberId: string | null;
  targetMemberId: string | null;
  status: TransferMemberItemStatus;
  reason: string;
}

export interface TransferMembersResult {
  peran: LabMemberRole;
  sourceLabId: string;
  sourceLabName: string;
  targetLabId: string;
  targetLabName: string;
  mataKuliahId: string | null;
  requestedCount: number;
  transferredCount: number;
  failedCount: number;
  transferredUserIds: string[];
  deactivatedMemberIds: string[];
  activatedMemberIds: string[];
  error: string | null;
  items: TransferMemberItemResult[];
}

export interface TransferPlanEntry {
  userId: string;
  sourceMemberId: string;
  targetMemberId: string;
  reactivateTarget: boolean;
}

export interface TransferValidationInput {
  peran: LabMemberRole;
  sourceLabId: string;
  targetLabId: string;
  sourceLab: Laboratory | null;
  targetLab: Laboratory | null;
  userIds: readonly string[];
  sourceMembersByUserId: ReadonlyMap<string, LabMember>;
  targetMembersByUserId: ReadonlyMap<string, LabMember>;
}

export interface TransferValidationOutput {
  ok: boolean;
  sourceLabId: string;
  targetLabId: string;
  mataKuliahId: string | null;
  entries: TransferPlanEntry[];
  failures: TransferMemberItemResult[];
  summaryError: string | null;
}

function cleanSegment(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function buildFailureResult(
  sourceLabId: string,
  targetLabId: string,
  sourceLab: Laboratory | null,
  targetLab: Laboratory | null,
  userIds: readonly string[],
  reason: string,
): TransferValidationOutput {
  const failures: TransferMemberItemResult[] = userIds.map((uid) => ({
    userId: uid,
    sourceMemberId:
      sourceLabId && uid && !sourceLabId.includes('/') && !uid.includes('/')
        ? `${sourceLabId}_${uid}`
        : null,
    targetMemberId:
      targetLabId && uid && !targetLabId.includes('/') && !uid.includes('/')
        ? `${targetLabId}_${uid}`
        : null,
    status: 'failed',
    reason,
  }));

  return {
    ok: false,
    sourceLabId,
    targetLabId,
    mataKuliahId: sourceLab?.mataKuliahId ?? targetLab?.mataKuliahId ?? null,
    entries: [],
    failures,
    summaryError: reason,
  };
}

/**
 * Validasi murni dan penyusunan rencana pemindahan atomik untuk FR-09 (Praktikan)
 * dan FR-10 (Asprak) tanpa menyentuh `schedules` ataupun `sessions`.
 */
export function validateAndBuildTransferPlan(
  input: TransferValidationInput,
): TransferValidationOutput {
  const sourceLabId = cleanSegment(input.sourceLabId);
  const targetLabId = cleanSegment(input.targetLabId);

  const uniqueUserIds: string[] = [];
  const seen = new Set<string>();
  for (const rawId of input.userIds) {
    const cleanId = cleanSegment(rawId);
    if (!cleanId || seen.has(cleanId)) continue;
    seen.add(cleanId);
    uniqueUserIds.push(cleanId);
  }

  if (!sourceLabId || sourceLabId.includes('/')) {
    return buildFailureResult(
      sourceLabId,
      targetLabId,
      input.sourceLab,
      input.targetLab,
      uniqueUserIds,
      'ID laboratorium asal tidak valid.',
    );
  }

  if (!targetLabId || targetLabId.includes('/')) {
    return buildFailureResult(
      sourceLabId,
      targetLabId,
      input.sourceLab,
      input.targetLab,
      uniqueUserIds,
      'ID laboratorium tujuan tidak valid.',
    );
  }

  if (sourceLabId === targetLabId) {
    return buildFailureResult(
      sourceLabId,
      targetLabId,
      input.sourceLab,
      input.targetLab,
      uniqueUserIds,
      'Laboratorium asal dan laboratorium tujuan tidak boleh sama.',
    );
  }

  if (uniqueUserIds.length === 0) {
    return buildFailureResult(
      sourceLabId,
      targetLabId,
      input.sourceLab,
      input.targetLab,
      [],
      'Pilih minimal 1 anggota untuk dipindahkan.',
    );
  }

  if (uniqueUserIds.length > MAX_ATOMIC_TRANSFER_USERS) {
    return buildFailureResult(
      sourceLabId,
      targetLabId,
      input.sourceLab,
      input.targetLab,
      uniqueUserIds,
      `Jumlah anggota (${uniqueUserIds.length}) melebihi batas atomik sekali transfer (${MAX_ATOMIC_TRANSFER_USERS} anggota / 500 operasi Firestore).`,
    );
  }

  if (!input.sourceLab) {
    return buildFailureResult(
      sourceLabId,
      targetLabId,
      null,
      input.targetLab,
      uniqueUserIds,
      `Laboratorium asal "${sourceLabId}" tidak ditemukan di Firestore.`,
    );
  }

  if (!input.targetLab) {
    return buildFailureResult(
      sourceLabId,
      targetLabId,
      input.sourceLab,
      null,
      uniqueUserIds,
      `Laboratorium tujuan "${targetLabId}" tidak ditemukan di Firestore.`,
    );
  }

  // FR-09: Pemindahan praktikan WAJIB pada mata kuliah yang sama.
  const sourceCourse = cleanSegment(input.sourceLab.mataKuliahId);
  const targetCourse = cleanSegment(input.targetLab.mataKuliahId);

  if (input.peran === LAB_MEMBER_ROLES.PRAKTIKAN) {
    if (!sourceCourse || !targetCourse) {
      return buildFailureResult(
        sourceLabId,
        targetLabId,
        input.sourceLab,
        input.targetLab,
        uniqueUserIds,
        'Pemindahan praktikan memerlukan mataKuliahId yang terisi pada kedua laboratorium.',
      );
    }

    if (sourceCourse.toLowerCase() !== targetCourse.toLowerCase()) {
      return buildFailureResult(
        sourceLabId,
        targetLabId,
        input.sourceLab,
        input.targetLab,
        uniqueUserIds,
        `Pemindahan praktikan ditolak: mata kuliah lab asal (${sourceCourse}) berbeda dengan lab tujuan (${targetCourse}).`,
      );
    }
  }

  const entries: TransferPlanEntry[] = [];
  const failures: TransferMemberItemResult[] = [];
  const roleLabel =
    input.peran === LAB_MEMBER_ROLES.PRAKTIKAN ? 'praktikan' : 'asprak';

  for (const userId of uniqueUserIds) {
    if (userId.includes('/')) {
      failures.push({
        userId,
        sourceMemberId: null,
        targetMemberId: null,
        status: 'failed',
        reason: `ID pengguna "${userId}" tidak valid.`,
      });
      continue;
    }

    const sourceMemberId = buildLabMemberId(sourceLabId, userId);
    const targetMemberId = buildLabMemberId(targetLabId, userId);
    const sourceMember = input.sourceMembersByUserId.get(userId);
    const targetMember = input.targetMembersByUserId.get(userId);

    if (!sourceMember) {
      failures.push({
        userId,
        sourceMemberId,
        targetMemberId,
        status: 'failed',
        reason: `Pengguna "${userId}" tidak terdaftar pada laboratorium asal.`,
      });
      continue;
    }

    if (!sourceMember.aktif) {
      failures.push({
        userId,
        sourceMemberId,
        targetMemberId,
        status: 'failed',
        reason: `Keanggotaan "${userId}" pada laboratorium asal sudah tidak aktif.`,
      });
      continue;
    }

    if (sourceMember.peran !== input.peran) {
      failures.push({
        userId,
        sourceMemberId,
        targetMemberId,
        status: 'failed',
        reason: `Peran "${userId}" di lab asal adalah "${sourceMember.peran}", bukan "${roleLabel}".`,
      });
      continue;
    }

    if (targetMember?.aktif) {
      failures.push({
        userId,
        sourceMemberId,
        targetMemberId,
        status: 'failed',
        reason: `Pengguna "${userId}" sudah terdaftar aktif di laboratorium tujuan sebagai "${targetMember.peran}".`,
      });
      continue;
    }

    entries.push({
      userId,
      sourceMemberId,
      targetMemberId,
      reactivateTarget: Boolean(targetMember && !targetMember.aktif),
    });
  }

  if (failures.length > 0) {
    return {
      ok: false,
      sourceLabId,
      targetLabId,
      mataKuliahId: sourceCourse || targetCourse || null,
      entries: [],
      failures,
      summaryError: `${failures.length} anggota gagal lolos validasi pemindahan: ${failures[0].reason}`,
    };
  }

  return {
    ok: true,
    sourceLabId,
    targetLabId,
    mataKuliahId: sourceCourse || targetCourse || null,
    entries,
    failures: [],
    summaryError: null,
  };
}
