/** Average travel speeds by mode (km/h). */
const TRAVEL_SPEEDS_KMH: Record<string, number> = {
  driving: 50,
  cycling: 15,
  walking: 5,
};

const KM_TO_MILES = 0.621371;

/**
 * Estimate travel radius in meters from time and mode.
 */
export function estimateTravelRadiusMeters(timeMinutes: number, mode: string): number {
  const speedKmh = TRAVEL_SPEEDS_KMH[mode] ?? TRAVEL_SPEEDS_KMH.driving;
  const distanceKm = (speedKmh * timeMinutes) / 60;
  return distanceKm * 1000;
}

/**
 * Estimate travel radius in miles from time and mode.
 */
export function estimateTravelRadiusMiles(timeMinutes: number, mode: string): number {
  return (estimateTravelRadiusMeters(timeMinutes, mode) / 1000) * KM_TO_MILES;
}
