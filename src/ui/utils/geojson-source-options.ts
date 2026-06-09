/**
 * GeoJSON source options for MapLibre vector tiling (geojson-vt).
 */

/** Shared vt settings for admin outlines and choropleth boundaries. */
export const BOUNDARY_LINE_GEOJSON_SOURCE_OPTIONS = {
  tolerance: 0,
  buffer: 256,
  maxzoom: 14,
} as const;

/** County-scale admin boundary lines — same vt tuning as other outline sources. */
export const ADMIN_COUNTY_GEOJSON_SOURCE_OPTIONS = BOUNDARY_LINE_GEOJSON_SOURCE_OPTIONS;

/** Choropleth / region polygon sources (DMA, dissolved regions). */
export const CHOROPLETH_BOUNDARY_GEOJSON_SOURCE_OPTIONS = BOUNDARY_LINE_GEOJSON_SOURCE_OPTIONS;
