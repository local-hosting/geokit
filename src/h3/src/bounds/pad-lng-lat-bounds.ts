/** Axis-aligned bounds `[west, south, east, north]` in degrees. */
export type LngLatBounds = readonly [west: number, south: number, east: number, north: number];

/** Fractional grow on a lock bbox (pan slack beyond the nominal region). */
export const MAP_MAX_BOUNDS_BBOX_PAD_FRACTION = 0.3;

/** Minimum degrees of pan slack on each side (~9 km lat; lon varies by latitude). */
export const MAP_MAX_BOUNDS_MIN_PAD_DEGREES = 0.08;

export function padLngLatBounds(
  bounds: LngLatBounds,
  padFraction = MAP_MAX_BOUNDS_BBOX_PAD_FRACTION,
): LngLatBounds {
  const [west, south, east, north] = bounds;
  const lngSpan = east - west;
  const latSpan = north - south;
  const padLng = Math.max(lngSpan * padFraction, MAP_MAX_BOUNDS_MIN_PAD_DEGREES);
  const padLat = Math.max(latSpan * padFraction, MAP_MAX_BOUNDS_MIN_PAD_DEGREES);
  return [west - padLng, south - padLat, east + padLng, north + padLat];
}