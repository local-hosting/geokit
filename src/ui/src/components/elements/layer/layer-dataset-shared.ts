import type { CellLayerId } from '@local-hosting/geokit/core/types/cell-layers.types';
import { bindDebouncedMapMoveend } from '@local-hosting/geokit/ui/geojson-loader';
import { mapViewportBounds } from '@local-hosting/geokit/h3';
import {
  stackGkOutlineLayersAboveDatasetFill,
  findInsertBeforeLayer,
} from '../../../utils/layer-stack';
import type {
  LayerDatasetContext,
  LayerDatasetHandle,
  LayerDatasetOptions,
} from './layer-datasets';

export type LayerDatasetMap = NonNullable<LayerDatasetContext['map']>;

export type OutlineLayerConfig = {
  polygonSourceId: string;
  lineSourceId: string;
  fillLayerId: string;
  lineLayerId: string;
  lineColor?: string | unknown[];
  lineWidth?: number | unknown[];
  minzoom?: number;
  lineMinzoom?: number;
  fillColor?: string | unknown[];
  fillOpacity?: number;
};

const DATASET_ANCHOR_PREFIXES = ['gk-dataset-'] as const;

export function isDatasetAnchorLayer(layerId: string): boolean {
  return DATASET_ANCHOR_PREFIXES.some((prefix) => layerId.startsWith(prefix));
}

export function findDatasetAnchorBeforeId(map: LayerDatasetMap): string | undefined {
  return findInsertBeforeLayer(map, {
    matchLayer: (layer) => isDatasetAnchorLayer(layer.id ?? ''),
  });
}

export function resolveDatasetBeforeLayerId(
  map: LayerDatasetMap,
  options: LayerDatasetOptions
): string | undefined {
  return options.beforeLayerId ?? findDatasetAnchorBeforeId(map);
}

export function mapDatasetZoom(map: LayerDatasetMap): number {
  return (map as { getZoom?: () => number }).getZoom?.() ?? 0;
}

export function waitForDatasetMapViewport(
  map: LayerDatasetMap,
  timeoutMs = 5000
): Promise<ReturnType<typeof mapViewportBounds>> {
  const immediate = mapViewportBounds(map);
  if (immediate) return Promise.resolve(immediate);

  return new Promise((resolve) => {
    let settled = false;
    const finish = (viewport: ReturnType<typeof mapViewportBounds>) => {
      if (settled) return;
      settled = true;
      map.off?.('idle', onIdle);
      map.off?.('render', onRender);
      clearTimeout(timer);
      resolve(viewport);
    };

    const tryViewport = () => {
      const viewport = mapViewportBounds(map);
      if (viewport) finish(viewport);
    };

    const onIdle = () => tryViewport();
    const onRender = () => tryViewport();

    map.once?.('idle', onIdle);
    map.on?.('render', onRender);

    const timer = setTimeout(() => finish(mapViewportBounds(map)), timeoutMs);
  });
}

export function dispatchLayerShardEvent(
  element: HTMLElement,
  detail: { cellId?: string; featureCount: number; layer: string }
): void {
  element.dispatchEvent(new CustomEvent('gk-layer-shard', { detail, bubbles: true }));
}

export function buildOutlineLayerConfig(
  ids: Pick<OutlineLayerConfig, 'polygonSourceId' | 'lineSourceId' | 'fillLayerId' | 'lineLayerId'>,
  options: LayerDatasetOptions,
  defaults: {
    lineColor: string;
    lineWidth: number | unknown[];
    minzoom?: number;
    lineMinzoom?: number;
  }
): OutlineLayerConfig {
  const minzoom = defaults.minzoom ?? options.minzoom;
  const lineMinzoom = defaults.lineMinzoom ?? minzoom;
  return {
    ...ids,
    lineColor: options.lineColor ?? options.outlineColor ?? defaults.lineColor,
    lineWidth: options.lineWidth ?? defaults.lineWidth,
    ...(minzoom != null ? { minzoom } : {}),
    ...(lineMinzoom != null ? { lineMinzoom } : {}),
    ...(options.fillColor ? { fillColor: options.fillColor } : {}),
    ...(options.fillOpacity != null ? { fillOpacity: options.fillOpacity } : {}),
  };
}

export type OutlineLayerOps = {
  add: (
    map: LayerDatasetMap,
    features: GeoJSON.FeatureCollection,
    config: OutlineLayerConfig,
    beforeLayerId?: string
  ) => void;
  applyPaint: (map: LayerDatasetMap, config: OutlineLayerConfig) => void;
  remove: (
    map: LayerDatasetMap,
    ids: Pick<OutlineLayerConfig, 'polygonSourceId' | 'lineSourceId' | 'fillLayerId' | 'lineLayerId'>
  ) => void;
  refresh?: (
    map: LayerDatasetMap,
    features: GeoJSON.FeatureCollection,
    config: Pick<OutlineLayerConfig, 'polygonSourceId' | 'lineSourceId'>
  ) => void;
};

