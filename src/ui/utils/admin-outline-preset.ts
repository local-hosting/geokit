/**
 * Admin outline presets — county, state, place share one CDN fill+line stack.
 */

import {
  addAdminOutlineLayer,
  applyAdminOutlineLinePaint,
  ADMIN_COUNTY_OUTLINE_SOURCE_OPTIONS,
  ADMIN_STATE_OUTLINE_SOURCE_OPTIONS,
  ADMIN_ZIP_OUTLINE_SOURCE_OPTIONS,
  refreshAdminOutlineData,
  removeAdminOutlineLayer,
  type AdminOutlineLayerConfig,
} from './admin-outline-layer';
import { type BoundaryMapLike, isBoundaryMapReady } from './boundary-map';

export type AdminOutlinePresetKind = 'county' | 'state' | 'place' | 'zip';

export type AdminOutlinePresetOps = {
  add: (
    map: BoundaryMapLike,
    features: GeoJSON.FeatureCollection,
    config: AdminOutlineLayerConfig,
    beforeLayerId?: string
  ) => void;
  applyPaint: typeof applyAdminOutlineLinePaint;
  remove: typeof removeAdminOutlineLayer;
};

export type AdminOutlineBoundaryConfig = AdminOutlineLayerConfig;

const PRESET_POLYGON_SOURCE_OPTIONS: Partial<
  Record<AdminOutlinePresetKind, AdminOutlineLayerConfig['polygonSourceOptions']>
> = {
  county: ADMIN_COUNTY_OUTLINE_SOURCE_OPTIONS,
  state: ADMIN_STATE_OUTLINE_SOURCE_OPTIONS,
  zip: ADMIN_ZIP_OUTLINE_SOURCE_OPTIONS,
};

const PRESET_LINE_MIN_ZOOM: Partial<Record<AdminOutlinePresetKind, number>> = {
  state: 2,
};

export function adminOutlinePresetConfig(
  kind: AdminOutlinePresetKind,
  config: AdminOutlineLayerConfig
): AdminOutlineLayerConfig {
  return {
    ...config,
    polygonSourceOptions: config.polygonSourceOptions ?? PRESET_POLYGON_SOURCE_OPTIONS[kind],
    ...(PRESET_LINE_MIN_ZOOM[kind] != null && config.lineMinzoom == null
      ? { lineMinzoom: PRESET_LINE_MIN_ZOOM[kind] }
      : {}),
  };
}

export function adminOutlinePreset(kind: AdminOutlinePresetKind): AdminOutlinePresetOps {
  return {
    add: (map, features, config, beforeLayerId) => {
      if (!isBoundaryMapReady(map)) return;
      addAdminOutlineLayer(map!, features, adminOutlinePresetConfig(kind, config), beforeLayerId);
    },
    applyPaint: applyAdminOutlineLinePaint,
    remove: removeAdminOutlineLayer,
  };
}

export function addAdminOutlineForPreset(
  kind: AdminOutlinePresetKind,
  map: BoundaryMapLike | null | undefined,
  polygons: GeoJSON.FeatureCollection,
  config: AdminOutlineLayerConfig,
  beforeLayerId?: string
): GeoJSON.FeatureCollection {
  if (!isBoundaryMapReady(map)) return polygons;
  return addAdminOutlineLayer(
    map!,
    polygons,
    adminOutlinePresetConfig(kind, config),
    beforeLayerId
  );
}

export function refreshAdminOutlineForPreset(
  map: BoundaryMapLike | null | undefined,
  polygons: GeoJSON.FeatureCollection,
  config: Pick<AdminOutlineLayerConfig, 'polygonSourceId' | 'lineSourceId'>,
  options?: { fallbackToInput?: boolean }
): GeoJSON.FeatureCollection | null {
  const refreshed = refreshAdminOutlineData(map, polygons, config);
  if (options?.fallbackToInput && refreshed == null) return polygons;
  return refreshed;
}

export function setPlaceLineOpacity(
  map: BoundaryMapLike | null | undefined,
  lineLayerId: string,
  opacity: number
): void {
  if (!map?.getLayer?.(lineLayerId)) return;
  map.setPaintProperty?.(lineLayerId, 'line-opacity', opacity <= 0 ? 0 : 1);
}

export function ensurePlaceBoundaries(
  map: BoundaryMapLike | null | undefined,
  cities: GeoJSON.FeatureCollection,
  config: AdminOutlineLayerConfig,
  beforeLayerId?: string,
  lineOpacity = 1
): GeoJSON.FeatureCollection {
  if (!isBoundaryMapReady(map)) return cities;

  const resolved = adminOutlinePresetConfig('place', config);

  if (!map!.getSource?.(resolved.polygonSourceId)) {
    addAdminOutlineLayer(map!, cities, resolved, beforeLayerId);
    setPlaceLineOpacity(map, resolved.lineLayerId, lineOpacity);
    return cities;
  }

  refreshAdminOutlineForPreset(map, cities, resolved, { fallbackToInput: true });
  setPlaceLineOpacity(map, resolved.lineLayerId, lineOpacity);
  return cities;
}

export type CountyBoundaryConfig = AdminOutlineBoundaryConfig;
export type StateBoundaryConfig = AdminOutlineBoundaryConfig;
export type PlaceBoundaryConfig = AdminOutlineBoundaryConfig;

export const applyCountyLinePaint = applyAdminOutlineLinePaint;
export const applyStateLinePaint = applyAdminOutlineLinePaint;
export const applyPlaceLinePaint = applyAdminOutlineLinePaint;
export const removeCountyBoundaries = removeAdminOutlineLayer;
export const removeStateBoundaries = removeAdminOutlineLayer;
export const removePlaceBoundaries = removeAdminOutlineLayer;

export const addCountyBoundaries = (
  map: BoundaryMapLike | null | undefined,
  counties: GeoJSON.FeatureCollection,
  config: CountyBoundaryConfig,
  beforeLayerId?: string
) => addAdminOutlineForPreset('county', map, counties, config, beforeLayerId);

export const addStateBoundaries = (
  map: BoundaryMapLike | null | undefined,
  states: GeoJSON.FeatureCollection,
  config: StateBoundaryConfig,
  beforeLayerId?: string
) => addAdminOutlineForPreset('state', map, states, config, beforeLayerId);

export const refreshCountyBoundaries = (
  map: BoundaryMapLike | null | undefined,
  counties: GeoJSON.FeatureCollection,
  config: Pick<CountyBoundaryConfig, 'polygonSourceId' | 'lineSourceId'>
) => refreshAdminOutlineForPreset(map, counties, config);

export const refreshStateBoundaries = refreshCountyBoundaries;

export const refreshPlaceBoundaries = (
  map: BoundaryMapLike | null | undefined,
  cities: GeoJSON.FeatureCollection,
  config: Pick<PlaceBoundaryConfig, 'polygonSourceId' | 'lineSourceId'>
) => refreshAdminOutlineForPreset(map, cities, config, { fallbackToInput: true })!;
