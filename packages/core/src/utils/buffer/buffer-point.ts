import type { LatLon, Polygon } from '../../types';
import {
  DEFAULT_BUFFER_STEPS,
  DEGREES_IN_CIRCLE,
  DEGREES_TO_RADIANS,
  EARTH_RADIUS_METERS,
  LONGITUDE_NORMALIZATION_OFFSET,
  MAX_LONGITUDE,
  RADIANS_TO_DEGREES,
} from '../../constants';

function offsetPoint(point: LatLon, distanceMeters: number, bearingDegrees: number): LatLon {
  const [lat, lon] = point;
  const latRad = lat * DEGREES_TO_RADIANS;
  const lonRad = lon * DEGREES_TO_RADIANS;
  const bearingRad = bearingDegrees * DEGREES_TO_RADIANS;
  const angularDistance = distanceMeters / EARTH_RADIUS_METERS;

  const lat2Rad = Math.asin(
    Math.sin(latRad) * Math.cos(angularDistance) +
      Math.cos(latRad) * Math.sin(angularDistance) * Math.cos(bearingRad),
  );
  const lon2Rad =
    lonRad +
    Math.atan2(
      Math.sin(bearingRad) * Math.sin(angularDistance) * Math.cos(latRad),
      Math.cos(angularDistance) - Math.sin(latRad) * Math.sin(lat2Rad),
    );

  const lat2 = lat2Rad * RADIANS_TO_DEGREES;
  const lon2 =
    ((lon2Rad * RADIANS_TO_DEGREES + LONGITUDE_NORMALIZATION_OFFSET) % DEGREES_IN_CIRCLE) -
    MAX_LONGITUDE;
  return [lat2, lon2];
}

/** Spherical point buffer — no Turf dependency (safe under Vite/Vitest). */
export function bufferPoint(
  point: LatLon,
  radius: number,
  steps: number = DEFAULT_BUFFER_STEPS,
): Polygon {
  const ring: [number, number][] = [];
  for (let i = 0; i <= steps; i += 1) {
    const bearing = (i / steps) * DEGREES_IN_CIRCLE;
    const [lat, lon] = offsetPoint(point, radius, bearing);
    ring.push([lon, lat]);
  }
  return { type: 'Polygon', coordinates: [ring] };
}
