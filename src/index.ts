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
  serializeCoordinates,
  deserializeCoordinates,
  normalizeCoordinateInput,
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

// Geohash utilities
export {
  // Legacy functions (backward compatible)
  encodeGeohash,
  decodeGeohash,
  geohashBounds,
  geohashNeighbors,
  geohashNeighborsArray,
  geohashNeighbor,
  geohashesInBounds,
  validateGeohash,
  // Type-safe functions
  encodeGeohashPoint,
  encodeGeohashArea,
  decodeGeohashPoint,
  decodeGeohashArea,
  geohashPointBounds,
  geohashAreaBounds,
  geohashPointNeighbors,
  geohashAreaNeighbors,
} from './geohash';

// H3 utilities
export {
  // Legacy functions (backward compatible)
  coordinatesToH3,
  h3ToCoordinates,
  h3ToBoundary,
  h3Neighbors,
  h3ToParent,
  h3ToChildren,
  h3GetResolution,
  validateH3,
  h3AreNeighbors,
  h3SetToMultiPolygon,
  polygonToH3,
  h3EdgeLength,
  h3CellArea,
  // Type-safe functions
  coordinatesToH3Point,
  coordinatesToH3Area,
  h3PointToCoordinates,
  h3AreaToCoordinates,
  h3PointToBoundary,
  h3AreaToBoundary,
  h3PointNeighbors,
  h3AreaNeighbors,
} from './h3';

// Centroid utilities
export { polygonCentroid, pointsCentroid } from './centroid';

// Length utilities
export {
  lineLength,
  lineLengthMeters,
  lineLengthKm,
  lineLengthMiles,
  perimeter,
  perimeterMeters,
  perimeterKm,
  perimeterMiles,
} from './length';

// Convex hull utilities
export { convexHull } from './hull';

// Intersection utilities
export type { LineSegment } from './intersection';
export { lineIntersection, linesIntersect } from './intersection';

// Buffer utilities
export { buffer, bufferPoint, bufferLine, bufferPolygon } from './buffer';

// Spatial index interoperability utilities
export {
  // Type guards
  isGeohash,
  isH3,
  isGeohashPoint,
  isGeohashArea,
  isH3Point,
  isH3Area,
  getSpatialIndexType,
  // Branded type constructors
  asGeohashPoint,
  asGeohashArea,
  asH3Point,
  asH3Area,
  // Conversion functions
  geohashPointToH3Point,
  geohashAreaToH3Area,
  h3PointToGeohashPoint,
  h3AreaToGeohashArea,
  // Universal functions
  decodePointToCoordinates,
  decodeAreaToCoordinates,
  getBoundsFromPoint,
  getBoundsFromArea,
} from './spatial';
