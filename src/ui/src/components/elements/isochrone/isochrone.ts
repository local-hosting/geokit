/**
 * Geokit Isochrone Component
 *
 * Travel-time polygons from a routing provider (Mapbox, etc.).
 * Default `render="polygon"` — smooth GeoJSON fill; no H3 dependency.
 *
 * Optional `render="h3"` tessellates into hex cells before first paint (lazy-loads h3-js).
 *
 * Usage:
 * <gk-isochrone lat="40.7128" lng="-74.0060" time="15" mode="driving"></gk-isochrone>
 * <gk-isochrone lat="40.7128" lng="-74.0060" time="15" mode="driving" render="h3" h3-resolution="7"></gk-isochrone>
 */

export type { IsochroneOptions } from './isochrone-static-factory';
export { IsochroneElement } from './isochrone-static-factory';
