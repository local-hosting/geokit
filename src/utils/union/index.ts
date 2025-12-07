/**
 * Polygon union operations using Turf.js
 */

import turfUnion from '@turf/union';
import { polygon as turfPolygon, multiPolygon as turfMultiPolygon } from '@turf/helpers';
import type { Polygon, MultiPolygon, Feature } from '../types';
import type { Feature as GeoJSONFeature, Polygon as GeoJSONPolygon, MultiPolygon as GeoJSONMultiPolygon, FeatureCollection, GeoJsonProperties } from 'geojson';

type PolygonFeature = GeoJSONFeature<GeoJSONPolygon | GeoJSONMultiPolygon, GeoJsonProperties>;

/**
 * Union two polygons into a single polygon
 *
 * @param polygon1 - First polygon
 * @param polygon2 - Second polygon
 * @returns Merged polygon or multipolygon, or null if union fails
 *
 * @example
 * ```typescript
 * const merged = unionPolygons(polygon1, polygon2);
 * ```
 */
export function unionPolygons(
  polygon1: Polygon | MultiPolygon,
  polygon2: Polygon | MultiPolygon
): Polygon | MultiPolygon | null {
  try {
    const feature1: PolygonFeature = polygon1.type === 'Polygon'
      ? turfPolygon(polygon1.coordinates)
      : turfMultiPolygon(polygon1.coordinates);
    const feature2: PolygonFeature = polygon2.type === 'Polygon'
      ? turfPolygon(polygon2.coordinates)
      : turfMultiPolygon(polygon2.coordinates);

    const fc: FeatureCollection<GeoJSONPolygon> = {
      type: 'FeatureCollection',
      features: [feature1, feature2] as GeoJSONFeature<GeoJSONPolygon>[],
    };
    const result = turfUnion(fc);
    if (!result) return null;

    return result.geometry as Polygon | MultiPolygon;
  } catch {
    return null;
  }
}

/**
 * Union multiple polygons into a single polygon
 *
 * @param polygons - Array of polygons to merge
 * @returns Merged polygon or multipolygon, or null if union fails
 *
 * @example
 * ```typescript
 * const merged = unionAll([polygon1, polygon2, polygon3]);
 * ```
 */
export function unionAll(
  polygons: (Polygon | MultiPolygon)[]
): Polygon | MultiPolygon | null {
  if (polygons.length === 0) return null;
  if (polygons.length === 1) return polygons[0];

  try {
    const features: PolygonFeature[] = polygons.map(p =>
      p.type === 'Polygon'
        ? turfPolygon(p.coordinates)
        : turfMultiPolygon(p.coordinates)
    );

    const fc: FeatureCollection<GeoJSONPolygon> = {
      type: 'FeatureCollection',
      features: features as GeoJSONFeature<GeoJSONPolygon>[],
    };
    const result = turfUnion(fc);
    if (!result) return null;

    return result.geometry as Polygon | MultiPolygon;
  } catch {
    return null;
  }
}

/**
 * Union polygon features into a single feature
 *
 * @param features - Array of polygon features
 * @returns Merged feature, or null if union fails
 *
 * @example
 * ```typescript
 * const merged = unionFeatures([feature1, feature2]);
 * ```
 */
export function unionFeatures(
  features: Feature<Polygon | MultiPolygon>[]
): Feature<Polygon | MultiPolygon> | null {
  if (features.length === 0) return null;
  if (features.length === 1) return features[0];

  try {
    const turfFeatures: PolygonFeature[] = features.map(f =>
      f.geometry.type === 'Polygon'
        ? turfPolygon(f.geometry.coordinates, f.properties)
        : turfMultiPolygon(f.geometry.coordinates, f.properties)
    );

    const fc: FeatureCollection<GeoJSONPolygon> = {
      type: 'FeatureCollection',
      features: turfFeatures as GeoJSONFeature<GeoJSONPolygon>[],
    };
    const result = turfUnion(fc);
    return result as Feature<Polygon | MultiPolygon> | null;
  } catch {
    return null;
  }
}
