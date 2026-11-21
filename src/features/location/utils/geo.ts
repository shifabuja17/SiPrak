const EARTH_RADIUS_METERS = 6_371_000;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export interface LatLng {
  latitude: number;
  longitude: number;
}

/** Jarak dua titik di permukaan bumi (rumus haversine), dalam meter. */
export function distanceInMeters(from: LatLng, to: LatLng): number {
  const dLat = toRadians(to.latitude - from.latitude);
  const dLng = toRadians(to.longitude - from.longitude);
  const lat1 = toRadians(from.latitude);
  const lat2 = toRadians(to.latitude);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(a)));
}

export interface RadiusCheckResult {
  distance: number;
  radius: number;
  withinRadius: boolean;
}

/** FR-05: memeriksa apakah posisi berada di dalam radius titik lokasi. */
export function checkWithinRadius(
  position: LatLng,
  center: LatLng,
  radius: number,
): RadiusCheckResult {
  const distance = distanceInMeters(position, center);
  return { distance, radius, withinRadius: distance <= radius };
}

export function isValidCoordinate(latitude: unknown, longitude: unknown): boolean {
  return (
    typeof latitude === 'number' &&
    typeof longitude === 'number' &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    Math.abs(latitude) <= 90 &&
    Math.abs(longitude) <= 180
  );
}

export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  return `${(meters / 1000).toFixed(2)} km`;
}
