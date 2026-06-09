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
} from './utils/distance';

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
} from './utils/coordinates';

// GeoJSON utilities
export {
  getCoordinates,
  createFeature,
  createFeatureCollection,
  extractGeometry,
  formatJSONCompact,
  getFeatureId,
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
  stripDegenerateInteriorRings,
  type StripDegenerateInteriorRingsOptions,
  stripAcuteOuterRingSpikes,
  type StripAcuteOuterRingSpikesOptions,
} from './utils/geojson';

// Normalization utilities
export { slugify, normalize, normalizeName } from './utils/normalize';

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
} from './utils/bounds';

// Bearing utilities
export {
  bearing,
  finalBearing,
  midpoint,
  destination,
  destinationMeters,
  destinationKm,
  destinationMiles,
} from './utils/bearing';

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
  resolvePointToFeatureProperty,
} from './utils/containment';

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
} from './utils/area';

// Interpolation utilities
export {
  interpolate,
  interpolateMeters,
  nearestPointOnLine,
  nearestPointOnPolyline,
  pointToLineDistance,
  pointToLineDistanceMeters,
  pointToPolylineDistanceMeters,
  type PointToLineDistanceOptions,
  type PointToLineDistanceUnits,
  resample,
} from './utils/interpolation';

// Conversion utilities
export type { DMS } from './utils/conversions';
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
} from './utils/conversions';

// Simplification utilities
export {
  simplify,
  simplifyMeters,
  simplifyPolygonRing,
  simplifyPolygonRingMeters,
  simplifyPolygonRingToMaxPoints,
  simplifyGeometry,
  simplifyGeometryMeters,
} from './utils/simplify';

// Smoothing utilities (Chaikin's corner cutting)
export {
  smoothRing,
  smoothLine,
  smoothPolygon,
  smoothMultiPolygon,
  smoothGeometry,
  smoothFeatureCollection,
} from './utils/smoothing';

// Clustering utilities
export type { ClusterPoint, Cluster } from './utils/clustering';
export { gridCluster, gridClusterMeters, distanceCluster } from './utils/clustering';

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
} from './utils/geohash';

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
} from './utils/h3';

// Centroid utilities
export { polygonCentroid, pointsCentroid } from './utils/centroid';

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
} from './utils/length';

// Convex hull utilities
export { convexHull } from './utils/hull';

// Union utilities
export { unionPolygons, unionAll, unionFeatures, unionWith } from './utils/union';

// Difference utilities
export { differencePolygons, differenceFeatures, subtract } from './utils/difference';

// Intersection utilities
export type { LineSegment } from './utils/intersection';
export { lineIntersection, linesIntersect } from './utils/intersection';

// Buffer utilities
export { buffer, bufferPoint, bufferLine, bufferPolygon } from './utils/buffer';

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
} from './utils/spatial';

// API Providers
export * from './api';

// Demographic aggregation utilities
export {
  aggregateDemographics,
  filterDemographicsByBounds,
  filterDemographicsByPolygon,
  getPolygonBounds,
} from './utils/demographics/aggregate';

// ZIP code utilities for demographics
export type { ZipCentroid } from './utils/demographics/zipcode';
export {
  // H3-to-ZIP index (fast path for instant lookups)
  loadH3ZipIndex,
  loadH3ZipIndexFromUrl,
  isH3IndexLoaded,
  getH3IndexStats,
  findZipsInPolygonLocal,
  // Local demographics data (instant lookups, no API calls)
  loadDemographicsData,
  loadDemographicsDataFromUrl,
  isDemographicsDataLoaded,
  getLocalDemographics,
  // Legacy aliases
  loadDemographicsCache,
  getCachedDemographics,
  isDemographicsCacheLoaded,
  // ZIP lookup functions
  getZipForPoint,
  findZipsInRadius,
  filterZipsByPolygon,
  findZipsInPolygon,
  estimateTravelRadius,
  estimateTravelRadiusMiles,
  clearZipCache,
} from './utils/demographics/zipcode';

// H3-to-ZIP index loader (lazy-loaded from URL, saves ~690KB bundle size)
export { initializeZipIndex, loadZipIndexData } from './utils/demographics/zip-h3-index';

// TopoJSON conversion utilities
export type {
  Topology,
  GeometryObject as TopoGeometryObject,
  Properties as TopoProperties,
} from './utils/topojson';
export {
  geojsonToTopology,
  simplifyFeatureCollectionTopology,
  simplifyTopologyMeters,
  topoFeature,
  topoGeometriesByProperty,
  topoMerge,
  topoMesh,
  topoNeighbors,
  topoObjectNames,
} from './utils/topojson';

// Cache utilities
export type { CacheOptions, CacheStats } from './utils/cache';
export { GeoCache, roundForCacheKey, coordinateCacheKey } from './utils/cache';

// API tracking utilities
export { ApiTracker, BudgetExceededError } from './utils/api-tracker';

// Retry utilities
export type { RetryOptions } from './utils/retry';
export { withRetry, delay } from './utils/retry';

// Logger utilities
export type { LoggerOptions, DebugLogger, Logger } from './utils/logger';
export { createLogger } from './utils/logger';
