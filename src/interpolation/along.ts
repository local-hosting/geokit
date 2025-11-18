import type { LatLon } from '../types';

/**
 * Interpolate a point at a given fraction along the path between two points
 *
 * @param fraction - Fraction along path (0 = start, 1 = end, 0.5 = midpoint)
 * @returns Curried function that takes two points and returns interpolated point
 *
 * @example
 * ```typescript
 * const halfway = interpolate(0.5);
 * const midPoint = halfway([40.7128, -74.0060])([34.0522, -118.2437]);
 * ```
 */
export function interpolate(fraction: number) {
  return (point1: LatLon) => {
    return (point2: LatLon): LatLon => {
      const [lat1, lon1] = point1;
      const [lat2, lon2] = point2;

      const lat1Rad = (lat1 * Math.PI) / 180;
      const lat2Rad = (lat2 * Math.PI) / 180;
      const lon1Rad = (lon1 * Math.PI) / 180;
      const lon2Rad = (lon2 * Math.PI) / 180;

      const d =
        2 *
        Math.asin(
          Math.sqrt(
            Math.pow(Math.sin((lat1Rad - lat2Rad) / 2), 2) +
              Math.cos(lat1Rad) * Math.cos(lat2Rad) * Math.pow(Math.sin((lon1Rad - lon2Rad) / 2), 2)
          )
        );

      const a = Math.sin((1 - fraction) * d) / Math.sin(d);
      const b = Math.sin(fraction * d) / Math.sin(d);

      const x =
        a * Math.cos(lat1Rad) * Math.cos(lon1Rad) + b * Math.cos(lat2Rad) * Math.cos(lon2Rad);
      const y =
        a * Math.cos(lat1Rad) * Math.sin(lon1Rad) + b * Math.cos(lat2Rad) * Math.sin(lon2Rad);
      const z = a * Math.sin(lat1Rad) + b * Math.sin(lat2Rad);

      const lat3Rad = Math.atan2(z, Math.sqrt(x * x + y * y));
      const lon3Rad = Math.atan2(y, x);

      const lat3 = (lat3Rad * 180) / Math.PI;
      const lon3 = (lon3Rad * 180) / Math.PI;

      return [lat3, lon3];
    };
  };
}

/**
 * Interpolate a point at a given distance along the path between two points
 *
 * @param distance - Distance in meters from start point
 * @returns Curried function that takes two points and returns interpolated point
 *
 * @example
 * ```typescript
 * const at1km = interpolateMeters(1000);
 * const pointAt1km = at1km([40.7128, -74.0060])([40.7580, -73.9855]);
 * ```
 */
export function interpolateMeters(distance: number) {
  return (point1: LatLon) => {
    return (point2: LatLon): LatLon => {
      const [lat1, lon1] = point1;
      const [lat2, lon2] = point2;

      // Calculate total distance
      const R = 6371000; // Earth's radius in meters
      const lat1Rad = (lat1 * Math.PI) / 180;
      const lat2Rad = (lat2 * Math.PI) / 180;
      const dLat = ((lat2 - lat1) * Math.PI) / 180;
      const dLon = ((lon2 - lon1) * Math.PI) / 180;

      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1Rad) * Math.cos(lat2Rad) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const totalDistance = R * c;

      // Calculate fraction
      const fraction = Math.min(1, Math.max(0, distance / totalDistance));

      return interpolate(fraction)(point1)(point2);
    };
  };
}
