/**
 * Calculate the total length of a line or polyline using Turf.js
 */

import turfLength from '@turf/length';
import { lineString } from '@turf/helpers';
import type { LatLon } from '../types';
import { haversine } from '../distance/haversine';
import { EARTH_RADIUS_METERS, METERS_TO_KILOMETERS, METERS_TO_MILES } from '../constants';

/**
 * Calculate the total length of a polyline using a custom distance function
 *
 * @param distanceFn - Distance function to use (e.g., haversine with radius)
 * @returns Function that takes an array of coordinates and returns total length
 *
 * @example
 * const calculateLength = lineLength(haversine(6371000)); // meters
 * const polyline = [[40.7128, -74.006], [40.758, -73.9855], [40.7354, -73.99575]];
 * const length = calculateLength(polyline);
 */
export function lineLength(
  distanceFn: (point1: LatLon) => (point2: LatLon) => number
): (coordinates: LatLon[]) => number {
  return (coordinates: LatLon[]): number => {
    if (!coordinates || coordinates.length < 2) {
      return 0;
    }

    let totalLength = 0;

    for (let i = 0; i < coordinates.length - 1; i++) {
      const distance = distanceFn(coordinates[i])(coordinates[i + 1]);
      totalLength += distance;
    }

    return totalLength;
  };
}

/**
 * Calculate the total length of a polyline in meters
 * Uses Turf.js for robust length calculation
 *
 * @param coordinates - Array of coordinates as [lat, lon]
 * @returns Total length in meters
 *
 * @example
 * const polyline = [[40.7128, -74.006], [40.758, -73.9855]];
 * const length = lineLengthMeters(polyline);
 * // ~5000 meters
 */
export function lineLengthMeters(coordinates: LatLon[]): number {
  if (!coordinates || coordinates.length < 2) {
    return 0;
  }

  try {
    // Convert from [lat, lon] to [lon, lat] for Turf
    const coords = coordinates.map(([lat, lon]) => [lon, lat]);
    const line = lineString(coords);
    // Turf returns length in meters when units: 'meters' is specified
    const length = turfLength(line, { units: 'meters' });
    if (typeof length === 'number' && !isNaN(length) && isFinite(length)) {
      return length;
    }
  } catch {
    // Fall through to fallback
  }

  // Fallback to custom implementation
  const calculateLength = lineLength(haversine(EARTH_RADIUS_METERS));
  return calculateLength(coordinates);
}

/**
 * Calculate the total length of a polyline in kilometers
 *
 * @param coordinates - Array of coordinates as [lat, lon]
 * @returns Total length in kilometers
 *
 * @example
 * const polyline = [[40.7128, -74.006], [40.758, -73.9855]];
 * const length = lineLengthKm(polyline);
 * // ~5 km
 */
export function lineLengthKm(coordinates: LatLon[]): number {
  return lineLengthMeters(coordinates) / METERS_TO_KILOMETERS;
}

/**
 * Calculate the total length of a polyline in miles
 *
 * @param coordinates - Array of coordinates as [lat, lon]
 * @returns Total length in miles
 *
 * @example
 * const polyline = [[40.7128, -74.006], [40.758, -73.9855]];
 * const length = lineLengthMiles(polyline);
 * // ~3.1 miles
 */
export function lineLengthMiles(coordinates: LatLon[]): number {
  return lineLengthMeters(coordinates) / METERS_TO_MILES;
}
