/**
 * Boundary outline presets — county, state, city share one fill+line stack.
 */

import {
  addBoundaryOutlineLayer,
  applyBoundaryOutlineLinePaint,
  COUNTY_BOUNDARY_OUTLINE_SOURCE_OPTIONS,
  STATE_BOUNDARY_OUTLINE_SOURCE_OPTIONS,
  ZIP_BOUNDARY_OUTLINE_SOURCE_OPTIONS,
  refreshBoundaryOutlineData,
  removeBoundaryOutlineLayer,
  type BoundaryOutlineLayerConfig,
} from './boundary-outline-layer.js';
import { type BoundaryMapLike, isBoundaryMapReady } from './boundary-map.js';

export type BoundaryOutlinePresetKind = 'county' | 'state' | 'city' | 'zip';

export type BoundaryOutlinePresetOps = {
  add: (
    map: BoundaryMapLike,
    features: GeoJSON.FeatureCollection,
    config: BoundaryOutlineLayerConfig,
    beforeLayerId?: string
  ) => void;
  applyPaint: typeof applyBoundaryOutlineLinePaint;
  remove: typeof removeBoundaryOutlineLayer;
};

export type BoundaryOutlineBoundaryConfig = BoundaryOutlineLayerConfig;

const PRESET_POLYGON_SOURCE_OPTIONS: Partial<
  Record<BoundaryOutlinePresetKind, BoundaryOutlineLayerConfig['polygonSourceOptions']>
> = {
  county: COUNTY_BOUNDARY_OUTLINE_SOURCE_OPTIONS,
  state: STATE_BOUNDARY_OUTLINE_SOURCE_OPTIONS,
  zip: ZIP_BOUNDARY_OUTLINE_SOURCE_OPTIONS,
};

const PRESET_LINE_MIN_ZOOM: Partial<Record<BoundaryOutlinePresetKind, number>> = {
  state: 2,
};

export function boundaryOutlinePresetConfig(
  kind: BoundaryOutlinePresetKind,
  config: BoundaryOutlineLayerConfig
): BoundaryOutlineLayerConfig {
  return {
    ...config,
    polygonSourceOptions: config.polygonSourceOptions ?? PRESET_POLYGON_SOURCE_OPTIONS[kind],
    ...(PRESET_LINE_MIN_ZOOM[kind] != null && config.lineMinzoom == null
      ? { lineMinzoom: PRESET_LINE_MIN_ZOOM[kind] }
      : {}),
  };
}

export function boundaryOutlinePreset(kind: BoundaryOutlinePresetKind): BoundaryOutlinePresetOps {
  return {
    add: (map, features, config, beforeLayerId) => {
      if (!isBoundaryMapReady(map)) return;
      addBoundaryOutlineLayer(map!, features, boundaryOutlinePresetConfig(kind, config), beforeLayerId);
    },
    applyPaint: applyBoundaryOutlineLinePaint,
    remove: removeBoundaryOutlineLayer,
  };
}

export function addBoundaryOutlineForPreset(
  kind: BoundaryOutlinePresetKind,
  map: BoundaryMapLike | null | undefined,
  polygons: GeoJSON.FeatureCollection,
  config: BoundaryOutlineLayerConfig,
  beforeLayerId?: string
): GeoJSON.FeatureCollection {
  if (!isBoundaryMapReady(map)) return polygons;
  return addBoundaryOutlineLayer(
    map!,
    polygons,
    boundaryOutlinePresetConfig(kind, config),
    beforeLayerId
  );
}

export function refreshBoundaryOutlineForPreset(
  map: BoundaryMapLike | null | undefined,
  polygons: GeoJSON.FeatureCollection,
  config: Pick<BoundaryOutlineLayerConfig, 'polygonSourceId' | 'lineSourceId'>,
  options?: { fallbackToInput?: boolean }
): GeoJSON.FeatureCollection | null {
  const refreshed = refreshBoundaryOutlineData(map, polygons, config);
  if (options?.fallbackToInput && refreshed == null) return polygons;
  return refreshed;
}

export function setCityLineOpacity(
  map: BoundaryMapLike | null | undefined,
  lineLayerId: string,
  opacity: number
): void {
  if (!map?.getLayer?.(lineLayerId)) return;
  map.setPaintProperty?.(lineLayerId, 'line-opacity', opacity <= 0 ? 0 : 1);
}

export function ensureCityBoundaries(
  map: BoundaryMapLike | null | undefined,
  cities: GeoJSON.FeatureCollection,
  config: BoundaryOutlineLayerConfig,
  beforeLayerId?: string,
  lineOpacity = 1
): GeoJSON.FeatureCollection {
  if (!isBoundaryMapReady(map)) return cities;

  const resolved = boundaryOutlinePresetConfig('city', config);

  if (!map!.getSource?.(resolved.polygonSourceId)) {
    addBoundaryOutlineLayer(map!, cities, resolved, beforeLayerId);
    setCityLineOpacity(map, resolved.lineLayerId, lineOpacity);
    return cities;
  }

  refreshBoundaryOutlineForPreset(map, cities, resolved, { fallbackToInput: true });
  setCityLineOpacity(map, resolved.lineLayerId, lineOpacity);
  return cities;
}

export type CountyBoundaryConfig = BoundaryOutlineBoundaryConfig;
export type StateBoundaryConfig = BoundaryOutlineBoundaryConfig;
export type CityBoundaryConfig = BoundaryOutlineBoundaryConfig;

export const applyCountyLinePaint = applyBoundaryOutlineLinePaint;
export const applyStateLinePaint = applyBoundaryOutlineLinePaint;
export const applyCityLinePaint = applyBoundaryOutlineLinePaint;
export const removeCountyBoundaries = removeBoundaryOutlineLayer;
export const removeStateBoundaries = removeBoundaryOutlineLayer;
export const removeCityBoundaries = removeBoundaryOutlineLayer;

export const addCountyBoundaries = (
  map: BoundaryMapLike | null | undefined,
  counties: GeoJSON.FeatureCollection,
  config: CountyBoundaryConfig,
  beforeLayerId?: string
) => addBoundaryOutlineForPreset('county', map, counties, config, beforeLayerId);

export const addStateBoundaries = (
  map: BoundaryMapLike | null | undefined,
  states: GeoJSON.FeatureCollection,
  config: StateBoundaryConfig,
  beforeLayerId?: string
) => addBoundaryOutlineForPreset('state', map, states, config, beforeLayerId);

export const refreshCountyBoundaries = (
  map: BoundaryMapLike | null | undefined,
  counties: GeoJSON.FeatureCollection,
  config: Pick<CountyBoundaryConfig, 'polygonSourceId' | 'lineSourceId'>
) => refreshBoundaryOutlineForPreset(map, counties, config);

export const refreshStateBoundaries = refreshCountyBoundaries;

export const refreshCityBoundaries = (
  map: BoundaryMapLike | null | undefined,
  cities: GeoJSON.FeatureCollection,
  config: Pick<CityBoundaryConfig, 'polygonSourceId' | 'lineSourceId'>
) => refreshBoundaryOutlineForPreset(map, cities, config, { fallbackToInput: true })!;

export type { BoundaryOutlineLayerConfig } from './boundary-outline-layer.js';
