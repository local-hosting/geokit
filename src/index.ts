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

// Constants
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
} from './constants';

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
  distance,
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
  normalizeCoordinatesArray,
  roundGeometry,
  roundCoordinate,
  roundCoordinates, // deprecated, use roundGeometry
  roundCoord, // deprecated, use roundCoordinate
  removeDuplicateCoordinates,
  removeDuplicateCoordinatesFromGeometry,
  geojsonPolygonToLatLon,
  countPointsInGeometry,
} from './coordinates';

// GeoJSON utilities
export {
  getCoordinates,
  createFeature,
  createFeatureCollection,
  extractGeometry,
  formatJSONCompact,
  isValidPosition,
  isValidPoint,
  isValidLineString,
  isValidPolygon,
  isValidMultiPoint,
  isValidMultiLineString,
  isValidMultiPolygon,
  isValidGeometryCollection,
  isValidGeometry,
  isValidFeature,
  isValidFeatureCollection,
  validateGeoJSON,
  type ValidationResult,
  repairGeometry,
  repairFeature,
  repairFeatureCollection,
  repairGeoJSON,
  type RepairOptions,
  fixPolygonRingOrder,
  filterTinyPolygons,
  cleanGeometry,
} from './geojson';

// Normalization utilities
export { slugify, normalize, normalizeName } from './normalize';

// Bounds utilities
export {
  getBounds,
  getCenter,
  isWithinBounds,
  boundsToObject,
  type BoundsObject,
  bboxToPolygon,
  bboxToPolygonGeometry,
  calculateZoomFromBounds,
  calculateCenterAndZoom,
} from './bounds';

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
  pointInGeometry,
  pointInGeometryCurried,
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
export {
  simplify,
  simplifyMeters,
  simplifyPolygonRing,
  simplifyPolygonRingMeters,
  simplifyPolygonRingToMaxPoints,
  simplifyGeometry,
  simplifyGeometryMeters,
} from './simplify';

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
  h3ToPolygon,
  h3Neighbors,
  snapToH3Cell,
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
  h3PointToPolygon,
  h3AreaToPolygon,
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

// Union utilities
export { unionPolygons, unionAll, unionFeatures } from './union';

// Difference utilities
export { differencePolygons, differenceFeatures } from './difference';

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
