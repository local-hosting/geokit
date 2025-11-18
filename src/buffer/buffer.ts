/**
 * Create buffer zones around geometries
 * Uses Turf.js buffer internally for robust buffering
 */

import turfBuffer from '@turf/buffer';
import {
  point as turfPoint,
  lineString as turfLineString,
  polygon as turfPolygon,
} from '@turf/helpers';
import type { LatLon, Polygon } from '../types';
import { DEFAULT_BUFFER_STEPS, METERS_TO_KILOMETERS } from '../constants';

/**
 * Create a buffer zone around a point
 * Returns a circular polygon approximation
 *
 * @param point - Point as [lat, lon]
 * @param radius - Buffer radius in meters
 * @param steps - Number of steps for polygon approximation (default: 64)
 * @returns Buffer polygon
 *
 * @example
 * const point = [40.7128, -74.006];
 * const buffer = bufferPoint(point, 1000); // 1km buffer
 */
export function bufferPoint(
  point: LatLon,
  radius: number,
  steps: number = DEFAULT_BUFFER_STEPS
): Polygon {
  const [lat, lon] = point;
  const pt = turfPoint([lon, lat]);
  const buffered = turfBuffer(pt, radius / METERS_TO_KILOMETERS, { units: 'kilometers', steps });

  if (!buffered || buffered.geometry.type !== 'Polygon') {
    throw new Error('Failed to create buffer');
  }

  return buffered.geometry;
}

/**
 * Create a buffer zone around a line
 *
 * @param coordinates - Array of coordinates as [lat, lon]
 * @param radius - Buffer radius in meters
 * @param steps - Number of steps for polygon approximation (default: 64)
 * @returns Buffer polygon
 *
 * @example
 * const line = [[40.7128, -74.006], [40.758, -73.9855]];
 * const buffer = bufferLine(line, 500); // 500m buffer
 */
export function bufferLine(
  coordinates: LatLon[],
  radius: number,
  steps: number = DEFAULT_BUFFER_STEPS
): Polygon {
  if (coordinates.length < 2) {
    throw new Error('Line must have at least 2 coordinates');
  }

  // Convert to GeoJSON [lon, lat] format
  const coords = coordinates.map(([lat, lon]) => [lon, lat]);
  const line = turfLineString(coords);
  const buffered = turfBuffer(line, radius / METERS_TO_KILOMETERS, { units: 'kilometers', steps });

  if (!buffered || buffered.geometry.type !== 'Polygon') {
    throw new Error('Failed to create buffer');
  }

  return buffered.geometry;
}

/**
 * Create a buffer zone around a polygon
 *
 * @param polygon - Polygon to buffer
 * @param radius - Buffer radius in meters (positive for expansion, negative for contraction)
 * @param steps - Number of steps for polygon approximation (default: 64)
 * @returns Buffer polygon
 *
 * @example
 * const polygon = {
 *   type: 'Polygon',
 *   coordinates: [
 *     [
 *       [-74.01, 40.7],
 *       [-74.0, 40.7],
 *       [-74.0, 40.71],
 *       [-74.01, 40.71],
 *       [-74.01, 40.7]
 *     ]
 *   ]
 * };
 * const buffer = bufferPolygon(polygon, 100); // 100m buffer
 */
export function bufferPolygon(
  polygon: Polygon,
  radius: number,
  steps: number = DEFAULT_BUFFER_STEPS
): Polygon {
  const poly = turfPolygon(polygon.coordinates);
  const buffered = turfBuffer(poly, radius / METERS_TO_KILOMETERS, { units: 'kilometers', steps });

  if (!buffered || buffered.geometry.type !== 'Polygon') {
    throw new Error('Failed to create buffer');
  }

  return buffered.geometry;
}

/**
 * Generic buffer function that works with points, lines, or polygons
 * Curried version for functional composition
 *
 * @param radius - Buffer radius in meters
 * @param steps - Number of steps for polygon approximation (default: 64)
 * @returns Function that takes a geometry and returns buffered polygon
 *
 * @example
 * const buffer1km = buffer(1000);
 * const buffered = buffer1km([40.7128, -74.006]);
 */
export function buffer(
  radius: number,
  steps: number = DEFAULT_BUFFER_STEPS
): (input: LatLon | LatLon[] | Polygon) => Polygon {
  return (input: LatLon | LatLon[] | Polygon): Polygon => {
    // Check if it's a polygon
    if (typeof input === 'object' && 'type' in input && input.type === 'Polygon') {
      return bufferPolygon(input, radius, steps);
    }

    // Check if it's an array of coordinates (line)
    if (Array.isArray(input) && input.length > 0 && Array.isArray(input[0])) {
      return bufferLine(input as LatLon[], radius, steps);
    }

    // It's a point
    return bufferPoint(input as LatLon, radius, steps);
  };
}
