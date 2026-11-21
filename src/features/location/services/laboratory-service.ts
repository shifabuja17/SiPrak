import {
  doc,
  getDoc,
  onSnapshot,
  type DocumentData,
  type Unsubscribe,
} from 'firebase/firestore';

import { DEFAULT_ATTENDANCE_RADIUS_METERS } from '@/features/location/constants';
import type { Laboratory } from '@/features/location/types';
import { isValidCoordinate } from '@/features/location/utils/geo';
import { db } from '@/lib/firebase';

function readRadius(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? value
    : DEFAULT_ATTENDANCE_RADIUS_METERS;
}

/** Memetakan dokumen `laboratories/{id}`; null bila koordinatnya belum valid. */
export function mapLaboratoryDoc(id: string, data: DocumentData): Laboratory | null {
  if (!isValidCoordinate(data.latitude, data.longitude)) {
    return null;
  }

  return {
    id,
    nama: typeof data.nama === 'string' && data.nama.trim() ? data.nama.trim() : id,
    gedung: typeof data.gedung === 'string' ? data.gedung : null,
    latitude: data.latitude,
    longitude: data.longitude,
    radius: readRadius(data.radius),
  };
}

const LAB_NOT_READY_MESSAGE =
  'Koordinat titik lokasi sesi ini belum diatur Asisten. Presensi belum dapat dilakukan.';

/** Mengambil titik lokasi sekali baca (dipakai saat menyimpan presensi). */
export async function getLaboratory(labId: string): Promise<Laboratory> {
  const snapshot = await getDoc(doc(db, 'laboratories', labId));
  if (!snapshot.exists()) {
    throw new Error(LAB_NOT_READY_MESSAGE);
  }
  const lab = mapLaboratoryDoc(snapshot.id, snapshot.data());
  if (!lab) {
    throw new Error(LAB_NOT_READY_MESSAGE);
  }
  return lab;
}

/** Subscribe real-time satu titik lokasi; `onData(null)` bila belum ada/tidak valid. */
export function subscribeLaboratory(
  labId: string,
  onData: (lab: Laboratory | null) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    doc(db, 'laboratories', labId),
    (snapshot) => {
      onData(snapshot.exists() ? mapLaboratoryDoc(snapshot.id, snapshot.data()) : null);
    },
    (error) => onError(error),
  );
}
