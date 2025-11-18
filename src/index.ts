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
  // Haversine (most common)
  haversine,
  haversineMeters,
  haversineKm,
  haversineMiles,
  // Vincenty (most accurate)
  vincenty,
  vincentyMeters,
  vincentyKm,
  vincentyMiles,
  // Great Circle (simple and fast)
  greatCircle,
  greatCircleMeters,
  greatCircleKm,
  greatCircleMiles,
  // Rhumb Line (constant bearing)
  rhumbLine,
  rhumbLineMeters,
  rhumbLineKm,
  rhumbLineMiles,
  // Utilities
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

// Bearing utilities
export {
  bearing,
  finalBearing,
  midpoint,
  destination,
  destinationMeters,
  destinationKm,
  destinationMiles,
} from './bearing';

// Containment utilities
export {
  pointInPolygon,
  isPointInPolygon,
  pointInCircle,
  isPointInCircle,
  boundsContains,
  boundsContainsBounds,
  boundsIntersects,
} from './containment';

// Area utilities
export {
  polygonArea,
  polygonAreaKm,
  polygonAreaMiles,
  polygonAreaAcres,
  circleArea,
  circleAreaKm,
  circleAreaMiles,
  boundsArea,
  boundsAreaKm,
  boundsAreaMiles,
} from './area';

// Interpolation utilities
export {
  interpolate,
  interpolateMeters,
  nearestPointOnLine,
  nearestPointOnPolyline,
  resample,
} from './interpolation';

// Conversion utilities
export type { DMS } from './conversions';
export {
  toDMS,
  fromDMS,
  coordinatesToDMS,
  formatDMS,
  toRadians,
  toDegrees,
  normalizeLongitude,
  normalizeLatitude,
  normalizeCoordinates,
} from './conversions';

// Simplification utilities
export { simplify, simplifyMeters } from './simplify';

// Clustering utilities
export type { ClusterPoint, Cluster } from './clustering';
export { gridCluster, gridClusterMeters, distanceCluster } from './clustering';
