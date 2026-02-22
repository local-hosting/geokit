/**
 * Containment and spatial relationship utilities
 * Check if points are within polygons, circles, or bounds
 */

export { pointInPolygon, isPointInPolygon } from './point-in-polygon';
export { pointInCircle, isPointInCircle } from './point-in-circle';
export { boundsContains, boundsContainsBounds, boundsIntersects } from './bounds-contains';
export { pointInGeometry, pointInGeometryCurried } from './point-in-geometry';
export { resolvePointToFeatureProperty } from './resolve-point-to-feature-property';
