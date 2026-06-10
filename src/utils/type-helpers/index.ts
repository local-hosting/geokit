/**
 * TypeScript Helper Types
 * Improved type inference and developer experience
 */

import type { Coordinate, LatLon, Polygon, Feature, FeatureCollection } from '../../types';
import { haversineMeters, haversineKm, haversineMiles } from '../distance';
import { pointInPolygon } from '../containment';
import type { ExtractCoordinate } from './extract-coordinate';

export type { ExtractCoordinate } from './extract-coordinate';

function toLatLon<T>(data: T): LatLon {
  if (Array.isArray(data) && data.length === 2) {
    return data as LatLon;
  }
  if (typeof data === 'object' && data !== null) {
    if ('coordinates' in data) {
      return (data as { coordinates: LatLon }).coordinates;
    }
    if ('location' in data) {
      return (data as { location: LatLon }).location;
    }
    if ('lat' in data && 'lon' in data) {
      const item = data as { lat: number; lon: number };
      return [item.lat, item.lon];
    }
    if ('latitude' in data && 'longitude' in data) {
      const item = data as { latitude: number; longitude: number };
      return [item.latitude, item.longitude];
    }
  }
  throw new Error('Invalid coordinate input');
}

/**
 * Fluent API builder for common geospatial operations
 */
export class GeoQuery<T = Coordinate> {
  constructor(private data: T) {}

  /**
   * Calculate distance to another point
   */
  distanceTo<U>(other: U): GeoQuery<number> & {
    meters(): number;
    kilometers(): number;
    miles(): number;
  } {
    const from = toLatLon(this.data);
    const to = toLatLon(other);
    const meters = haversineMeters(from)(to);
    const result = new GeoQuery(meters) as GeoQuery<number> & {
      meters(): number;
      kilometers(): number;
      miles(): number;
    };
    result.meters = () => meters;
    result.kilometers = () => haversineKm(from)(to);
    result.miles = () => haversineMiles(from)(to);
    return result;
  }

  /**
   * Find points within radius (meters)
   */
  within<U>(radiusMeters: number, points: U[]): GeoQuery<U[]> {
    const center = toLatLon(this.data);
    const withinRadius = points.filter(
      (point) => haversineMeters(center)(toLatLon(point)) <= radiusMeters
    );
    return new GeoQuery(withinRadius);
  }

  /**
   * Check if point is inside polygon
   */
  isInside(polygon: Polygon): GeoQuery<boolean> {
    const center = toLatLon(this.data);
    return new GeoQuery(pointInPolygon(center)(polygon));
  }

  /**
   * Get the underlying value
   */
  value(): T {
    return this.data;
  }
}

/**
 * Fluent API entry point
 */
export function geo<T>(data: T): GeoQuery<ExtractCoordinate<T>> {
  return new GeoQuery(toLatLon(data)) as GeoQuery<ExtractCoordinate<T>>;
}

/**
 * Type-safe coordinate validation
 */
export type ValidCoordinate<T> = T extends [number, number]
  ? T[0] extends number
    ? T[1] extends number
      ? T
      : never
    : never
  : never;

/**
 * Utility type for ensuring valid coordinates at compile time
 */
export function validateCoordinate<T extends [number, number]>(
  coord: ValidCoordinate<T>
): ValidCoordinate<T> {
  return coord;
}

type GeoItem = {
  coordinates?: LatLon;
  location?: LatLon;
  lat?: number;
  lon?: number;
  distance?: number;
};

function itemLatLon(item: GeoItem): LatLon | null {
  try {
    return toLatLon(item);
  } catch {
    return null;
  }
}

/**
 * Builder pattern for complex geospatial queries
 */
export class GeospatialQueryBuilder {
  private filters: Array<(item: GeoItem) => boolean> = [];
  private transforms: Array<(items: GeoItem[]) => GeoItem[]> = [];

  /**
   * Filter by distance from a point
   */
  withinDistance(center: Coordinate, maxDistanceMeters: number): this {
    const origin = toLatLon(center);
    this.filters.push((item) => {
      const point = itemLatLon(item);
      if (!point) return false;
      return haversineMeters(origin)(point) <= maxDistanceMeters;
    });
    return this;
  }

  /**
   * Filter by polygon containment
   */
  withinPolygon(polygon: Polygon): this {
    this.filters.push((item) => {
      const point = itemLatLon(item);
      if (!point) return false;
      return pointInPolygon(point)(polygon);
    });
    return this;
  }

  /**
   * Add distance property to results
   */
  addDistance(center: Coordinate): this {
    const origin = toLatLon(center);
    this.transforms.push((items) =>
      items.map((item) => {
        const point = itemLatLon(item);
        return {
          ...item,
          distance: point ? haversineMeters(origin)(point) : undefined,
        };
      })
    );
    return this;
  }

  /**
   * Sort by distance
   */
  sortByDistance(): this {
    this.transforms.push((items) =>
      [...items].sort((a, b) => (Number(a.distance) || 0) - (Number(b.distance) || 0))
    );
    return this;
  }

  /**
   * Limit results
   */
  limit(count: number): this {
    this.transforms.push((items) => items.slice(0, count));
    return this;
  }

  /**
   * Execute the query
   */
  execute<T extends GeoItem>(data: T[]): T[] {
    let result = data.filter((item) => this.filters.every((filter) => filter(item)));

    for (const transform of this.transforms) {
      result = transform(result) as T[];
    }

    return result;
  }
}

/**
 * Create a new geospatial query builder
 */
export function createQuery(): GeospatialQueryBuilder {
  return new GeospatialQueryBuilder();
}

export type { Coordinate, Polygon, Feature, FeatureCollection };
