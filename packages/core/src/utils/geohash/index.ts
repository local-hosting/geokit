/**
 * Geohash utilities
 * Encode/decode coordinates to geohash strings, work with geohash neighbors and bounds
 */

// Legacy functions (backward compatible)
export { encodeGeohash } from './encode';
export { decodeGeohash } from './decode';
export { geohashBounds } from './bounds';
export {
  geohashNeighbors,
  geohashNeighborsArray,
  geohashNeighbor,
  geohashNeighborsObj,
} from './neighbors';
export { validateGeohash, geohashesInBounds } from './validation';
export { geohashPrecision, geohashTruncate, geohashParent } from './hierarchy';
export { geohashToPolygon } from './polygon';
export {
  invertGeohashMap,
  rollupGeohashMap,
  keyToParentGeohash,
  rollupGeohashToZips,
  type GeohashMultiMap,
  type InvertGeohashMapOptions,
} from './cell-crosswalk';


// Type-safe functions
export {
  encodeGeohashPoint,
  encodeGeohashArea,
  decodeGeohashPoint,
  decodeGeohashArea,
  geohashPointBounds,
  geohashAreaBounds,
  geohashPointNeighbors,
  geohashAreaNeighbors,
} from './type-safe';
