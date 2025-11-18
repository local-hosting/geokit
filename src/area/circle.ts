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
  return circleArea(radius) / 1000000;
}

/**
 * Calculate the area of a circle in square miles
 *
 * @param radius - Circle radius in meters
 * @returns Area in square miles
 */
export function circleAreaMiles(radius: number): number {
  return circleArea(radius) / 2589988.110336;
}
