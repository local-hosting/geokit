import type { LatLon } from '../types';
import {
  EARTH_RADIUS_WGS84_METERS,
  EARTH_RADIUS_WGS84_KM,
  EARTH_RADIUS_WGS84_MILES,
  EARTH_FLATTENING_WGS84,
  DEGREES_TO_RADIANS,
  TWO_PI,
} from '../constants';

/**
 * Vincenty formula for calculating geodesic distance on an ellipsoid
 * More accurate than Haversine for long distances
 *
 * @param radius - Earth's radius in the desired unit (meters, miles, km)
 * @param flattening - Earth's flattening factor (default: WGS-84 ellipsoid)
 * @returns A curried function that takes two points and returns distance
 *
 * @example
 * ```typescript
 * const vincentyM = vincenty(6371000); // meters
 * const distance = vincentyM([40.7128, -74.0060])([40.7580, -73.9855]);
 * ```
 */
export function vincenty(radius: number, flattening: number = EARTH_FLATTENING_WGS84) {
  return (point1: LatLon) => {
    return (point2: LatLon): number => {
      const [lat1, lon1] = point1;
      const [lat2, lon2] = point2;

      const L = (lon2 - lon1) * DEGREES_TO_RADIANS;
      const U1 = Math.atan((1 - flattening) * Math.tan(lat1 * DEGREES_TO_RADIANS));
      const U2 = Math.atan((1 - flattening) * Math.tan(lat2 * DEGREES_TO_RADIANS));

      const sinU1 = Math.sin(U1);
      const cosU1 = Math.cos(U1);
      const sinU2 = Math.sin(U2);
      const cosU2 = Math.cos(U2);

      let lambda = L;
      let lambdaP = TWO_PI;
      let iterLimit = 100;
      let cosSqAlpha = 0;
      let sinSigma = 0;
      let cosSigma = 0;
      let cos2SigmaM = 0;
      let sigma = 0;

      while (Math.abs(lambda - lambdaP) > 1e-12 && --iterLimit > 0) {
        const sinLambda = Math.sin(lambda);
        const cosLambda = Math.cos(lambda);
        sinSigma = Math.sqrt(
          cosU2 * sinLambda * (cosU2 * sinLambda) +
            (cosU1 * sinU2 - sinU1 * cosU2 * cosLambda) *
              (cosU1 * sinU2 - sinU1 * cosU2 * cosLambda)
        );

        if (sinSigma === 0) return 0; // coincident points

        cosSigma = sinU1 * sinU2 + cosU1 * cosU2 * cosLambda;
        sigma = Math.atan2(sinSigma, cosSigma);
        const sinAlpha = (cosU1 * cosU2 * sinLambda) / sinSigma;
        cosSqAlpha = 1 - sinAlpha * sinAlpha;
        cos2SigmaM = cosSigma - (2 * sinU1 * sinU2) / cosSqAlpha;

        if (isNaN(cos2SigmaM)) cos2SigmaM = 0; // equatorial line

        const C = (flattening / 16) * cosSqAlpha * (4 + flattening * (4 - 3 * cosSqAlpha));
        lambdaP = lambda;
        lambda =
          L +
          (1 - C) *
            flattening *
            sinAlpha *
            (sigma +
              C * sinSigma * (cos2SigmaM + C * cosSigma * (-1 + 2 * cos2SigmaM * cos2SigmaM)));
      }

      if (iterLimit === 0) {
        // formula failed to converge, fall back to simple distance
        return 0;
      }

      const uSq = (cosSqAlpha * (radius * radius - radius * radius)) / (radius * radius);
      const A = 1 + (uSq / 16384) * (4096 + uSq * (-768 + uSq * (320 - 175 * uSq)));
      const B = (uSq / 1024) * (256 + uSq * (-128 + uSq * (74 - 47 * uSq)));
      const deltaSigma =
        B *
        sinSigma *
        (cos2SigmaM +
          (B / 4) *
            (cosSigma * (-1 + 2 * cos2SigmaM * cos2SigmaM) -
              (B / 6) *
                cos2SigmaM *
                (-3 + 4 * sinSigma * sinSigma) *
                (-3 + 4 * cos2SigmaM * cos2SigmaM)));

      return radius * A * (sigma - deltaSigma);
    };
  };
}

/**
 * Vincenty distance in meters
 * Pre-configured for calculating distances in meters using WGS-84 ellipsoid
 *
 * @example
 * ```typescript
 * const distance = vincentyMeters([40.7128, -74.0060])([40.7580, -73.9855]);
 * ```
 */
export const vincentyMeters = vincenty(EARTH_RADIUS_WGS84_METERS);

/**
 * Vincenty distance in kilometers
 * Pre-configured for calculating distances in kilometers using WGS-84 ellipsoid
 *
 * @example
 * ```typescript
 * const distance = vincentyKm([40.7128, -74.0060])([40.7580, -73.9855]);
 * ```
 */
export const vincentyKm = vincenty(EARTH_RADIUS_WGS84_KM);

/**
 * Vincenty distance in miles
 * Pre-configured for calculating distances in miles using WGS-84 ellipsoid
 *
 * @example
 * ```typescript
 * const distance = vincentyMiles([40.7128, -74.0060])([40.7580, -73.9855]);
 * ```
 */
export const vincentyMiles = vincenty(EARTH_RADIUS_WGS84_MILES);
