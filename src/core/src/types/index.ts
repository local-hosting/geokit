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

export type {
  GeohashArea,
  GeohashPoint,
  H3Area,
  H3Point,
  SpatialIndex,
} from './spatial-index';

// UI popup types (gk-popup element)
export type {
  PopupOptions,
  StyledPopupOptions,
  PointPopupProperties,
  PopupTag,
  PopupAction,
  PopupContentOptions,
} from './popup';

export * from '@twinfile/geokit/service/types/api-composite';

export type * from './static-map';
export * from './map-display';

export type {
  CatalogIdentity,
  ConvertOutput,
  CountyFips,
  CountryCode,
  DMA,
  DmaSlug,
  GeoIdentity,
  GeoPoint,
  GeoRef,
  GeoRefInput,
  MacroRegion,
  PlaceKey,
  StateCode,
  ZipCode,
} from './geo-identity';
export { GeoKind } from './geo-identity';
