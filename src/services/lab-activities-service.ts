import {
  collection,
  onSnapshot,
  type DocumentData,
  type Unsubscribe,
} from 'firebase/firestore';

import {
  getLaboratoryPreset,
  isLaboratoryId,
  type LaboratoryId,
} from '@/features/assistant/services/laboratory-service';
import type { SessionStatus } from '@/features/assistant/services/session-service';
import {
  mapPraktikanFirestoreError,
  readString,
  toDateOrNull,
} from '@/features/praktikan/services/firestore-helpers';
import { formatMeetingTitle } from '@/features/praktikan/utils/format';
import { db } from '@/lib/firebase';

export type LabActivitySessionStatus = SessionStatus | 'jadwal_rutin';

export interface LabActivityItem {
  id: string;
  source: 'session' | 'schedule';
  labId: LaboratoryId;
  labName: string;
  sessionId: string | null;
  scheduleId: string | null;
  classId: string | null;
  practicumName: string;
  className: string;
  classCode: string | null;
  moduleTitle: string | null;
  scheduleTime: string;
  status: LabActivitySessionStatus;
  statusLabel: string;
  sessionNote: string;
  minutesUntilStart: number | null;
}

export interface LabRealtimeActivitiesSummary {
  ongoingActivity: LabActivityItem | null;
  nextActivity: LabActivityItem | null;
  ongoingActivities: LabActivityItem[];
  upcomingActivities: LabActivityItem[];
}

export interface RawLabClassRecord {
  id: string;
  nama?: string;
  kode?: string;
  practicumName?: string;
  className?: string;
}

export interface RawLabScheduleRecord {
  id: string;
  classId?: string;
  practicumName?: string;
  className?: string;
  moduleTitle?: string;
  classRoom?: string;
  scheduleTime?: string;
  dayTime?: string;
  day?: string;
  time?: string;
  createdAt: Date | null;
}

export interface RawLabSessionRecord {
  id: string;
  scheduleId?: string;
  classId?: string;
  labId?: string;
  labName?: string;
  practicumName?: string;
  className?: string;
  moduleTitle?: string;
  classRoom?: string;
  scheduleTime?: string;
  dayTime?: string;
  status: SessionStatus;
  sessionNote: string;
  createdAt: Date | null;
  openedAt: Date | null;
}

export interface LabActivitiesSnapshotData {
  classesById: Map<string, RawLabClassRecord>;
  schedulesById: Map<string, RawLabScheduleRecord>;
  sessions: RawLabSessionRecord[];
}

export interface ParsedScheduleTimeSlot {
  dayOfWeek: number | null;
  dayLabel: string | null;
  startMinutes: number | null;
  endMinutes: number | null;
  isParseable: boolean;
}

const VALID_SESSION_STATUSES = new Set<SessionStatus>([
  'dijadwalkan',
  'dibuka',
  'ditutup',
]);

const INDONESIAN_DAY_NAMES = [
  'Minggu',
  'Senin',
  'Selasa',
  'Rabu',
  'Kamis',
  'Jumat',
  'Sabtu',
] as const;

const DAY_INDEX_BY_TOKEN: Record<string, number> = {
  minggu: 0,
  ahad: 0,
  senin: 1,
  selasa: 2,
  rabu: 3,
  kamis: 4,
  jumat: 5,
  "jum'at": 5,
  'jum’at': 5,
  sabtu: 6,
};

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;
const MINUTES_PER_DAY = 24 * 60;
const MINUTES_PER_WEEK = 7 * MINUTES_PER_DAY;

