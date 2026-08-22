/**
 * GeoKit core — geo math, types, and constants.
 * Parity Tier 1 with geokit-swift `GeoKitCore` (see docs/module-map.md).
 */

export type {
  Coordinate,
  LatLon,
  LonLat,
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
  Bounds,
  CoordinateObject,
  LatitudeLongitudeObject,
  CoordinateInput,
  GeohashPoint,
  GeohashArea,
  H3Point,
  H3Area,
  SpatialIndex,
} from '../types/index.js';

export {
  EARTH_RADIUS_METERS,
  EARTH_RADIUS_KM,
  EARTH_RADIUS_MILES,
  EARTH_RADIUS_WGS84_METERS,
  EARTH_RADIUS_WGS84_KM,
  EARTH_RADIUS_WGS84_MILES,
  EARTH_FLATTENING_WGS84,
  METERS_PER_DEGREE_EQUATOR,
  METERS_TO_KILOMETERS,
  METERS_TO_MILES,
  SQUARE_METERS_TO_SQUARE_KILOMETERS,
  SQUARE_METERS_TO_SQUARE_MILES,
  SQUARE_METERS_TO_ACRES,
  MIN_LATITUDE,
  MAX_LATITUDE,
  MIN_LONGITUDE,
  MAX_LONGITUDE,
  DEGREES_IN_CIRCLE,
  DEGREES_TO_RADIANS,
  RADIANS_TO_DEGREES,
  TWO_PI,
  LONGITUDE_NORMALIZATION_OFFSET,
  DEFAULT_BUFFER_STEPS,
  SECONDS_PER_MINUTE,
  SECONDS_PER_DEGREE,
} from '../constants.js';

export * from '../utils/bounds/index.js';
export * from '../utils/bearing/index.js';
export * from '../utils/coordinates/index.js';
export * from '../utils/distance/index.js';
export * from '../utils/h3/index.js';
export * from '../utils/geohash/index.js';
export * from '../utils/geojson/index.js';
