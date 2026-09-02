/**
 * Isochrone H3 conversion (Single Responsibility: polygon → H3 hexagons)
 */

import { polygonToH3, h3SetToMultiPolygon } from '@twinfile/geokit/h3';
import type { Polygon } from '@twinfile/geokit/core/types';

export interface ConvertToH3Options {
  /** Fill color for converted features */
  color: string;
  /** Fill opacity */
  opacity: number;
}

/**
 * Convert isochrone polygon features to H3 hexagons and merge into MultiPolygon.
 * Pure function: no side effects, no element reference.
 */
export function convertToH3(
  featureCollection: GeoJSON.FeatureCollection,
  resolution: number,
  options: ConvertToH3Options
): GeoJSON.FeatureCollection {
  const { color, opacity } = options;
  const processedFeatures: GeoJSON.Feature[] = [];

  for (const feature of featureCollection.features) {
    if (feature.geometry.type !== 'Polygon') {
      processedFeatures.push(feature);
      continue;
    }

    const polygon = feature.geometry as Polygon;
    const fillColor = feature.properties?.fill || feature.properties?.color || color;
    const contour = feature.properties?.contour;

    try {
      const hexagons = polygonToH3(polygon, resolution);

      if (hexagons.length === 0) {
        processedFeatures.push(feature);
        continue;
      }

      const sortedHexagons = [...hexagons].sort();
      const mergedGeometry = h3SetToMultiPolygon(sortedHexagons);

      if (
        !mergedGeometry ||
        !mergedGeometry.coordinates ||
        mergedGeometry.coordinates.length === 0
      ) {
        processedFeatures.push(feature);
        continue;
      }

      processedFeatures.push({
        type: 'Feature',
        geometry: mergedGeometry as GeoJSON.MultiPolygon,
        properties: {
          ...feature.properties,
          contour,
          color: fillColor,
          fill: fillColor,
          'fill-opacity': opacity,
        },
      });
    } catch {
      processedFeatures.push(feature);
    }
  }

  return {
    type: 'FeatureCollection',
    features: processedFeatures,
  };
}
