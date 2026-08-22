/**
 * Sample a MapLibre viewport and resolve visible US state abbreviations (lowercase).
 */

export type MapViewportBounds = {
  getNorthEast(): { lat: number; lng: number };
  getSouthWest(): { lat: number; lng: number };
};

export type StateAbbrResolver = (lat: number, lng: number) => string | null | undefined;

/** Resolve unique lowercase state codes from viewport corners and center. */
export function resolveStatesInMapView(
  map: { getBounds(): MapViewportBounds },
  resolveAbbr: StateAbbrResolver
): string[] {
  const bounds = map.getBounds();
  const ne = bounds.getNorthEast();
  const sw = bounds.getSouthWest();
  const midLat = (ne.lat + sw.lat) / 2;
  const midLng = (ne.lng + sw.lng) / 2;

  const samples: Array<[number, number]> = [
    [ne.lat, ne.lng],
    [ne.lat, sw.lng],
    [sw.lat, ne.lng],
    [sw.lat, sw.lng],
    [midLat, midLng],
  ];

  const states = new Set<string>();
  for (const [lat, lng] of samples) {
    const abbr = resolveAbbr(lat, lng);
    if (abbr) states.add(abbr.toLowerCase());
  }
  return [...states].sort();
}
