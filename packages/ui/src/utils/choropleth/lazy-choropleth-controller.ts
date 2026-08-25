/**
 * Lazy choropleth fill layer — load on first show, visibility toggle, teardown.
 */

import type { FeatureCollection } from 'geojson';
import {
  createChoroplethFillLayer,
  removeChoroplethFillLayer,
  setChoroplethFillVisibility,
  type ChoroplethFillLayerMap,
  type ChoroplethFillLayerSpec,
} from './choropleth-fill-layer';

export type LazyChoroplethControllerOptions = {
  spec: ChoroplethFillLayerSpec;
  loadGeoJson: () => Promise<FeatureCollection | null>;
  resolveInsertBefore?: (map: ChoroplethFillLayerMap) => string | undefined;
  hiddenOpacity?: unknown;
};

export function createLazyChoroplethController(options: LazyChoroplethControllerOptions) {
  let layerCreated = false;
  let deferredMap: ChoroplethFillLayerMap | null = null;

  function removeLayers(map: ChoroplethFillLayerMap | null | undefined): void {
    if (!map) return;
    removeChoroplethFillLayer(map, options.spec);
    layerCreated = false;
  }

  function setVisibility(
    map: ChoroplethFillLayerMap | null | undefined,
    visible: boolean
  ): void {
    if (!map) return;
    setChoroplethFillVisibility(
      map,
      options.spec,
      visible,
      options.hiddenOpacity ?? 0
    );
  }

  async function loadIfNeeded(map: ChoroplethFillLayerMap): Promise<boolean> {
    deferredMap = map;
    if (layerCreated) return true;

    const geojson = await options.loadGeoJson();
    if (!geojson?.features?.length) return false;

    createChoroplethFillLayer(
      map,
      geojson,
      options.spec,
      options.resolveInsertBefore?.(map)
    );
    layerCreated = true;
    return true;
  }

  async function ensureLoaded(map: ChoroplethFillLayerMap, visible: boolean): Promise<void> {
    deferredMap = map;
    if (!visible) return;
    await loadIfNeeded(map);
  }

  async function onVisibilityChange(
    map: ChoroplethFillLayerMap | null | undefined,
    visible: boolean
  ): Promise<void> {
    if (!map) return;

    if (visible && !layerCreated) {
      await loadIfNeeded(map);
      setVisibility(map, true);
      return;
    }

    if (!visible && layerCreated) {
      try {
        if (map.getLayer?.(options.spec.fillLayerId)) {
          map.setPaintProperty?.(options.spec.fillLayerId, 'fill-opacity', 0);
        }
      } catch {
        /* ignore */
      }
      removeLayers(map);
      return;
    }

    setVisibility(map, visible);
  }

  function cleanup(map?: ChoroplethFillLayerMap | null): void {
    removeLayers(map ?? deferredMap);
    deferredMap = null;
  }

  return {
    isLayerCreated: () => layerCreated,
    ensureLoaded,
    onVisibilityChange,
    setVisibility,
    cleanup,
  };
}
