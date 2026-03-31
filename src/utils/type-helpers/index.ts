/**
 * TypeScript Helper Types
 * Improved type inference and developer experience
 */

import type { Coordinate, Polygon, Feature, FeatureCollection } from '../../types';

/**
 * Extract coordinate type from various geometry inputs
 */
export type ExtractCoordinate<T> = 
  T extends Coordinate ? T :
  T extends { coordinates: infer C } ? C extends Coordinate ? C : never :
  T extends { location: infer L } ? L extends Coordinate ? L : never :
  T extends { lat: number; lon: number } ? [T['lat'], T['lon']] :
  T extends { latitude: number; longitude: number } ? [T['latitude'], T['longitude']] :
  never;

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
    // Implementation would use the actual distance functions
    const result = new GeoQuery(0) as any;
    result.meters = () => 0; // Placeholder
    result.kilometers = () => 0;
    result.miles = () => 0;
    return result;
  }

  /**
   * Find points within radius
   */
  within<U>(radius: number, points: U[]): GeoQuery<U[]> {
    return new GeoQuery([] as U[]);
  }

  /**
   * Check if point is inside polygon
   */
  isInside(polygon: Polygon): GeoQuery<boolean> {
    return new GeoQuery(false);
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
  // Extract coordinate from various input types
  let coordinate: Coordinate;
  
  if (Array.isArray(data) && data.length === 2) {
    coordinate = data as Coordinate;
  } else if (typeof data === 'object' && data !== null) {
    if ('coordinates' in data) {
      coordinate = (data as any).coordinates;
    } else if ('location' in data) {
      coordinate = (data as any).location;
    } else if ('lat' in data && 'lon' in data) {
      coordinate = [(data as any).lat, (data as any).lon];
    } else if ('latitude' in data && 'longitude' in data) {
      coordinate = [(data as any).latitude, (data as any).longitude];
    } else {
      throw new Error('Invalid coordinate input');
    }
  } else {
    throw new Error('Invalid coordinate input');
  }

  return new GeoQuery(coordinate) as any;
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

/**
 * Builder pattern for complex geospatial queries
 */
export class GeospatialQueryBuilder {
  private filters: Array<(item: any) => boolean> = [];
  private transforms: Array<(item: any) => any> = [];

  /**
   * Filter by distance from a point
   */
  withinDistance(center: Coordinate, maxDistance: number): this {
    this.filters.push(item => {
      // Implementation would use actual distance calculation
      return true; // Placeholder
    });
    return this;
  }

  /**
   * Filter by polygon containment
   */
  withinPolygon(polygon: Polygon): this {
    this.filters.push(item => {
      // Implementation would use actual containment check
      return true; // Placeholder
    });
    return this;
  }

  /**
   * Add distance property to results
   */
  addDistance(center: Coordinate): this {
    this.transforms.push(item => ({
      ...item,
      distance: 0 // Placeholder - would calculate actual distance
    }));
    return this;
  }

  /**
   * Sort by distance
   */
  sortByDistance(): this {
    this.transforms.push(items => 
      Array.isArray(items) 
        ? items.sort((a, b) => (a.distance || 0) - (b.distance || 0))
        : items
    );
    return this;
  }

  /**
   * Limit results
   */
  limit(count: number): this {
    this.transforms.push(items => 
      Array.isArray(items) ? items.slice(0, count) : items
    );
    return this;
  }

  /**
   * Execute the query
   */
  execute<T>(data: T[]): T[] {
    let result = data.filter(item => 
      this.filters.every(filter => filter(item))
    );

    for (const transform of this.transforms) {
      result = transform(result);
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