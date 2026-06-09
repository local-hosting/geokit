/**
 * Shared MapLibre choropleth fill paint — includes fill-antialias for earcut folds.
 */

import {
  fillAntialiasForMap,
  type FillAntialiasMap,
  type FillAntialiasOptions,
} from './fill-antialias';

export type ChoroplethFillPaintInput = {
  'fill-color': unknown;
  'fill-opacity': unknown;
  'fill-outline-color'?: unknown;
};

export type ChoroplethFillPaint = ChoroplethFillPaintInput & {
  'fill-antialias': boolean;
};

/** Product default for flat maps and demos — avoids visible earcut triangle edges. */
export const FLAT_CHOROPLETH_FILL_ANTIALIAS_OPTIONS: FillAntialiasOptions = {
  preferAntialiasedWhenFlat: true,
};

/**
 * Build fill-layer paint for GeoJSON / vector choropleths.
 * Always sets fill-antialias from map pitch, terrain, and caller options.
 */
export function buildChoroplethFillPaint(
  map: FillAntialiasMap,
  paint: ChoroplethFillPaintInput,
  antialiasOptions: FillAntialiasOptions = FLAT_CHOROPLETH_FILL_ANTIALIAS_OPTIONS
): ChoroplethFillPaint {
  return {
    ...paint,
    'fill-antialias': fillAntialiasForMap(map, antialiasOptions),
  };
}

export type { FillAntialiasMap, FillAntialiasOptions } from './fill-antialias';
