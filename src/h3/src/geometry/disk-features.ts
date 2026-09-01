import type { Feature, FeatureCollection, Polygon } from 'geojson';
import { h3ToPolygon } from '../geometry/boundary';
import { h3Neighbors } from '../adjacency/neighbors';

export type H3DiskToFeatureCollectionOptions = {
  /** Merged into every feature's properties. */
  properties?: Record<string, unknown>;
};

/**
 * Build a GeoJSON FeatureCollection for an H3 cell and its k-ring (`gridDisk`).
 *
 * Each feature is a Polygon with `h3Index` and `isCenter` properties.
 * Invalid cells are skipped.
 *
 * @param h3Index - Center H3 cell id
 * @param k - Ring size passed to `gridDisk` (0 = center cell only)
 *
 * @example
 * ```typescript
 * const fc = h3DiskToFeatureCollection('892a1072c97ffff', 2);
 * map.getSource('h3-ring').setData(fc);
 * ```
 */
export function h3DiskToFeatureCollection(
  h3Index: string,
  k: number = 0,
  options: H3DiskToFeatureCollectionOptions = {}
): FeatureCollection<Polygon> {
  const ringK = Math.max(0, k);
  const cells = ringK === 0 ? [h3Index] : h3Neighbors(h3Index, ringK);
  const extra = options.properties ?? {};

  const features: Feature<Polygon>[] = [];

  for (const cellId of cells) {
    const geometry = h3ToPolygon(cellId);
    if (!geometry) continue;

    features.push({
      type: 'Feature',
      id: cellId,
      geometry,
      properties: {
        h3Index: cellId,
        isCenter: cellId === h3Index,
        ...extra,
      },
    });
  }

  return {
    type: 'FeatureCollection',
    features,
  };
}
