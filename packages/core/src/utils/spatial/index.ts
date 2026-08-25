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
