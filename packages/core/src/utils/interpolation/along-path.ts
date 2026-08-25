

import type { LatLon, LineString, LonLat, Polyline } from '../../types';
import { METERS_TO_KILOMETERS } from '../../constants';
import { detectAndConvertCoordinateFormat } from '../coordinates/extraction';
import { toLonLatArray } from '../coordinates/conversion';
import { lineLengthMeters } from '../length';
import { extractLatLon } from '../turf-utils';
import { lineString, turfAlong } from '../turf/deps';

function normalizePolyline(polyline: Polyline | LonLat[]): LatLon[] | null {
  if (!polyline || polyline.length === 0) {
    return null;
  }

  const normalized = polyline
    .map((coord) => {
      if (!Array.isArray(coord) || coord.length < 2) {
        return null;
      }
      return detectAndConvertCoordinateFormat([coord[0], coord[1]]);
    })
    .filter((coord): coord is LatLon => coord !== null);

  return normalized.length > 0 ? normalized : null;
}

function resolvePolyline(polyline: Polyline | LonLat[] | LineString): LatLon[] | null {
  if (typeof polyline === 'object' && 'type' in polyline && polyline.type === 'LineString') {
    return normalizePolyline(polyline.coordinates as LonLat[]);
  }

  return normalizePolyline(polyline as Polyline | LonLat[]);
}

/**
 * Interpolate a point at a given fraction along a polyline path.
 * Accepts [lat, lon] or GeoJSON [lon, lat] vertices.
 *
 * @param fraction - Progress along the path (0 = start, 1 = end)
 * @returns Function that takes a polyline and returns the interpolated [lat, lon] point
 */
export function interpolateAlongPath(fraction: number) {
  return (polyline: Polyline | LonLat[] | LineString): LatLon | null => {
    const latLon = resolvePolyline(polyline);
    if (!latLon || latLon.length === 0) {
      return null;
    }

    const clamped = Math.max(0, Math.min(1, fraction));

    if (latLon.length === 1 || clamped === 0) {
      return latLon[0];
    }

    if (clamped === 1) {
      return latLon[latLon.length - 1];
    }

    try {
      const line = lineString(toLonLatArray(latLon));
      const totalMeters = lineLengthMeters(latLon);
      const distanceMeters = totalMeters * clamped;
      const interpolated = turfAlong(line, distanceMeters / METERS_TO_KILOMETERS, {
        units: 'kilometers',
      });
      const result = extractLatLon(interpolated);
      if (result) {
        return result;
      }
    } catch {
      // Fall through to index-based fallback
    }

    const pathIndex = clamped * (latLon.length - 1);
    const segmentIndex = Math.min(Math.floor(pathIndex), latLon.length - 2);
    const segmentProgress = pathIndex - segmentIndex;
    const start = latLon[segmentIndex];
    const end = latLon[segmentIndex + 1];

    return [
      start[0] + (end[0] - start[0]) * segmentProgress,
      start[1] + (end[1] - start[1]) * segmentProgress,
    ];
  };
}
