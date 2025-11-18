/**
 * Type definitions for geospatial utilities
 */

/**
 * A coordinate pair as [number, number]
 */
export type Coordinate = [number, number];

/**
 * Latitude/Longitude format: [latitude, longitude]
 */
export type LatLon = [number, number];

/**
 * Longitude/Latitude format (GeoJSON standard): [longitude, latitude]
 */
export type LonLat = [number, number];

/**
 * GeoJSON Point geometry
 */
export interface Point {
  type: 'Point';
  coordinates: LonLat;
}

/**
 * GeoJSON Polygon geometry
 */
export interface Polygon {
  type: 'Polygon';
  coordinates: number[][][];
}

/**
 * GeoJSON MultiPolygon geometry
 */
export interface MultiPolygon {
  type: 'MultiPolygon';
  coordinates: number[][][][];
}

/**
 * GeoJSON geometry union type
 */
export type Geometry = Point | Polygon | MultiPolygon;

/**
 * GeoJSON Feature
 */
export interface Feature {
  type: 'Feature';
  geometry: Geometry;
  properties?: Record<string, unknown>;
}

/**
 * GeoJSON FeatureCollection
 */
export interface FeatureCollection {
  type: 'FeatureCollection';
  features: Feature[];
}

/**
 * Bounding box as [minLon, minLat, maxLon, maxLat]
 */
export type Bounds = [number, number, number, number];

/**
 * Coordinate object format (alternative to array)
 */
export interface CoordinateObject {
  lat: number;
  lon: number;
}