export function bindOutlineViewportRefresh(
  map: LayerDatasetMap,
  loadFeatures: () => Promise<GeoJSON.FeatureCollection | null>,
  config: Pick<OutlineLayerConfig, 'polygonSourceId' | 'lineSourceId'>,
  ops: Pick<OutlineLayerOps, 'refresh'>,
  debounceMs = 400
): () => void {
  return bindDebouncedMapMoveend(
    map,
    async () => {
      const next = await loadFeatures();
      if (!next?.features.length || !ops.refresh) return;
      ops.refresh(map, next, config);
    },
    debounceMs
  );
}

export function attachOutlineLayers(
  map: LayerDatasetMap,
  features: GeoJSON.FeatureCollection,
  config: OutlineLayerConfig,
  ops: OutlineLayerOps,
  beforeLayerId?: string
): void {
  ops.add(map, features, config, beforeLayerId);
  ops.applyPaint(map, config);
  if (config.fillLayerId) {
    stackGkOutlineLayersAboveDatasetFill(map, config.fillLayerId);
  }
}

export function createOutlineLayerHandle(
  map: LayerDatasetMap,
  config: OutlineLayerConfig,
  remove: OutlineLayerOps['remove'],
  options?: { hitLayerIds?: string[]; cleanupExtra?: () => void }
): LayerDatasetHandle {
  return {
    sourceId: config.polygonSourceId,
    layerId: config.fillLayerId,
    hitLayerIds: options?.hitLayerIds,
    cleanup: () => {
      options?.cleanupExtra?.();
      remove(map, config);
    },
  };
}

export async function mountLoadedOutlineDataset(
  ctx: LayerDatasetContext,
  config: OutlineLayerConfig,
  loadFeatures: (ctx: LayerDatasetContext) => Promise<GeoJSON.FeatureCollection | null>,
  ops: OutlineLayerOps,
  handleOptions?: {
    hitLayerIds?: string[] | ((ctx: LayerDatasetContext) => string[] | undefined);
    cleanupExtra?: () => void;
    afterMount?: (ctx: LayerDatasetContext, config: OutlineLayerConfig) => (() => void) | void;
  }
): Promise<LayerDatasetHandle | null> {
  const { map, options } = ctx;
  const features = await loadFeatures(ctx);
  if (!features?.features?.length) return null;

  attachOutlineLayers(map, features, config, ops, resolveDatasetBeforeLayerId(map, options));

  const hitLayerIds =
    typeof handleOptions?.hitLayerIds === 'function'
      ? handleOptions.hitLayerIds(ctx)
      : handleOptions?.hitLayerIds;

  const afterMountCleanup = handleOptions?.afterMount?.(ctx, config);
  const cleanupExtra =
    afterMountCleanup != null
      ? () => {
          handleOptions?.cleanupExtra?.();
          afterMountCleanup();
        }
      : handleOptions?.cleanupExtra;

  return createOutlineLayerHandle(map, config, ops.remove, {
    hitLayerIds,
    cleanupExtra,
  });
}

export type CellLayerLoaderForViewport = {
  loadLayerForViewport: (options: {
    viewport: {
      bounds: NonNullable<ReturnType<typeof mapViewportBounds>>['bounds'];
      centerLat: number;
      centerLng: number;
      zoom: number;
    };
    layer: CellLayerId;
    target: Map<string, GeoJSON.Feature>;
    getFeatureId: (feature: GeoJSON.Feature) => string | null;
    onShardMerged?: (detail: { cellId: string; featureCount: number }) => void;
    replace?: boolean;
    loadedCellIds?: Set<string>;
  }) => Promise<{ requestedCells: number; loadedCells: number; features: number }>;
};

export async function loadCellLayerForViewport(options: {
  map: LayerDatasetMap;
  cellLoader: CellLayerLoaderForViewport;
  layer: CellLayerId;
  target: Map<string, GeoJSON.Feature>;
  loadedCellIds: Set<string>;
  getFeatureId: (feature: GeoJSON.Feature) => string | null;
  onShardMerged?: (detail: { cellId: string; featureCount: number }) => void;
  replace?: boolean;
}): Promise<{ requestedCells: number; loadedCells: number; features: number } | null> {
  const viewport = mapViewportBounds(options.map) ?? (await waitForDatasetMapViewport(options.map));
  if (!viewport?.bounds) return null;

  const zoom = mapDatasetZoom(options.map);
  return options.cellLoader.loadLayerForViewport({
    viewport: {
      bounds: viewport.bounds,
      centerLat: viewport.centerLat,
      centerLng: viewport.centerLng,
      zoom,
    },
    layer: options.layer,
    target: options.target,
    replace: options.replace ?? false,
    loadedCellIds: options.loadedCellIds,
    getFeatureId: options.getFeatureId,
    onShardMerged: options.onShardMerged,
  });
}
