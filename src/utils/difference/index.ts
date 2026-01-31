/**
 * Polygon difference operations using Turf.js
 * Clips subsequent polygons from the first polygon
 */

import turfDifference from '@turf/difference';
import { polygon as turfPolygon, multiPolygon as turfMultiPolygon } from '@turf/helpers';
import type { Polygon, MultiPolygon, Feature } from '../../types';
import type {
  Feature as GeoJSONFeature,
  Polygon as GeoJSONPolygon,
  MultiPolygon as GeoJSONMultiPolygon,
  FeatureCollection,
  GeoJsonProperties,
} from 'geojson';

type PolygonFeature = GeoJSONFeature<GeoJSONPolygon | GeoJSONMultiPolygon, GeoJsonProperties>;

/**
 * Calculate the difference between two polygons
 * Returns the portion of polygon1 that does not overlap with polygon2
 * Note: Turf.js difference clips all subsequent polygons from the first
 *
 * @param polygon1 - First polygon (the one to subtract from)
 * @param polygon2 - Second polygon (the one to subtract)
 * @returns Resulting polygon or multipolygon, or null if difference fails
 *
 * @example
 * ```typescript
 * const result = differencePolygons(polygon1, polygon2);
 * ```
 */
export function differencePolygons(
  polygon1: Polygon | MultiPolygon,
  polygon2: Polygon | MultiPolygon
): Polygon | MultiPolygon | null {
  try {
    const feature1: PolygonFeature =
      polygon1.type === 'Polygon'
        ? turfPolygon(polygon1.coordinates)
        : turfMultiPolygon(polygon1.coordinates);
    const feature2: PolygonFeature =
      polygon2.type === 'Polygon'
        ? turfPolygon(polygon2.coordinates)
        : turfMultiPolygon(polygon2.coordinates);

    const fc: FeatureCollection<GeoJSONPolygon | GeoJSONMultiPolygon> = {
      type: 'FeatureCollection',
      features: [feature1, feature2] as GeoJSONFeature<GeoJSONPolygon | GeoJSONMultiPolygon>[],
    };

    const result = turfDifference(fc);
    if (!result || !result.geometry) return null;

    return result.geometry as Polygon | MultiPolygon;
  } catch {
    return null;
  }
}

/**
 * Curried difference - subtract a polygon from a base (curried)
 * Useful for composable operations like reduce
 *
 * @param base - Base polygon (the one to subtract from)
 * @returns Curried function that takes polygon to subtract and returns result
 *
 * @example
 * ```typescript
 * const subtractFrom = subtractFrom(basePolygon);
 * const result = subtractFrom(holePolygon);
 *
 * // Or use with reduce to punch multiple holes
 * const result = holes.reduce((acc, hole) => subtractFrom(acc)(hole) ?? acc, basePolygon);
 * ```
 */
export function subtract(base: Polygon | MultiPolygon) {
  return (toSubtract: Polygon | MultiPolygon): Polygon | MultiPolygon | null => {
    return differencePolygons(base, toSubtract);
  };
}

/**
 * Calculate the difference between polygon features
 * Returns the portion of feature1 that does not overlap with feature2
 * Note: Turf.js difference clips all subsequent polygons from the first
 *
 * @param feature1 - First polygon feature (the one to subtract from)
 * @param feature2 - Second polygon feature (the one to subtract)
 * @returns Resulting feature, or null if difference fails
 *
 * @example
 * ```typescript
 * const result = differenceFeatures(feature1, feature2);
 * ```
 */
export function differenceFeatures(
  feature1: Feature<Polygon | MultiPolygon>,
  feature2: Feature<Polygon | MultiPolygon>
): Feature<Polygon | MultiPolygon> | null {
  try {
    const turfFeature1: PolygonFeature =
      feature1.geometry.type === 'Polygon'
        ? turfPolygon(feature1.geometry.coordinates, feature1.properties || {})
        : turfMultiPolygon(feature1.geometry.coordinates, feature1.properties || {});
    const turfFeature2: PolygonFeature =
      feature2.geometry.type === 'Polygon'
        ? turfPolygon(feature2.geometry.coordinates, feature2.properties || {})
        : turfMultiPolygon(feature2.geometry.coordinates, feature2.properties || {});

    const fc: FeatureCollection<GeoJSONPolygon | GeoJSONMultiPolygon> = {
      type: 'FeatureCollection',
      features: [turfFeature1, turfFeature2] as GeoJSONFeature<
        GeoJSONPolygon | GeoJSONMultiPolygon
      >[],
    };

    const result = turfDifference(fc);
    if (!result) return null;

    return result as Feature<Polygon | MultiPolygon>;
  } catch {
    return null;
  }
}
