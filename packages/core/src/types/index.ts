/**
 * Type definitions for geospatial utilities
 */

// Import and re-export official GeoJSON types
import type {
  Point,
  Polygon,
  MultiPolygon,
  LineString,
  MultiLineString,
  MultiPoint,
  GeometryCollection,
  Geometry,
  Feature,
  FeatureCollection,
  Position,
  BBox,
} from 'geojson';

// Re-export official GeoJSON types
export type {
  Point,
  Polygon,
  MultiPolygon,
  LineString,
  MultiLineString,
  MultiPoint,
  GeometryCollection,
  Geometry,
  Feature,
  FeatureCollection,
  Position,
  BBox,
};

/**
 * A coordinate pair as [number, number]
 */
export type Coordinate = [number, number];

/**
 * Latitude/Longitude format: [latitude, longitude]
 */
export type LatLon = [number, number];

/**
 * Polyline: an open sequence of points representing a path or route
 * Alias for array of LatLon coordinates
 */
export type Polyline = LatLon[];

/**
 * Longitude/Latitude format (GeoJSON standard): [longitude, latitude]
 * Alias for GeoJSON Position type
 */
export type LonLat = Position;

/**
 * Bounding box as [minLon, minLat, maxLon, maxLat]
 */
export type Bounds = [number, number, number, number];

/**
 * Coordinate object format (alternative to array): {lat, lon}
 */
export interface CoordinateObject {
  lat: number;
  lon: number;
}

/**
 * Coordinate object format (alternative to array): {latitude, longitude}
 */
export interface LatitudeLongitudeObject {
  latitude: number;
  longitude: number;
}

/**
 * Union type accepting all coordinate input formats
 */
export type CoordinateInput = LatLon | LonLat | CoordinateObject | LatitudeLongitudeObject | Point;

/**
 * Branded type for Geohash representing a point location
 */
export type GeohashPoint = string & { __brand: 'GeohashPoint' };

/**
 * Branded type for Geohash representing an area/region
 */
export type GeohashArea = string & { __brand: 'GeohashArea' };

/**
 * Branded type for H3 index representing a point location
 */
export type H3Point = string & { __brand: 'H3Point' };

/**
 * Branded type for H3 index representing an area/region
 */
export type H3Area = string & { __brand: 'H3Area' };

/**
 * Union type for all spatial index types
 */
export type SpatialIndex = GeohashPoint | GeohashArea | H3Point | H3Area;

// UI popup types (gk-popup element)
export type {
  PopupOptions,
  StyledPopupOptions,
  PointPopupProperties,
  PopupTag,
  PopupAction,
  PopupContentOptions,
} from './popup';

export * from './api-composite.js';

export type * from './static-map.js';
export * from './map-display.js';
