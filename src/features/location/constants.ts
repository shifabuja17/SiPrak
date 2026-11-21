/**
 * Empat titik lokasi tetap praktikum (FR-09). Koordinat awal berasal dari
 * `koordinat_fsm_undip.json`; nilai aktif tetap dibaca dari Firestore.
 */
export const LAB_IDS = [
  'lab-informatika-b',
  'lab-informatika-c',
  'lab-informatika-d',
  'dekanat-fsm',
] as const;

export type LabId = (typeof LAB_IDS)[number];

/** Radius dipakai bila dokumen lab belum punya `radius` yang valid. */
export const DEFAULT_ATTENDANCE_RADIUS_METERS = 50;
