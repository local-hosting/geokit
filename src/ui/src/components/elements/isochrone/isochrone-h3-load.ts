/**
 * Lazy loader for isochrone → H3 conversion (pulls @doppler-group/geokit/h3 / h3-js only when render="h3").
 */

import type { ConvertToH3Options } from './isochrone-h3';

type ConvertToH3Fn = (
  featureCollection: GeoJSON.FeatureCollection,
  resolution: number,
  options: ConvertToH3Options
) => GeoJSON.FeatureCollection;

let convertToH3Fn: ConvertToH3Fn | null = null;

export async function convertIsochroneToH3(
  featureCollection: GeoJSON.FeatureCollection,
  resolution: number,
  options: ConvertToH3Options
): Promise<GeoJSON.FeatureCollection> {
  if (!convertToH3Fn) {
    const mod = await import('./isochrone-h3');
    convertToH3Fn = mod.convertToH3;
  }
  return convertToH3Fn(featureCollection, resolution, options);
}
