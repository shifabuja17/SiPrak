export interface DeviceCoordinates {
  latitude: number;
  longitude: number;
  /** Perkiraan akurasi GPS dalam meter (null bila tidak tersedia, mis. di web). */
  accuracy: number | null;
  /** True bila lokasi berasal dari mock provider / simulasi. */
  mocked: boolean;
  timestamp: number;
}

/** Alasan lokasi perangkat tidak bisa diperoleh (FR-03). */
export type LocationFailureReason =
  | 'permission-denied'
  | 'permission-blocked'
  | 'services-disabled'
  | 'unavailable'
  | 'timeout';

export class DeviceLocationError extends Error {
  readonly reason: LocationFailureReason;

  constructor(reason: LocationFailureReason, message: string) {
    super(message);
    this.name = 'DeviceLocationError';
    this.reason = reason;
  }
}
