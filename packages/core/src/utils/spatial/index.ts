/**
 * Spatial index interoperability utilities
 * Work with Geohash and H3 indices in a unified way
 */

// Type guards
export {
  isGeohash,
  isH3,
  isGeohashPoint,
  isGeohashArea,
  isH3Point,
  isH3Area,
  getSpatialIndexType,
} from './type-guards';

// Branded type constructors
export { asGeohashPoint, asGeohashArea, asH3Point, asH3Area } from './constructors';

// Conversion functions
export {
  geohashPointToH3Point,
  geohashAreaToH3Area,
  h3PointToGeohashPoint,
  h3AreaToGeohashArea,
} from './conversion';

// Universal functions
export {
  decodePointToCoordinates,
  decodeAreaToCoordinates,
  getBoundsFromPoint,
  getBoundsFromArea,
} from './universal';
