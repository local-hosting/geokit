/**
 * Calculate the total length of a line or polyline using Turf.js
 */

import turfLength from '@turf/length';
import { lineString } from '@turf/helpers';
import type { LatLon, LonLat, LineString } from '../types';
import { haversine } from '../distance/haversine';
import { EARTH_RADIUS_METERS, METERS_TO_KILOMETERS, METERS_TO_MILES } from '../constants';
import { toLonLatArray } from '../turf-utils';

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
 * Normalize coordinates to LatLon format for internal calculations
 * Accepts both [lat, lon] and [lon, lat] formats
 * Uses same detection logic as extractCoordinates
 */
function normalizeToLatLon(coords: LatLon[] | LonLat[]): LatLon[] {
  if (!coords || coords.length === 0) {
    return [];
  }

  return coords
    .map((coord) => {
      if (!Array.isArray(coord) || coord.length < 2) {
        return null;
      }

      const [first, second] = coord;

      // If first value is outside valid latitude range (-90 to 90), it must be longitude
      // So convert from [lon, lat] to [lat, lon]
      if (Math.abs(first) > 90) {
        return [second, first] as LatLon;
      }

      // If second value is outside valid latitude range, first must be latitude
      // Already in [lat, lon] format
      if (Math.abs(second) > 90) {
        return [first, second] as LatLon;
      }

      // Special case: if first value is exactly 90 or -90, it's definitely latitude
      if (Math.abs(first) === 90) {
        return [first, second] as LatLon;
      }

      // If both values are within latitude range, use a heuristic:
      // If first value has larger absolute value AND it's not a pole, it's more likely to be longitude
      // (as most populated areas are closer to the equator)
      if (Math.abs(first) > Math.abs(second) && Math.abs(first) < 90) {
        return [second, first] as LatLon;
      }

      // Otherwise assume it's already in [lat, lon] format
      return [first, second] as LatLon;
    })
    .filter((coord): coord is LatLon => coord !== null);
}

/**
 * Calculate the total length of a polyline in meters
 * Uses Turf.js for robust length calculation
 * Accepts coordinates in both [lat, lon] and [lon, lat] (GeoJSON) formats, or a LineString
 *
 * @param input - Array of coordinates as [lat, lon] or [lon, lat], or a LineString geometry
 * @returns Total length in meters
 *
 * @example
 * // Using [lat, lon] format
 * const polyline = [[40.7128, -74.006], [40.758, -73.9855]];
 * const length = lineLengthMeters(polyline);
 *
 * // Using [lon, lat] GeoJSON format
 * const geoJsonLine = [[-74.006, 40.7128], [-73.9855, 40.758]];
 * const length2 = lineLengthMeters(geoJsonLine);
 *
 * // Using LineString geometry
 * const lineString = { type: 'LineString', coordinates: [[-74.006, 40.7128], [-73.9855, 40.758]] };
 * const length3 = lineLengthMeters(lineString);
 */
export function lineLengthMeters(input: LatLon[] | LonLat[] | LineString): number {
  let coordinates: LonLat[];

  // Handle LineString geometry
  if (
    typeof input === 'object' &&
    'type' in input &&
    input.type === 'LineString' &&
    'coordinates' in input
  ) {
    coordinates = input.coordinates as LonLat[];
  } else if (Array.isArray(input)) {
    if (input.length < 2) {
      return 0;
    }

    // Normalize to [lat, lon] for internal processing
    const latLonCoords = normalizeToLatLon(input as LatLon[] | LonLat[]);
    if (latLonCoords.length < 2) {
      return 0;
    }

    // Convert to [lon, lat] for Turf
    coordinates = toLonLatArray(latLonCoords);
  } else {
    return 0;
  }

  if (coordinates.length < 2) {
    return 0;
  }

  try {
    const line = lineString(coordinates);
    // Turf returns length in meters when units: 'meters' is specified
    const length = turfLength(line, { units: 'meters' });
    if (typeof length === 'number' && !isNaN(length) && isFinite(length)) {
      return length;
    }
  } catch {
    // Fall through to fallback
  }

  // Fallback to custom implementation
  // Convert back to [lat, lon] for haversine
  const latLonCoords = coordinates.map(([lon, lat]) => [lat, lon] as LatLon);
  const calculateLength = lineLength(haversine(EARTH_RADIUS_METERS));
  return calculateLength(latLonCoords);
}

/**
 * Calculate the total length of a polyline in kilometers
 * Accepts coordinates in both [lat, lon] and [lon, lat] (GeoJSON) formats, or a LineString
 *
 * @param input - Array of coordinates as [lat, lon] or [lon, lat], or a LineString geometry
 * @returns Total length in kilometers
 *
 * @example
 * const polyline = [[40.7128, -74.006], [40.758, -73.9855]];
 * const length = lineLengthKm(polyline);
 * // ~5 km
 */
export function lineLengthKm(input: LatLon[] | LonLat[] | LineString): number {
  return lineLengthMeters(input) / METERS_TO_KILOMETERS;
}

/**
 * Calculate the total length of a polyline in miles
 * Accepts coordinates in both [lat, lon] and [lon, lat] (GeoJSON) formats, or a LineString
 *
 * @param input - Array of coordinates as [lat, lon] or [lon, lat], or a LineString geometry
 * @returns Total length in miles
 *
 * @example
 * const polyline = [[40.7128, -74.006], [40.758, -73.9855]];
 * const length = lineLengthMiles(polyline);
 * // ~3.1 miles
 */
export function lineLengthMiles(input: LatLon[] | LonLat[] | LineString): number {
  return lineLengthMeters(input) / METERS_TO_MILES;
}
