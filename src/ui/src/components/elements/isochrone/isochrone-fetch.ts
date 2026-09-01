/**
 * Isochrone fetch helpers: cache key (Single Responsibility)
 */

/**
 * Build cache key for isochrone request. Include ':stored' suffix when using pre-computed data
 * so cache doesn't collide with API-fetched data for same lat,lng,time,mode.
 */
export function getIsochroneCacheKey(
  lat: number,
  lng: number,
  time: number,
  mode: string,
  useStoredSuffix: boolean
): string {
  return `${lat},${lng},${time},${mode}${useStoredSuffix ? ':stored' : ''}`;
}
