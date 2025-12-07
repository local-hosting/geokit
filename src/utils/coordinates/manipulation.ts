import type { Geometry, Position } from '../types';

/**
 * Round coordinates in a GeoJSON geometry to specified decimal places
 * Useful for reducing file size and handling precision issues
 *
 * @param geometry - GeoJSON Geometry to round
 * @param precision - Number of decimal places (default: 6)
 * @returns New geometry with rounded coordinates
 *
 * @example
 * ```typescript
 * const point = { type: 'Point', coordinates: [-74.0060123456, 40.7128123456] };
 * const rounded = roundGeometry(point, 6);
 * // { type: 'Point', coordinates: [-74.006012, 40.712812] }
 * ```
 */
export function roundGeometry(geometry: Geometry, precision: number = 6): Geometry {
  if (!geometry || !('coordinates' in geometry)) {
    return geometry;
  }

  const roundCoordArray = (coords: unknown): unknown => {
    if (Array.isArray(coords)) {
      if (typeof coords[0] === 'number') {
        // Single coordinate [lon, lat] or [lon, lat, elev]
        if (coords.length === 2) {
          return [roundCoordinate(coords[0], precision), roundCoordinate(coords[1], precision)];
        } else if (coords.length === 3) {
          return [
            roundCoordinate(coords[0], precision),
            roundCoordinate(coords[1], precision),
            coords[2],
          ];
        }
        return coords;
      } else {
        // Array of coordinates - recurse
        return coords.map(roundCoordArray);
      }
    }
    return coords;
  };

  const roundedCoords = roundCoordArray(geometry.coordinates);
  return {
    ...geometry,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    coordinates: roundedCoords as any,
  } as Geometry;
}

/**
 * Round a single coordinate value to specified decimal places
 * Useful for reducing file size and handling precision issues
 *
 * @param coord - Coordinate value to round
 * @param precision - Number of decimal places (default: 6)
 * @returns Rounded coordinate value
 *
 * @example
 * ```typescript
 * const rounded = roundCoordinate(40.7128123456, 6);
 * // 40.712812
 * ```
 */
export function roundCoordinate(coord: number, precision: number = 6): number {
  return Math.round(coord * Math.pow(10, precision)) / Math.pow(10, precision);
}

/**
 * @deprecated Use roundCoordinate instead
 * @see roundCoordinate
 */
export const roundCoord = roundCoordinate;

/**
 * @deprecated Use roundGeometry instead
 * @see roundGeometry
 */
export const roundCoordinates = roundGeometry;

/**
 * Remove duplicate consecutive coordinates from a coordinate array
 * Useful for cleaning up redundant points in geometries
 *
 * @param coordinates - Coordinate array (can be nested for polygons, etc.)
 * @param closeRings - Whether to ensure polygon rings are closed (default: true)
 * @returns Cleaned coordinate array with duplicates removed
 *
 * @example
 * ```typescript
 * const coords = [[0, 0], [1, 1], [1, 1], [2, 2], [2, 2]];
 * const cleaned = removeDuplicateCoordinates(coords);
 * // [[0, 0], [1, 1], [2, 2]]
 * ```
 */
export function removeDuplicateCoordinates(
  coordinates: unknown,
  closeRings: boolean = true
): unknown {
  // Handle single coordinate (Point)
  if (Array.isArray(coordinates) && typeof coordinates[0] === 'number') {
    return coordinates;
  }

  // Handle array of coordinates (LineString, Polygon ring, etc.)
  if (Array.isArray(coordinates)) {
    if (Array.isArray(coordinates[0]) && typeof coordinates[0][0] === 'number') {
      // This is an array of Position arrays (e.g., LineString or Polygon ring)
      const cleaned: Position[] = [];
      let lastCoord: Position | null = null;

      for (const coord of coordinates as Position[]) {
        if (lastCoord === null || coord[0] !== lastCoord[0] || coord[1] !== lastCoord[1]) {
          cleaned.push(coord);
          lastCoord = coord;
        }
      }

      // Ensure polygon rings are closed if requested
      if (closeRings && cleaned.length > 0) {
        const first = cleaned[0];
        const last = cleaned[cleaned.length - 1];

        const isClosed =
          Math.abs(first[0] - last[0]) < 1e-10 && Math.abs(first[1] - last[1]) < 1e-10;

        if (!isClosed) {
          cleaned.push([first[0], first[1], ...(first.length > 2 ? [first[2]] : [])] as Position);
        }
      }

      return cleaned;
    } else {
      // Nested arrays (MultiLineString, MultiPolygon, etc.) - recurse
      return coordinates.map((coord) => removeDuplicateCoordinates(coord, closeRings));
    }
  }

  return coordinates;
}

/**
 * Remove duplicate coordinates from a geometry
 * Applies removeDuplicateCoordinates to the geometry's coordinate structure
 *
 * @param geometry - GeoJSON Geometry
 * @param closeRings - Whether to ensure polygon rings are closed (default: true)
 * @returns New geometry with duplicate coordinates removed
 *
 * @example
 * ```typescript
 * const polygon = {
 *   type: 'Polygon',
 *   coordinates: [[[0, 0], [1, 1], [1, 1], [2, 2], [0, 0]]]
 * };
 * const cleaned = removeDuplicateCoordinatesFromGeometry(polygon);
 * ```
 */
export function removeDuplicateCoordinatesFromGeometry(
  geometry: Geometry,
  closeRings: boolean = true
): Geometry {
  if (!geometry || !('coordinates' in geometry)) {
    return geometry;
  }

  const cleanedCoords = removeDuplicateCoordinates(geometry.coordinates, closeRings);
  return {
    ...geometry,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    coordinates: cleanedCoords as any,
  } as Geometry;
}
