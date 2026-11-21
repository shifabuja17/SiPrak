import {
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  type DocumentData,
  type DocumentReference,
  type Unsubscribe,
} from 'firebase/firestore';

import {
  mapPraktikanFirestoreError,
  readString,
  toDateOrNull,
} from '@/features/praktikan/services/firestore-helpers';
import { getLaboratory } from '@/features/location/services/laboratory-service';
import type { DeviceCoordinates, Laboratory } from '@/features/location/types';
import {
  checkWithinRadius,
  formatDistance,
  isValidCoordinate,
  type RadiusCheckResult,
} from '@/features/location/utils/geo';
import { db } from '@/lib/firebase';
import type { SessionAttendanceDoc } from '@/features/praktikan/types';

export interface SubmitPraktikanAttendanceInput {
  sessionId: string;
  uid: string;
  nama: string;
  /** Koordinat perangkat saat presensi (FR-03). */
  location: DeviceCoordinates;
}

export interface SubmitPraktikanAttendanceResult {
  lab: Laboratory;
  check: RadiusCheckResult;
}

function readNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function mapAttendanceDoc(
  data: DocumentData,
): SessionAttendanceDoc {
  const uid = readString(data.uid);
  if (!uid) {
    throw new Error('Dokumen presensi tidak memiliki field "uid" yang valid.');
  }

  const nama = readString(data.nama);
  if (!nama) {
    throw new Error('Dokumen presensi tidak memiliki field "nama" yang valid.');
  }

  return {
    uid,
    nama,
    waktu: toDateOrNull(data.waktu),
    labId: readString(data.labId),
    latitude: readNumber(data.latitude),
    longitude: readNumber(data.longitude),
    jarak: readNumber(data.jarak),
  };
}

function validateSessionOpenForAttendance(status: unknown): void {
  if (status === 'dibuka') return;
  if (status === 'dijadwalkan') {
    throw new Error('Sesi belum dibuka oleh Asisten.');
  }
  if (status === 'ditutup') {
    throw new Error('Sesi sudah ditutup. Presensi tidak dapat dilakukan.');
  }
  throw new Error(
    `Status sesi tidak valid untuk presensi (${String(status)}).`,
  );
}

async function resolveAttendanceWriteError(
  error: unknown,
  sessionRef: DocumentReference<DocumentData>,
  attendanceRef: DocumentReference<DocumentData>,
): Promise<Error> {
  const code = (error as { code?: string })?.code;
  if (code !== 'permission-denied' && code !== 'firestore/permission-denied') {
    return mapPraktikanFirestoreError(error);
  }

  // Pada kondisi balapan (mis. Asisten baru menutup sesi atau tap dari perangkat lain),
  // cek ulang dokumen sesi dan presensi untuk memberi alasan penolakan yang tepat.
  try {
    const [latestSession, latestAttendance] = await Promise.all([
      getDoc(sessionRef),
      getDoc(attendanceRef),
    ]);

    if (latestAttendance.exists()) {
      return new Error('Kamu sudah melakukan presensi pada sesi ini.');
    }
    if (!latestSession.exists()) {
      return new Error('Sesi praktikum tidak ditemukan.');
    }

    const latestStatus = latestSession.data().status;
    if (latestStatus === 'ditutup') {
      return new Error('Presensi gagal: sesi sudah ditutup oleh Asisten.');
    }
    if (latestStatus === 'dijadwalkan') {
      return new Error('Presensi gagal: sesi belum dibuka oleh Asisten.');
    }

    return new Error(
      'Presensi ditolak oleh aturan keamanan. Pastikan kamu berada di dalam radius lokasi sesi, akun terdaftar pada kelas ini, dan sesi masih dibuka.',
    );
  } catch (checkError) {
    const checkCode = (checkError as { code?: string })?.code;
    if (
      checkCode &&
      checkCode !== 'permission-denied' &&
      checkCode !== 'firestore/permission-denied'
    ) {
      return mapPraktikanFirestoreError(checkError);
    }

    return new Error(
      'Presensi ditolak. Sesi mungkin sudah ditutup oleh Asisten atau presensi kamu sudah tercatat.',
    );
  }
}

/**
 * Subscribe real-time ke SATU dokumen presensi milik Praktikan aktif:
 * `sessions/{sessionId}/attendance/{uid}` (tidak pernah meng-query seluruh koleksi).
 */
export function subscribeMyAttendance(
  sessionId: string,
  uid: string,
  onData: (attendance: SessionAttendanceDoc | null) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  const trimmedSessionId = sessionId.trim();
  const trimmedUid = uid.trim();

  if (!trimmedSessionId) {
    throw new Error('ID sesi wajib diisi untuk memantau presensi.');
  }
  if (!trimmedUid) {
    throw new Error('UID Praktikan wajib diisi untuk memantau presensi.');
  }

  let active = true;
  const attendanceRef = doc(
    db,
    'sessions',
    trimmedSessionId,
    'attendance',
    trimmedUid,
  );

  const unsubscribe = onSnapshot(
    attendanceRef,
    (snap) => {
      if (!active) return;
      if (!snap.exists()) {
        onData(null);
        return;
      }
      try {
        onData(mapAttendanceDoc(snap.data()));
      } catch (err) {
        onError(mapPraktikanFirestoreError(err));
      }
    },
    (err) => {
      if (!active) return;
      onError(mapPraktikanFirestoreError(err));
    },
  );

  return () => {
    active = false;
    unsubscribe();
  };
}

