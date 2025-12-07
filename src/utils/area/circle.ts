import { SQUARE_METERS_TO_SQUARE_KILOMETERS, SQUARE_METERS_TO_SQUARE_MILES } from '../constants';

/**
 * Calculate the area of a circle given its radius
 *
 * @param radius - Circle radius in meters
 * @returns Area in square meters
 *
 * @example
 * ```typescript
 * const area = circleArea(1000); // Area of 1km radius circle in square meters
 * ```
 */
export function circleArea(radius: number): number {
  return Math.PI * radius * radius;
}

/**
 * Calculate the area of a circle in square kilometers
 *
 * @param radius - Circle radius in meters
 * @returns Area in square kilometers
 */
export function circleAreaKm(radius: number): number {
  return circleArea(radius) / SQUARE_METERS_TO_SQUARE_KILOMETERS;
}

/**
 * Calculate the area of a circle in square miles
 *
 * @param radius - Circle radius in meters
 * @returns Area in square miles
 */
export function circleAreaMiles(radius: number): number {
  return circleArea(radius) / SQUARE_METERS_TO_SQUARE_MILES;
}
