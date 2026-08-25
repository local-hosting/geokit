/**
 * Boundary outline controller — state + optional county lines with injected loaders.
 */

import type { FeatureCollection } from 'geojson';
import { assertBoundaryLayerOrder } from './boundary-map';

export interface BoundaryOutlineMap {
  getZoom?(): number;
  getSource?(id: string): unknown;
  getLayer?(id: string): unknown;
  on?(event: string, handler: () => void): void;
  off?(event: string, handler: () => void): void;
}

export interface StateBoundaryMountResult {
  polygonSourceId: string;
  lineLayerId: string;
}

export interface CountyBoundaryMountResult {
  polygonSourceId: string;
  lineLayerId: string;
}

export interface BoundaryOutlineControllerDeps {
  addStateBoundaries: (
    map: BoundaryOutlineMap,
    states: FeatureCollection,
    config: unknown,
    beforeLayerId?: string
  ) => FeatureCollection;
  removeStateBoundaries: (map: BoundaryOutlineMap, config: unknown) => void;
  applyStateLinePaint: (map: BoundaryOutlineMap, config: unknown) => void;
  refreshStateBoundaries: (
    map: BoundaryOutlineMap,
    states: FeatureCollection,
    config: unknown
  ) => FeatureCollection | null;
  addCountyBoundaries: (
    map: BoundaryOutlineMap,
    counties: FeatureCollection,
    config: unknown,
    beforeLayerId?: string
  ) => void;
  removeCountyBoundaries: (map: BoundaryOutlineMap, config: unknown) => void;
  stateConfig: unknown;
  countyConfig: unknown;
  countyMinZoom: number;
  loadStates: () => Promise<FeatureCollection | null>;
  loadCounties: () => Promise<FeatureCollection | null>;
  findInsertBefore?: (map: BoundaryOutlineMap) => string | undefined;
  stackBoundaryLayers?: (map: BoundaryOutlineMap) => void;
  countiesEnabled?: () => boolean;
  onStateDrawn?: (detail: Record<string, unknown>) => void;
  onCountyDrawn?: (detail: Record<string, unknown>) => void;
}

export function createBoundaryOutlineController(deps: BoundaryOutlineControllerDeps) {
  let isLayerCreated = false;
  let countiesLoaded = false;
  let cleanupZoomListener: (() => void) | null = null;
  let boundaryMap: BoundaryOutlineMap | null = null;

  function removeBoundaryLayers(map: BoundaryOutlineMap): void {
    deps.removeStateBoundaries(map, deps.stateConfig);
    deps.removeCountyBoundaries(map, deps.countyConfig);
  }

  async function ensureCountyBoundaries(
    map: BoundaryOutlineMap,
    anchorBeforeId: string | undefined
  ): Promise<void> {
    if (deps.countiesEnabled && !deps.countiesEnabled()) return;
    if (countiesLoaded || !map) return;
    const zoom = map.getZoom?.() ?? 0;
    if (zoom < deps.countyMinZoom) return;

    const counties = await deps.loadCounties();
    if (!counties?.features?.length || !map) return;
    const countyConfig = deps.countyConfig as { polygonSourceId?: string };
    if (countyConfig.polygonSourceId && map.getSource?.(countyConfig.polygonSourceId)) {
      countiesLoaded = true;
      return;
    }

    deps.addCountyBoundaries(map, counties, deps.countyConfig, anchorBeforeId);
    const countyCfg = deps.countyConfig as { lineLayerId?: string };
    const stateCfg = deps.stateConfig as { lineLayerId?: string };
    if (countyCfg.lineLayerId && stateCfg.lineLayerId) {
      assertBoundaryLayerOrder(map as never, [countyCfg.lineLayerId, stateCfg.lineLayerId]);
    }
    deps.stackBoundaryLayers?.(map);
    countiesLoaded = true;
    deps.onCountyDrawn?.({ features: counties.features.length, zoom });
  }

  async function loadBoundaryOutlines(gkMap: { getMap?: () => BoundaryOutlineMap | null }) {
    const map = gkMap.getMap?.();
    if (!map) return;
    boundaryMap = map;

    const states = await deps.loadStates();
    if (!map) return;

    if (isLayerCreated) {
      deps.applyStateLinePaint(map, deps.stateConfig);
      const stateCfg = deps.stateConfig as { polygonSourceId?: string };
      if (states?.features?.length && stateCfg.polygonSourceId && map.getSource?.(stateCfg.polygonSourceId)) {
        deps.refreshStateBoundaries(map, states, deps.stateConfig);
      }
      const anchorBeforeId = deps.findInsertBefore?.(map);
      await ensureCountyBoundaries(map, anchorBeforeId);
      return;
    }

    removeBoundaryLayers(map);
    const anchorBeforeId = deps.findInsertBefore?.(map);

    if (states?.features?.length) {
      const lines = deps.addStateBoundaries(map, states, deps.stateConfig, anchorBeforeId);
      deps.onStateDrawn?.({
        states: states.features.length,
        segments: lines.features.length,
      });
    }

    isLayerCreated = true;

    cleanupZoomListener?.();
    const onZoom = () => {
      void ensureCountyBoundaries(map, anchorBeforeId);
    };
    map.on?.('zoomend', onZoom);
    cleanupZoomListener = () => {
      map.off?.('zoomend', onZoom);
      cleanupZoomListener = null;
    };

    await ensureCountyBoundaries(map, anchorBeforeId);
  }

  function cleanup(): void {
    cleanupZoomListener?.();
    if (boundaryMap) removeBoundaryLayers(boundaryMap);
    boundaryMap = null;
    countiesLoaded = false;
    isLayerCreated = false;
  }

  return {
    loadBoundaryOutlines,
    cleanup,
    isLayerCreated: () => isLayerCreated,
  };
}

/** @deprecated use BoundaryOutlineMap */
export type AdminBoundaryOutlineMap = BoundaryOutlineMap;

/** @deprecated use BoundaryOutlineControllerDeps */
export type AdminBoundaryOutlineDeps = BoundaryOutlineControllerDeps;

/** @deprecated use createBoundaryOutlineController */
export const createAdminBoundaryOutlineController = createBoundaryOutlineController;