/**
 * Subscribe real-time status presensi milik `uid` aktif untuk sekumpulan `sessionIds`,
 * tetap membaca satu dokumen `sessions/{sessionId}/attendance/{uid}` per sesi.
 */
export function subscribeMyAttendanceMap(
  sessionIds: string[],
  uid: string,
  onData: (attendanceBySessionId: Record<string, SessionAttendanceDoc | null>) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  const trimmedUid = uid.trim();
  if (!trimmedUid) {
    throw new Error('UID Praktikan wajib diisi untuk memantau daftar presensi.');
  }

  const uniqueSessionIds = Array.from(
    new Set(sessionIds.map((id) => id.trim()).filter(Boolean)),
  );

  if (uniqueSessionIds.length === 0) {
    onData({});
    return () => {};
  }

  let active = true;
  let failed = false;
  const loadedIds = new Set<string>();
  const attendanceMap: Record<string, SessionAttendanceDoc | null> = {};
  const unsubscribes: Unsubscribe[] = [];

  const cleanupAll = () => {
    active = false;
    for (const unsub of unsubscribes) {
      unsub();
    }
  };

  for (const sessionId of uniqueSessionIds) {
    const unsub = subscribeMyAttendance(
      sessionId,
      trimmedUid,
      (docData) => {
        if (!active || failed) return;
        attendanceMap[sessionId] = docData;
        loadedIds.add(sessionId);
        if (loadedIds.size === uniqueSessionIds.length) {
          onData({ ...attendanceMap });
        }
      },
      (err) => {
        if (!active || failed) return;
        failed = true;
        cleanupAll();
        onError(err);
      },
    );
    unsubscribes.push(unsub);
  }

  return cleanupAll;
}

/**
 * Mengirim presensi berbasis lokasi ke `sessions/{sessionId}/attendance/{uid}`
 * (FR-04, FR-05, FR-07, FR-08). Status sesi, lab, radius, dan duplikasi dicek ulang
 * dari Firestore tepat sebelum menulis; `firestore.rules` memvalidasi ulang di server.
 * Melempar Error berpesan jelas bila salah satu syarat tidak terpenuhi atau penulisan gagal.
 */
export async function submitPraktikanAttendance({
  sessionId,
  uid,
  nama,
  location,
}: SubmitPraktikanAttendanceInput): Promise<SubmitPraktikanAttendanceResult> {
  const trimmedSessionId = sessionId.trim();
  const trimmedUid = uid.trim();
  const trimmedNama = nama.trim();

  if (!trimmedSessionId) {
    throw new Error('ID sesi wajib diisi.');
  }
  if (!trimmedUid) {
    throw new Error('Identitas akun tidak ditemukan. Silakan login kembali.');
  }
  if (!trimmedNama) {
    throw new Error('Nama praktikan wajib diisi pada profil akun.');
  }
  if (!isValidCoordinate(location.latitude, location.longitude)) {
    throw new Error('Koordinat perangkat tidak valid. Ambil ulang lokasi lalu coba lagi.');
  }

  const sessionRef = doc(db, 'sessions', trimmedSessionId);
  const attendanceRef = doc(
    db,
    'sessions',
    trimmedSessionId,
    'attendance',
    trimmedUid,
  );

  let sessionSnap;
  let attendanceSnap;
  try {
    [sessionSnap, attendanceSnap] = await Promise.all([
      getDoc(sessionRef),
      getDoc(attendanceRef),
    ]);
  } catch (err) {
    throw mapPraktikanFirestoreError(err);
  }

  if (!sessionSnap.exists()) {
    throw new Error('Sesi praktikum tidak ditemukan.');
  }

  if (attendanceSnap.exists()) {
    throw new Error('Kamu sudah melakukan presensi pada sesi ini.');
  }

  const sessionData = sessionSnap.data();
  validateSessionOpenForAttendance(sessionData.status);

  const labId = readString(sessionData.labId);
  if (!labId) {
    throw new Error(
      'Sesi ini belum memiliki titik lokasi. Hubungi Asisten untuk mengatur lokasi sesi.',
    );
  }

  let lab: Laboratory;
  try {
    lab = await getLaboratory(labId);
  } catch (err) {
    throw err instanceof Error && !(err as { code?: string }).code
      ? err
      : mapPraktikanFirestoreError(err);
  }

  const check = checkWithinRadius(location, lab, lab.radius);
  if (!check.withinRadius) {
    throw new Error(
      `Kamu berada ${formatDistance(check.distance)} dari ${lab.nama}, di luar radius presensi ${formatDistance(lab.radius)}.`,
    );
  }

  try {
    await setDoc(attendanceRef, {
      uid: trimmedUid,
      nama: trimmedNama,
      waktu: serverTimestamp(),
      labId,
      latitude: location.latitude,
      longitude: location.longitude,
      jarak: Math.round(check.distance * 10) / 10,
    });
  } catch (err) {
    throw await resolveAttendanceWriteError(err, sessionRef, attendanceRef);
  }

  return { lab, check };
}
