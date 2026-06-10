/**
 * Shared helpers for gk-layer CDN dataset mounts.
 */

import { mapViewportBounds } from '../../../../utils/h3/map-viewport';
import type { CellLayerId } from '../../../../cdn/cell-layers';
import { bindDebouncedMapMoveend } from '../../../../cdn/viewport-shard-loader';
import {
  adminOutlinePreset,
  refreshAdminOutlineForPreset,
  type AdminOutlinePresetKind,
} from '../../../utils/admin-outline-preset';
import {
  stackGkOutlineLayersAboveDmaFill,
  findInsertBeforeLayer,
} from '../../../utils/layer-stack';
import type { AdminOutlineLayerConfig } from '../../../utils/admin-outline-layer';
import {
  defaultAdminColorMode,
  resolveAdminFillPaint,
  type AdminColorMode,
} from '../../../utils/admin-color-mode.js';
import type {
  LayerDatasetContext,
  LayerDatasetHandle,
  LayerDatasetOptions,
} from './layer-datasets';

export type LayerDatasetMap = NonNullable<LayerDatasetContext['map']>;

const DATASET_ANCHOR_PREFIXES = ['gk-dataset-', 'venues', 'platform-'] as const;

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

export type AdminOutlineLayerIds = Pick<
  AdminOutlineLayerConfig,
  'polygonSourceId' | 'lineSourceId' | 'fillLayerId' | 'lineLayerId'
>;

export async function applyAdminColorModeToConfig(
  config: AdminOutlineLayerConfig,
  options: LayerDatasetOptions,
  defaultMode: AdminColorMode | undefined,
  ctx: Pick<LayerDatasetContext, 'options' | 'getRequestInit'>
): Promise<AdminOutlineLayerConfig> {
  const colorMode = options.colorMode ?? defaultMode;
  const fill = await resolveAdminFillPaint({
    colorMode,
    fillOpacity: options.fillOpacity,
    cdnBase: options.cdnBase,
    getRequestInit: ctx.getRequestInit,
  });
  if (!fill) return config;
  return { ...config, fillColor: fill.fillColor, fillOpacity: fill.fillOpacity };
}

export function buildAdminOutlineConfig(
  ids: AdminOutlineLayerIds,
  options: LayerDatasetOptions,
  defaults: {
    lineColor: string;
    lineWidth: number | unknown[];
    minzoom?: number;
    lineMinzoom?: number;
  }
): AdminOutlineLayerConfig {
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

export type AdminOutlineLayerOps = {
  add: (
    map: LayerDatasetMap,
    features: GeoJSON.FeatureCollection,
    config: AdminOutlineLayerConfig,
    beforeLayerId?: string
  ) => void;
  applyPaint: (map: LayerDatasetMap, config: AdminOutlineLayerConfig) => void;
  remove: (map: LayerDatasetMap, config: AdminOutlineLayerIds) => void;
};

export type AdminOutlineDatasetPresetDef = {
  kind: AdminOutlinePresetKind;
  ids: AdminOutlineLayerIds;
  style: {
    lineColor: string;
    lineWidth: number | unknown[];
    minzoom?: number;
    lineMinzoom?: number;
  };
};

export type MountAdminOutlineHandleOptions = {
  hitLayerIds?: string[] | ((ctx: LayerDatasetContext) => string[] | undefined);
  cleanupExtra?: () => void;
  afterMount?: (ctx: LayerDatasetContext, config: AdminOutlineLayerConfig) => (() => void) | void;
};

export function buildPresetAdminOutlineConfig(
  preset: AdminOutlineDatasetPresetDef,
  options: LayerDatasetOptions
): AdminOutlineLayerConfig {
  return buildAdminOutlineConfig(preset.ids, options, preset.style);
}

export function bindAdminOutlineViewportRefresh(
  map: LayerDatasetMap,
  loadFeatures: () => Promise<GeoJSON.FeatureCollection | null>,
  config: Pick<AdminOutlineLayerConfig, 'polygonSourceId' | 'lineSourceId'>,
  debounceMs = 400
): () => void {
  return bindDebouncedMapMoveend(
    map,
    async () => {
      const next = await loadFeatures();
      if (!next?.features.length) return;
      refreshAdminOutlineForPreset(map, next, config);
    },
    debounceMs
  );
}

export function attachAdminOutlineLayers(
  map: LayerDatasetMap,
  features: GeoJSON.FeatureCollection,
  config: AdminOutlineLayerConfig,
  ops: AdminOutlineLayerOps,
  beforeLayerId?: string
): void {
  ops.add(map, features, config, beforeLayerId);
  ops.applyPaint(map, config);
  stackGkOutlineLayersAboveDmaFill(map);
}

export function createAdminOutlineHandle(
  map: LayerDatasetMap,
  config: AdminOutlineLayerConfig,
  remove: AdminOutlineLayerOps['remove'],
  options?: {
    hitLayerIds?: string[];
    cleanupExtra?: () => void;
  }
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

export async function mountLoadedAdminOutlineDataset(
  ctx: LayerDatasetContext,
  config: AdminOutlineLayerConfig,
  loadFeatures: (ctx: LayerDatasetContext) => Promise<GeoJSON.FeatureCollection | null>,
  ops: AdminOutlineLayerOps,
  handleOptions?: MountAdminOutlineHandleOptions
): Promise<LayerDatasetHandle | null> {
  const { map, options } = ctx;
  const features = await loadFeatures(ctx);
  if (!features?.features?.length) return null;

  attachAdminOutlineLayers(map, features, config, ops, resolveDatasetBeforeLayerId(map, options));

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

  return createAdminOutlineHandle(map, config, ops.remove, {
    hitLayerIds,
    cleanupExtra,
  });
}

export async function mountAdminOutlineDatasetPreset(
  ctx: LayerDatasetContext,
  preset: AdminOutlineDatasetPresetDef,
  loadFeatures: (ctx: LayerDatasetContext) => Promise<GeoJSON.FeatureCollection | null>,
  handleOptions?: MountAdminOutlineHandleOptions
): Promise<LayerDatasetHandle | null> {
  let config = buildPresetAdminOutlineConfig(preset, ctx.options);
  config = await applyAdminColorModeToConfig(
    config,
    ctx.options,
    defaultAdminColorMode(preset.kind),
    ctx
  );
  return mountLoadedAdminOutlineDataset(
    ctx,
    config,
    loadFeatures,
    adminOutlinePreset(preset.kind),
    handleOptions
  );
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
    replace: false,
    loadedCellIds: options.loadedCellIds,
    getFeatureId: options.getFeatureId,
    onShardMerged: options.onShardMerged,
  });
}
