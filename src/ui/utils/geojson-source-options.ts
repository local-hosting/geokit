/**
 * GeoJSON source options for MapLibre vector tiling (geojson-vt).
 */

/** State / city outline sources — crisp rings, low feature count. */
export const BOUNDARY_LINE_GEOJSON_SOURCE_OPTIONS = {
  tolerance: 0,
  buffer: 256,
  maxzoom: 14,
} as const;

/** State admin outlines — vt simplification avoids LineBucket 65535-vertex warnings on detailed coastlines. */
export const ADMIN_STATE_GEOJSON_SOURCE_OPTIONS = {
  tolerance: 1,
  buffer: 256,
  maxzoom: 14,
} as const;

/**
 * County admin outlines — vt simplification avoids MapLibre LineBucket
 * 65535-vertex segment warnings on detailed county rings (len * 10 reserve).
 */
export const ADMIN_COUNTY_GEOJSON_SOURCE_OPTIONS = {
  tolerance: 2,
  buffer: 256,
  maxzoom: 14,
} as const;

/** Choropleth / region polygon sources (DMA, dissolved regions). */
export const CHOROPLETH_BOUNDARY_GEOJSON_SOURCE_OPTIONS = {
  tolerance: 0,
  buffer: 256,
  maxzoom: 14,
} as const;