const DAY_REGEX = /\b(minggu|ahad|senin|selasa|rabu|kamis|jum['’]?at|sabtu)\b/i;
const TIME_RANGE_REGEX =
  /(\d{1,2})\s*[:.]\s*(\d{2})\s*(?:[-–—]|s\.?d\.?)\s*(\d{1,2})\s*[:.]\s*(\d{2})/i;
const SINGLE_TIME_REGEX = /(\d{1,2})\s*[:.]\s*(\d{2})/;

function padTwo(value: number): string {
  return String(value).padStart(2, '0');
}

function formatMinutesAsClock(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${padTwo(hours)}:${padTwo(minutes)}`;
}

function toValidMinutes(hoursText: string, minutesText: string): number | null {
  const hours = Number.parseInt(hoursText, 10);
  const minutes = Number.parseInt(minutesText, 10);

  if (
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null;
  }

  return hours * 60 + minutes;
}

/**
 * Mengurai string waktu pelaksanaan mingguan (mis. `"Senin, 08.00 - 10.00 WIB"`)
 * secara deterministik tanpa bergantung pada parser `Date` bawaan yang tidak konsisten.
 */
export function parseScheduleTimeSlot(
  scheduleTime: string | undefined | null,
): ParsedScheduleTimeSlot {
  const trimmed = scheduleTime?.trim() ?? '';
  if (!trimmed) {
    return {
      dayOfWeek: null,
      dayLabel: null,
      startMinutes: null,
      endMinutes: null,
      isParseable: false,
    };
  }

  const dayMatch = trimmed.match(DAY_REGEX);
  const normalizedDayToken = dayMatch?.[1]?.toLowerCase() ?? '';
  const dayOfWeek =
    normalizedDayToken && normalizedDayToken in DAY_INDEX_BY_TOKEN
      ? DAY_INDEX_BY_TOKEN[normalizedDayToken]
      : null;
  const dayLabel =
    dayOfWeek !== null ? INDONESIAN_DAY_NAMES[dayOfWeek] : null;

  let startMinutes: number | null = null;
  let endMinutes: number | null = null;

  const rangeMatch = trimmed.match(TIME_RANGE_REGEX);
  if (rangeMatch) {
    const parsedStart = toValidMinutes(rangeMatch[1], rangeMatch[2]);
    const parsedEnd = toValidMinutes(rangeMatch[3], rangeMatch[4]);
    startMinutes = parsedStart;
    endMinutes =
      parsedStart !== null && parsedEnd !== null && parsedEnd > parsedStart
        ? parsedEnd
        : null;
  } else {
    const singleMatch = trimmed.match(SINGLE_TIME_REGEX);
    if (singleMatch) {
      startMinutes = toValidMinutes(singleMatch[1], singleMatch[2]);
    }
  }

  return {
    dayOfWeek,
    dayLabel,
    startMinutes,
    endMinutes,
    isParseable: dayOfWeek !== null && startMinutes !== null,
  };
}

/**
 * Menormalkan tampilan waktu pelaksanaan agar terbaca konsisten di UI (mis. `"Senin, 08:00 - 10:00 WIB"`),
 * namun tetap mempertahankan teks asli bila memakai format bebas.
 */
export function formatScheduleTimeDisplay(
  scheduleTime: string | undefined | null,
): string {
  const trimmed = scheduleTime?.trim() ?? '';
  if (!trimmed) return '-';

  const slot = parseScheduleTimeSlot(trimmed);
  if (!slot.isParseable || slot.dayLabel === null || slot.startMinutes === null) {
    return trimmed;
  }

  const startClock = formatMinutesAsClock(slot.startMinutes);
  const timePart =
    slot.endMinutes !== null
      ? `${startClock} - ${formatMinutesAsClock(slot.endMinutes)} WIB`
      : `${startClock} WIB`;

  return `${slot.dayLabel}, ${timePart}`;
}

/**
 * Mengubah status sesi ke label Bahasa Indonesia yang siap ditampilkan di UI.
 */
export function formatSessionStatusLabel(
  status: LabActivitySessionStatus,
): string {
  switch (status) {
    case 'dibuka':
      return 'Sedang Berlangsung';
    case 'dijadwalkan':
      return 'Dijadwalkan';
    case 'ditutup':
      return 'Selesai';
    case 'jadwal_rutin':
      return 'Terjadwal';
  }
}

/**
 * Menghitung selisih menit ke pelaksanaan terdekat dari waktu WIB (`UTC+7`) saat ini.
 * Mengembalikan `0` bila jadwal berada di hari yang sama dalam rentang jam pelaksanaan saat ini.
 */
export function computeMinutesUntilNextSlot(
  slot: ParsedScheduleTimeSlot,
  referenceDate: Date = new Date(),
): number | null {
  if (!slot.isParseable || slot.dayOfWeek === null || slot.startMinutes === null) {
    return null;
  }

  const wibNow = new Date(referenceDate.getTime() + WIB_OFFSET_MS);
  const nowDay = wibNow.getUTCDay();
  const nowMinutes = wibNow.getUTCHours() * 60 + wibNow.getUTCMinutes();

  const dayDiff = (slot.dayOfWeek - nowDay + 7) % 7;
  const rawDelta = dayDiff * MINUTES_PER_DAY + (slot.startMinutes - nowMinutes);

  if (rawDelta >= 0) {
    return rawDelta;
  }

  // Hari yang sama dan jam mulai sudah lewat: bila masih di dalam rentang selesai,
  // anggap sedang masuk jendela pelaksanaan saat ini (`0` menit lagi).
  if (
    dayDiff === 0 &&
    slot.endMinutes !== null &&
    nowMinutes < slot.endMinutes
  ) {
    return 0;
  }

  return rawDelta + MINUTES_PER_WEEK;
}

function matchesLocationText(
  locationText: string | undefined,
  labId: LaboratoryId,
): boolean {
  const normalized = locationText?.trim().toLowerCase() ?? '';
  if (!normalized) return false;

  const preset = getLaboratoryPreset(labId);
  const presetNameLower = preset.name.toLowerCase();

  return (
    normalized === labId ||
    normalized === presetNameLower ||
    normalized.includes(presetNameLower)
  );
}

function doesSessionBelongToLab(
  session: RawLabSessionRecord,
  schedule: RawLabScheduleRecord | undefined,
  labId: LaboratoryId,
): boolean {
  if (session.labId) {
    return session.labId === labId;
  }

  return (
    matchesLocationText(session.labName, labId) ||
    matchesLocationText(session.classRoom, labId) ||
    matchesLocationText(schedule?.classRoom, labId)
  );
}

function resolveScheduleTimeText(
  session: RawLabSessionRecord | undefined,
  schedule: RawLabScheduleRecord | undefined,
): string {
  // Prioritaskan data jadwal hidup agar perubahan di koleksi `schedules`
  // langsung tercermin meski dokumen `sessions` menyimpan salinan lama.
  if (schedule) {
    if (schedule.scheduleTime) return schedule.scheduleTime;
    if (schedule.dayTime) return schedule.dayTime;
    if (schedule.day && schedule.time) return `${schedule.day}, ${schedule.time}`;
    if (schedule.day ?? schedule.time) return (schedule.day ?? schedule.time)!;
  }

  return session?.scheduleTime ?? session?.dayTime ?? '-';
}

function resolvePracticumAndClassInfo(
  session: RawLabSessionRecord | undefined,
  schedule: RawLabScheduleRecord | undefined,
  classRecord: RawLabClassRecord | undefined,
): {
  practicumName: string;
  className: string;
  classCode: string | null;
} {
  const practicumName =
    schedule?.practicumName ??
    session?.practicumName ??
    classRecord?.practicumName ??
    classRecord?.nama ??
    '-';

  const classCode = classRecord?.kode ?? null;
  const rawClassName =
    classRecord?.className ??
    classRecord?.nama ??
    session?.className ??
    schedule?.className;

  let className = '-';
  if (rawClassName && classCode) {
    className =
      rawClassName.toLowerCase() === practicumName.toLowerCase()
        ? `Kelas ${classCode}`
        : `${rawClassName} (${classCode})`;
  } else if (rawClassName) {
    className =
      rawClassName.toLowerCase() === practicumName.toLowerCase()
        ? 'Kelas Reguler'
        : rawClassName;
  } else if (classCode) {
    className = `Kelas ${classCode}`;
  }

  return {
    practicumName,
    className,
    classCode,
  };
}

function mapClassRecord(id: string, data: DocumentData): RawLabClassRecord {
  return {
    id,
    nama: readString(data.nama) ?? readString(data.name),
    kode: readString(data.kode) ?? readString(data.code),
    practicumName: readString(data.practicumName),
    className: readString(data.className),
  };
}

function mapScheduleRecord(
  id: string,
  data: DocumentData,
): RawLabScheduleRecord {
  return {
    id,
    classId: readString(data.classId),
    practicumName: readString(data.practicumName),
    className: readString(data.className),
    moduleTitle: readString(data.moduleTitle) ?? readString(data.topic),
    classRoom: readString(data.classRoom) ?? readString(data.room),
    scheduleTime: readString(data.scheduleTime),
    dayTime: readString(data.dayTime),
    day: readString(data.day),
    time: readString(data.time),
    createdAt: toDateOrNull(data.createdAt),
  };
}

function mapSessionRecord(
  id: string,
  data: DocumentData,
): RawLabSessionRecord | null {
  if (
    typeof data.status !== 'string' ||
    !VALID_SESSION_STATUSES.has(data.status as SessionStatus)
  ) {
    return null;
  }

  return {
    id,
    scheduleId: readString(data.scheduleId),
    classId: readString(data.classId),
    labId: readString(data.labId),
    labName: readString(data.labName),
    practicumName: readString(data.practicumName),
    className: readString(data.className),
    moduleTitle:
      readString(data.moduleTitle) ??
      readString(data.topic) ??
      readString(data.title),
    classRoom: readString(data.classRoom) ?? readString(data.room),
    scheduleTime: readString(data.scheduleTime),
    dayTime: readString(data.dayTime),
    status: data.status as SessionStatus,
    sessionNote: readString(data.sessionNote) ?? readString(data.note) ?? '',
    createdAt: toDateOrNull(data.createdAt),
    openedAt: toDateOrNull(data.openedAt),
  };
}

function compareTimestampDesc(a: Date | null, b: Date | null): number {
  const aTime = a?.getTime() ?? Number.NEGATIVE_INFINITY;
  const bTime = b?.getTime() ?? Number.NEGATIVE_INFINITY;
  return bTime - aTime;
}

function compareTimestampAsc(a: Date | null, b: Date | null): number {
  const aTime = a?.getTime() ?? Number.MAX_SAFE_INTEGER;
  const bTime = b?.getTime() ?? Number.MAX_SAFE_INTEGER;
  return aTime - bTime;
}

/**
 * Mengolah snapshot real-time `sessions`, `schedules`, dan `classes` menjadi
 * `ongoingActivity` (`status === 'dibuka'`) dan `nextActivity` (terdekat berikutnya)
 * secara deterministik untuk `labId` tertentu.
 */
export function computeLabRealtimeActivities(
  data: LabActivitiesSnapshotData,
  labId: LaboratoryId,
  referenceDate: Date = new Date(),
): LabRealtimeActivitiesSummary {
  const preset = getLaboratoryPreset(labId);

  const ongoingEntries: {
    item: LabActivityItem;
    openedAt: Date | null;
    createdAt: Date | null;
  }[] = [];

  const upcomingEntries: {
    item: LabActivityItem;
    createdAt: Date | null;
  }[] = [];

  // Mencatat `scheduleId` yang sudah punya sesi aktif/terjadwal di lab mana pun
  // agar jadwal yang sama tidak terduplikasi oleh entri fallback dari `schedules`.
  const coveredScheduleIds = new Set<string>();

  for (const session of data.sessions) {
    if (
      session.scheduleId &&
      (session.status === 'dibuka' || session.status === 'dijadwalkan')
    ) {
      coveredScheduleIds.add(session.scheduleId);
    }

    const schedule = session.scheduleId
      ? data.schedulesById.get(session.scheduleId)
      : undefined;

    if (!doesSessionBelongToLab(session, schedule, labId)) {
      continue;
    }

    const resolvedClassId = session.classId ?? schedule?.classId ?? null;
    const classRecord = resolvedClassId
      ? data.classesById.get(resolvedClassId)
      : undefined;

    const { practicumName, className, classCode } =
      resolvePracticumAndClassInfo(session, schedule, classRecord);

    // Modul milik sesi; modul di jadwal hanya ada pada data lama dan jadi cadangan.
    const rawModuleTitle = session.moduleTitle ?? schedule?.moduleTitle;
    const moduleTitle = rawModuleTitle
      ? formatMeetingTitle(rawModuleTitle)
      : null;

    const rawScheduleTime = resolveScheduleTimeText(session, schedule);
    const scheduleTime = formatScheduleTimeDisplay(rawScheduleTime);
    const parsedSlot = parseScheduleTimeSlot(rawScheduleTime);
    const minutesUntilStart = computeMinutesUntilNextSlot(
      parsedSlot,
      referenceDate,
    );

    const item: LabActivityItem = {
      id: `session:${session.id}`,
      source: 'session',
      labId,
      labName: session.labName ?? preset.name,
      sessionId: session.id,
      scheduleId: session.scheduleId ?? null,
      classId: resolvedClassId,
      practicumName,
      className,
      classCode,
      moduleTitle,
      scheduleTime,
      status: session.status,
      statusLabel: formatSessionStatusLabel(session.status),
      sessionNote: session.sessionNote,
      minutesUntilStart,
    };

    if (session.status === 'dibuka') {
      ongoingEntries.push({
        item,
        openedAt: session.openedAt,
        createdAt: session.createdAt,
      });
    } else if (session.status === 'dijadwalkan') {
      upcomingEntries.push({
        item,
        createdAt: session.createdAt,
      });
    }
  }

  // Fallback deterministik: sertakan jadwal rutin yang cocok dengan nama lab ini
  // apabila belum ada sesi `'dibuka'` maupun `'dijadwalkan'` untuk jadwal tersebut.
  for (const schedule of data.schedulesById.values()) {
    if (coveredScheduleIds.has(schedule.id)) {
      continue;
    }
    if (!matchesLocationText(schedule.classRoom, labId)) {
      continue;
    }

    const resolvedClassId = schedule.classId ?? null;
    const classRecord = resolvedClassId
      ? data.classesById.get(resolvedClassId)
      : undefined;

    const { practicumName, className, classCode } =
      resolvePracticumAndClassInfo(undefined, schedule, classRecord);

    const moduleTitle = schedule.moduleTitle
      ? formatMeetingTitle(schedule.moduleTitle)
      : null;

    const rawScheduleTime = resolveScheduleTimeText(undefined, schedule);
    const scheduleTime = formatScheduleTimeDisplay(rawScheduleTime);
    const parsedSlot = parseScheduleTimeSlot(rawScheduleTime);
    const minutesUntilStart = computeMinutesUntilNextSlot(
      parsedSlot,
      referenceDate,
    );

    upcomingEntries.push({
      item: {
        id: `schedule:${schedule.id}`,
        source: 'schedule',
        labId,
        labName: preset.name,
        sessionId: null,
        scheduleId: schedule.id,
        classId: resolvedClassId,
        practicumName,
        className,
        classCode,
        moduleTitle,
        scheduleTime,
        status: 'jadwal_rutin',
        statusLabel: formatSessionStatusLabel('jadwal_rutin'),
        sessionNote: '',
        minutesUntilStart,
      },
      createdAt: schedule.createdAt,
    });
  }

  ongoingEntries.sort((a, b) => {
    const openedDiff = compareTimestampDesc(a.openedAt, b.openedAt);
    if (openedDiff !== 0) return openedDiff;

    const createdDiff = compareTimestampDesc(a.createdAt, b.createdAt);
    if (createdDiff !== 0) return createdDiff;

    const nameDiff = a.item.practicumName.localeCompare(
      b.item.practicumName,
      'id',
    );
    if (nameDiff !== 0) return nameDiff;

    return a.item.id.localeCompare(b.item.id);
  });

  upcomingEntries.sort((a, b) => {
    const aMinutes = a.item.minutesUntilStart ?? Number.POSITIVE_INFINITY;
    const bMinutes = b.item.minutesUntilStart ?? Number.POSITIVE_INFINITY;
    if (aMinutes !== bMinutes) return aMinutes - bMinutes;

    if (a.item.source !== b.item.source) {
      return a.item.source === 'session' ? -1 : 1;
    }

    const createdDiff = compareTimestampAsc(a.createdAt, b.createdAt);
    if (createdDiff !== 0) return createdDiff;

    const nameDiff = a.item.practicumName.localeCompare(
      b.item.practicumName,
      'id',
    );
    if (nameDiff !== 0) return nameDiff;

    return a.item.id.localeCompare(b.item.id);
  });

  const ongoingActivities = ongoingEntries.map((entry) => entry.item);
  const upcomingActivities = upcomingEntries.map((entry) => entry.item);

  return {
    ongoingActivity: ongoingActivities[0] ?? null,
    nextActivity: upcomingActivities[0] ?? null,
    ongoingActivities,
    upcomingActivities,
  };
}

/**
 * Subscribe real-time ke koleksi `sessions`, `schedules`, dan `classes` di Firestore.
 * Memanggil `cleanup()` secara otomatis akan menghentikan seluruh 3 listener `onSnapshot`.
 */
export function subscribeLabActivitiesSnapshot(
  labId: LaboratoryId,
  onData: (data: LabActivitiesSnapshotData) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  if (!isLaboratoryId(labId)) {
    throw new Error(`ID laboratorium tidak valid: "${String(labId)}".`);
  }

  let active = true;
  let failed = false;
  let classesLoaded = false;
  let schedulesLoaded = false;
  let sessionsLoaded = false;

  const classesById = new Map<string, RawLabClassRecord>();
  const schedulesById = new Map<string, RawLabScheduleRecord>();
  let sessions: RawLabSessionRecord[] = [];

  let classesUnsub: Unsubscribe | null = null;
  let schedulesUnsub: Unsubscribe | null = null;
  let sessionsUnsub: Unsubscribe | null = null;

  const cleanupAll = () => {
    active = false;
    classesUnsub?.();
    schedulesUnsub?.();
    sessionsUnsub?.();
  };

  const emitIfReady = () => {
    if (
      !active ||
      failed ||
      !classesLoaded ||
      !schedulesLoaded ||
      !sessionsLoaded
    ) {
      return;
    }

    onData({
      classesById: new Map(classesById),
      schedulesById: new Map(schedulesById),
      sessions: [...sessions],
    });
  };

  const handleListenerError = (error: unknown) => {
    if (!active || failed) return;
    failed = true;
    cleanupAll();
    onError(mapPraktikanFirestoreError(error));
  };

  classesUnsub = onSnapshot(
    collection(db, 'classes'),
    (snapshot) => {
      if (!active || failed) return;
      classesById.clear();
      for (const docSnap of snapshot.docs) {
        classesById.set(
          docSnap.id,
          mapClassRecord(docSnap.id, docSnap.data()),
        );
      }
      classesLoaded = true;
      emitIfReady();
    },
    handleListenerError,
  );

  schedulesUnsub = onSnapshot(
    collection(db, 'schedules'),
    (snapshot) => {
      if (!active || failed) return;
      schedulesById.clear();
      for (const docSnap of snapshot.docs) {
        schedulesById.set(
          docSnap.id,
          mapScheduleRecord(docSnap.id, docSnap.data()),
        );
      }
      schedulesLoaded = true;
      emitIfReady();
    },
    handleListenerError,
  );

  sessionsUnsub = onSnapshot(
    collection(db, 'sessions'),
    (snapshot) => {
      if (!active || failed) return;
      const nextSessions: RawLabSessionRecord[] = [];
      for (const docSnap of snapshot.docs) {
        const mapped = mapSessionRecord(docSnap.id, docSnap.data());
        if (mapped) {
          nextSessions.push(mapped);
        }
      }
      sessions = nextSessions;
      sessionsLoaded = true;
      emitIfReady();
    },
    handleListenerError,
  );

  return cleanupAll;
}
