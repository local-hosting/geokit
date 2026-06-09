/**
 * Interpolation and path operation utilities
 * Interpolate points along paths, find nearest points, and resample polylines
 */

export { interpolate, interpolateMeters } from './along';
export { nearestPointOnLine, nearestPointOnPolyline } from './nearest';
export {
  pointToLineDistance,
  pointToLineDistanceMeters,
  pointToPolylineDistanceMeters,
  type PointToLineDistanceOptions,
  type PointToLineDistanceUnits,
} from './point-to-line-distance';
export { resample } from './resample';
