

import type { LatLon, Polyline } from '../../types';
import { createLineString, createPointFeature } from '../turf-utils';
import { toLonLatArray } from '../coordinates/conversion';
import { lineString, pointToLineDistanceTurf } from '../turf/deps';

export type PointToLineDistanceUnits = 'meters' | 'kilometers' | 'miles' | 'degrees';

export type PointToLineDistanceOptions = {
  units?: PointToLineDistanceUnits;
};

/**
 * Shortest distance from a point to a line segment (Turf point-to-line-distance).
 *
 * @param point - Point in [lat, lon] format
 * @returns Curried function: lineStart → lineEnd → distance in chosen units
 */
export function pointToLineDistance(point: LatLon, options: PointToLineDistanceOptions = {}) {
  const units = options.units ?? 'meters';

  return (lineStart: LatLon) => {
    return (lineEnd: LatLon): number => {
      try {
        const pt = createPointFeature(point);
        const line = createLineString(lineStart, lineEnd);
        return pointToLineDistanceTurf(pt, line, { units });
      } catch {
        return Number.POSITIVE_INFINITY;
      }
    };
  };
}

/** Distance from point to line segment in meters. */
export function pointToLineDistanceMeters(point: LatLon) {
  return pointToLineDistance(point, { units: 'meters' });
}

/** Minimum distance from a point to any segment of a polyline (meters). */
export function pointToPolylineDistanceMeters(point: LatLon, polyline: Polyline): number {
  if (polyline.length < 2) {
    return Number.POSITIVE_INFINITY;
  }

  try {
    const pt = createPointFeature(point);
    const line = lineString(toLonLatArray(polyline));
    return pointToLineDistanceTurf(pt, line, { units: 'meters' });
  } catch {
    let min = Number.POSITIVE_INFINITY;
    const measure = pointToLineDistanceMeters(point);
    for (let i = 0; i < polyline.length - 1; i++) {
      min = Math.min(min, measure(polyline[i])(polyline[i + 1]));
    }
    return min;
  }
}
