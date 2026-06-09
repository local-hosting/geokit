/**
 * GeoJSON source options for MapLibre vector tiling (geojson-vt).
 */

/** County-scale admin polygons — tolerance reduces dense coastal rings. */
export const ADMIN_COUNTY_GEOJSON_SOURCE_OPTIONS = {
  tolerance: 1.5,
  maxzoom: 14,
} as const;

/** Detailed choropleth / region boundaries — preserve dissolved outline detail. */
export const CHOROPLETH_BOUNDARY_GEOJSON_SOURCE_OPTIONS = {
  tolerance: 0,
  maxzoom: 14,
} as const;
