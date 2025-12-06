/**
 * Coordinate utilities
 * Convert, validate, extract, and serialize coordinates in various formats
 */

export { toLatLon, toLonLat } from './conversion';
export { isValidCoordinate } from './validation';
export {
  extractCoordinates,
  normalizeCoordinateInput,
  normalizeCoordinatesArray,
} from './extraction';
export { serializeCoordinates, deserializeCoordinates } from './serialization';
export { createPoint } from './creation';
export {
  roundGeometry,
  roundCoordinate,
  roundCoordinates, // deprecated, use roundGeometry
  roundCoord, // deprecated, use roundCoordinate
  removeDuplicateCoordinates,
  removeDuplicateCoordinatesFromGeometry,
} from './manipulation';
export { geojsonPolygonToLatLon } from './polygon-conversion';
export { countPointsInGeometry } from './count-points';
