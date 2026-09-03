import type { MultiPolygon, Polygon } from 'geojson';
import { compactH3CellId } from './cell-id';
import { coordinatesToH3 } from '../geometry/core';
import { geometryCentroidLatLon } from './cell-polygon-join';

export type H3CentroidFeature<T extends Record<string, unknown>> = Readonly<{
  geometry: Polygon | MultiPolygon;
  key: string;
  record: T;
}>;

/**
 * Bucket polygon features into H3 cells using each feature's geometry centroid.
 */
export function assignFeaturesToH3ByCentroid<T extends Record<string, unknown>>(
  features: ReadonlyArray<H3CentroidFeature<T>>,
  resolution: number,
): Map<string, Record<string, T>> {
  const byCell = new Map<string, Record<string, T>>();

  for (const feature of features) {
    const centroid = geometryCentroidLatLon(feature.geometry);
    if (!centroid) continue;

    const cell = compactH3CellId(coordinatesToH3(resolution)(centroid));
    let bucket = byCell.get(cell);
    if (!bucket) {
      bucket = {};
      byCell.set(cell, bucket);
    }
    bucket[feature.key] = feature.record;
  }

  return byCell;
}
