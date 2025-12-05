/**
 * Geometry simplification utilities
 * Reduce the number of points in polylines and polygons while preserving shape
 */

export { simplify, simplifyMeters } from './douglas-peucker';
export {
  simplifyPolygonRing,
  simplifyPolygonRingMeters,
  simplifyPolygonRingToMaxPoints,
} from './polygon';
export { simplifyGeometry, simplifyGeometryMeters } from './geometry';
