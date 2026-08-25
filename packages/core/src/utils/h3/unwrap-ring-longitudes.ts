type LonLat = [number, number];

/**
 * Keep ring longitudes continuous so map renderers do not draw antimeridian-spanning chords.
 * GeoJSON permits longitude outside [-180, 180] for display.
 */
export function unwrapPolygonRingLongitudes(ring: LonLat[]): LonLat[] {
  if (ring.length === 0) return ring;

  const unwrapped: LonLat[] = [[ring[0][0], ring[0][1]]];
  for (let i = 1; i < ring.length; i++) {
    let lng = ring[i][0];
    const prevLng = unwrapped[unwrapped.length - 1][0];
    while (lng - prevLng > 180) lng -= 360;
    while (lng - prevLng < -180) lng += 360;
    unwrapped.push([lng, ring[i][1]]);
  }
  return unwrapped;
}
