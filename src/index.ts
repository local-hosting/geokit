/**
 * @geokit - Geospatial utility toolkit
 *
 * A functional, curried geospatial utility library for browser and Node.js
 */

// Types
export type {
  Coordinate,
  LatLon,
  LonLat,
  Point,
  Polygon,
  MultiPolygon,
  Geometry,
  Feature,
  FeatureCollection,
  Bounds,
  CoordinateObject,
} from './types';

// Distance utilities
export {
  haversine,
  haversineMeters,
  haversineKm,
  haversineMiles,
  withinDistance,
} from './distance';

// Coordinate utilities
export {
  toLatLon,
  toLonLat,
  isValidCoordinate,
  extractCoordinates,
  createPoint,
} from './coordinates';

// GeoJSON utilities
export { getCoordinates, createFeature, createFeatureCollection, extractGeometry } from './geojson';

// Normalization utilities
export { slugify, normalize, normalizeName } from './normalize';

// Bounds utilities
export { getBounds, getCenter, isWithinBounds } from './bounds';
