import type { Polygon } from '../../types';
import { unwrapPolygonRingLongitudes } from '@geokit/h3/lite';
import { geohashBounds } from './bounds';
import { validateGeohash } from './validation';

type LonLat = [number, number];

export function geohashToPolygon(hash: string): Polygon | null {
  if (!validateGeohash(hash)) return null;

  try {
    const [minLon, minLat, maxLon, maxLat] = geohashBounds(hash);
    const ring = unwrapPolygonRingLongitudes([
      [minLon, minLat],
      [maxLon, minLat],
      [maxLon, maxLat],
      [minLon, maxLat],
    ] as LonLat[]);
    if (ring.length > 0) {
      ring.push([ring[0][0], ring[0][1]]);
    }
    return {
      type: 'Polygon',
      coordinates: [ring],
    };
  } catch {
    return null;
  }
}
