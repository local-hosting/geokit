import type { Coordinate } from '../../types';

/**
 * Extract coordinate type from various geometry inputs
 */
export type ExtractCoordinate<T> = T extends Coordinate
  ? T
  : T extends { coordinates: infer C }
    ? C extends Coordinate
      ? C
      : never
    : T extends { location: infer L }
      ? L extends Coordinate
        ? L
        : never
      : T extends { lat: number; lon: number }
        ? [T['lat'], T['lon']]
        : T extends { latitude: number; longitude: number }
          ? [T['latitude'], T['longitude']]
          : never;
