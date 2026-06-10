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
 * Polygon admin sources (fill layers only). Outline layers use
 * `polygonsToBoundaryLines` + `BOUNDARY_LINE_GEOJSON_SOURCE_OPTIONS`.
 */
export const ADMIN_STATE_GEOJSON_SOURCE_OPTIONS = {
  tolerance: 1,
  buffer: 256,
  maxzoom: 14,
} as const;

/** Polygon county sources (fill layers only). */
export const ADMIN_COUNTY_GEOJSON_SOURCE_OPTIONS = {
  tolerance: 2,
  buffer: 256,
  maxzoom: 14,
} as const;

/** Polygon ZIP sources (fill layers only). */
export const ADMIN_ZIP_GEOJSON_SOURCE_OPTIONS = {
  tolerance: 1,
  buffer: 256,
  maxzoom: 14,
} as const;

/** Choropleth / region polygon sources (DMA, dissolved regions). */
export const CHOROPLETH_BOUNDARY_GEOJSON_SOURCE_OPTIONS = {
  tolerance: 0,
  buffer: 256,
  maxzoom: 14,
} as const;
