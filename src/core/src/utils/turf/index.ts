/**
 * Turf-backed geometry utilities (parity Tier 1.5).
 * Mirrors geokit-swift GeoKitCore measurement modules.
 *
 * Line/polygon buffers use `@turf/buffer` (Node-only — Swift throws until turf-swift ports buffer).
 */

export * from '../containment/index';
export * from '../centroid/index';
export * from '../area/index';
export * from '../length/index';
export * from '../buffer/index';
export { buffer, bufferLine, bufferPolygon } from '../buffer/buffer-turf';
export * from '../conversions/index';
export { getCenter } from '../bounds/get-center';
export { bboxToPolygon, bboxToPolygonGeometry } from '../bounds/bbox-to-polygon';
export { getBounds } from '../bounds/get-bounds';
