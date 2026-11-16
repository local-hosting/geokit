/**
 * Spatial index decode and conversion — pulls in @doppler-group/geokit/h3.
 * Import `@doppler-group/geokit/core/spatial/decode` when H3 interop is needed.
 */

export {
  geohashPointToH3Point,
  geohashAreaToH3Area,
  h3PointToGeohashPoint,
  h3AreaToGeohashArea,
} from '../conversion';

export {
  decodePointToCoordinates,
  decodeAreaToCoordinates,
  getBoundsFromPoint,
  getBoundsFromArea,
} from '../universal';
