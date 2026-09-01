import { SECONDS_PER_MINUTE, SECONDS_PER_DEGREE } from '../../constants';

/**
 * Degrees Minutes Seconds format
 */
export interface DMS {
  degrees: number;
  minutes: number;
  seconds: number;
  direction: 'N' | 'S' | 'E' | 'W';
}

/**
 * Convert decimal degrees to Degrees Minutes Seconds format
 *
 * @param decimal - Decimal degrees
 * @param isLongitude - True for longitude, false for latitude
 * @returns DMS object
 *
 * @example
 * ```typescript
 * const dms = toDMS(40.7128, false); // Latitude
 * // { degrees: 40, minutes: 42, seconds: 46.08, direction: 'N' }
 * ```
 */
export function toDMS(decimal: number, isLongitude: boolean = false): DMS {
  const absolute = Math.abs(decimal);
  const degrees = Math.floor(absolute);
  const minutesDecimal = (absolute - degrees) * SECONDS_PER_MINUTE;
  const minutes = Math.floor(minutesDecimal);
  const seconds = (minutesDecimal - minutes) * SECONDS_PER_MINUTE;

  let direction: 'N' | 'S' | 'E' | 'W';
  if (isLongitude) {
    direction = decimal >= 0 ? 'E' : 'W';
  } else {
    direction = decimal >= 0 ? 'N' : 'S';
  }

  return { degrees, minutes, seconds, direction };
}

/**
 * Convert Degrees Minutes Seconds to decimal degrees
 *
 * @param dms - DMS object
 * @returns Decimal degrees
 *
 * @example
 * ```typescript
 * const decimal = fromDMS({ degrees: 40, minutes: 42, seconds: 46.08, direction: 'N' });
 * // 40.7128
 * ```
 */
export function fromDMS(dms: DMS): number {
  const { degrees, minutes, seconds, direction } = dms;
  let decimal = degrees + minutes / SECONDS_PER_MINUTE + seconds / SECONDS_PER_DEGREE;

  if (direction === 'S' || direction === 'W') {
    decimal = -decimal;
  }

  return decimal;
}

/**
 * Convert decimal coordinate pair to DMS format
 *
 * @param lat - Latitude in decimal degrees
 * @param lon - Longitude in decimal degrees
 * @returns Object with latitude and longitude in DMS format
 *
 * @example
 * ```typescript
 * const dms = coordinatesToDMS(40.7128, -74.0060);
 * // {
 * //   latitude: { degrees: 40, minutes: 42, seconds: 46.08, direction: 'N' },
 * //   longitude: { degrees: 74, minutes: 0, seconds: 21.6, direction: 'W' }
 * // }
 * ```
 */
export function coordinatesToDMS(lat: number, lon: number): { latitude: DMS; longitude: DMS } {
  return {
    latitude: toDMS(lat, false),
    longitude: toDMS(lon, true),
  };
}

/**
 * Format DMS as a string
 *
 * @param dms - DMS object
 * @returns Formatted string
 *
 * @example
 * ```typescript
 * const str = formatDMS({ degrees: 40, minutes: 42, seconds: 46.08, direction: 'N' });
 * // "40° 42' 46.08\" N"
 * ```
 */
export function formatDMS(dms: DMS): string {
  const { degrees, minutes, seconds, direction } = dms;
  return `${degrees}° ${minutes}' ${seconds.toFixed(2)}" ${direction}`;
}
