/**
 * GeoJSON source options for MapLibre vector tiling (geojson-vt).
 */

/** State / city outline sources — crisp rings, low feature count. */
export const BOUNDARY_LINE_GEOJSON_SOURCE_OPTIONS = {
  tolerance: 0,
  buffer: 256,
  maxzoom: 14,
} as const;

/**
 * Polygon boundary sources (fill layers only). Outline layers use
 * `polygonsToBoundaryLines` + `BOUNDARY_LINE_GEOJSON_SOURCE_OPTIONS`.
 */
export const STATE_BOUNDARY_GEOJSON_SOURCE_OPTIONS = {
  tolerance: 1,
  buffer: 256,
  maxzoom: 14,
} as const;

/** Polygon county sources (fill layers only). */
export const COUNTY_BOUNDARY_GEOJSON_SOURCE_OPTIONS = {
  tolerance: 2,
  buffer: 256,
  maxzoom: 14,
} as const;

/** Polygon ZIP sources (fill layers only). */
export const ZIP_BOUNDARY_GEOJSON_SOURCE_OPTIONS = {
  tolerance: 1,
  buffer: 256,
  maxzoom: 14,
} as const;

/** @deprecated Use STATE_BOUNDARY_GEOJSON_SOURCE_OPTIONS */
export const ADMIN_STATE_GEOJSON_SOURCE_OPTIONS = STATE_BOUNDARY_GEOJSON_SOURCE_OPTIONS;
/** @deprecated Use COUNTY_BOUNDARY_GEOJSON_SOURCE_OPTIONS */
export const ADMIN_COUNTY_GEOJSON_SOURCE_OPTIONS = COUNTY_BOUNDARY_GEOJSON_SOURCE_OPTIONS;
/** @deprecated Use ZIP_BOUNDARY_GEOJSON_SOURCE_OPTIONS */
export const ADMIN_ZIP_GEOJSON_SOURCE_OPTIONS = ZIP_BOUNDARY_GEOJSON_SOURCE_OPTIONS;

/** Choropleth / region polygon sources (dissolved regions). */
export const CHOROPLETH_BOUNDARY_GEOJSON_SOURCE_OPTIONS = {
  tolerance: 0,
  buffer: 256,
  maxzoom: 14,
} as const;

/** Point-only GeoJSON sources (gk-point main/hover/selection). Zero tolerance keeps sibling sources aligned at high zoom. */
export const POINT_GEOJSON_SOURCE_OPTIONS = {
  tolerance: 0,
} as const;

/** Read the first Point geometry from a MapLibre GeoJSON source payload. */
export function readFirstPointCoordinatesFromGeoJsonSource(
  source:
    | {
        _data?: GeoJSON.FeatureCollection;
        _geojson?: GeoJSON.FeatureCollection;
        data?: GeoJSON.FeatureCollection;
      }
    | null
    | undefined
): [number, number] | null {
  const data = source?._data ?? source?._geojson ?? source?.data;
  const geom = data?.features?.[0]?.geometry;
  if (geom?.type !== 'Point' || !('coordinates' in geom)) return null;
  const coords = geom.coordinates;
  if (!Array.isArray(coords) || coords.length < 2) return null;
  const lng = Number(coords[0]);
  const lat = Number(coords[1]);
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
  return [lng, lat];
}
