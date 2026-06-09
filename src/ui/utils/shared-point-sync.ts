/**
 * Sync helpers for shared point layer sets (source + glow + point + hover + selection).
 */

import type { FeatureCollection } from 'geojson';
import type { MapInstance } from '../providers/types';
import { updateSourceData } from './map-utils';
import {
  applySharedPointLayerPaint,
  attachSharedPointHoverGlowRadiusSync,
  paintColorFromProperty,
  sharedPointStrokeColorExpression,
  sharedPointStrokeWidthExpression,
  SHARED_POINT_DEFAULT_GLOW_HOVER_OPACITY,
  SHARED_POINT_GLOW_BLUR,
  SHARED_POINT_GLOW_HIT_AREA_SCALE,
  SHARED_POINT_UNIFORM_GLOW_OPACITY,
  type ApplySharedPointPaintOptions,
  type SharedPointLayerIds,
} from './shared-point-paint';

/** Layer paint config passed through to createSharedPointLayers (layer-styles). */
export interface SharedPointLayerPaintConfig {
  circleColor: string | unknown[];
  circleOpacity: number | unknown[];
  circleStrokeColor: string | unknown[];
  circleStrokeWidth: number | unknown[];
  glowColor?: string | unknown[];
  glowOpacity: number | unknown[];
  glowHoverOpacity: number | unknown[];
  glowBlur: number;
  pointRadius: unknown;
  glowRadius: unknown[];
  filter?: unknown[];
  beforeLayerId?: string;
  promoteId?: string;
  selectionRingColor?: string;
}

export type { SharedPointLayerIds, ApplySharedPointPaintOptions };

export interface RemoveMapSourcesOptions {
  sourcePrefix: string;
  keepSourceId: string;
}

/** Remove layers and sources whose source id starts with prefix, except keepSourceId. */
export function removeMapSourcesWithPrefix(
  map: MapInstance,
  options: RemoveMapSourcesOptions
): void {
  const { sourcePrefix, keepSourceId } = options;
  const style = map.getStyle?.();
  const layers = style?.layers as Array<{ id: string; source?: string }> | undefined;

  if (Array.isArray(layers)) {
    for (const layer of layers) {
      const src = layer.source;
      if (typeof src === 'string' && src.startsWith(sourcePrefix) && src !== keepSourceId) {
        try {
          if (map.getLayer?.(layer.id)) map.removeLayer?.(layer.id);
        } catch {
          // ignore
        }
      }
    }
  }

  const sources = style?.sources as Record<string, unknown> | undefined;
  if (sources) {
    for (const id of Object.keys(sources)) {
      if (id.startsWith(sourcePrefix) && id !== keepSourceId) {
        try {
          if (map.getSource?.(id)) map.removeSource?.(id);
        } catch {
          // ignore
        }
      }
    }
  }
}

export function getSharedPointRelatedLayerIds(ids: SharedPointLayerIds): string[] {
  const { glowLayerId, pointLayerId } = ids;
  return [
    glowLayerId,
    pointLayerId,
    `${pointLayerId}-selection-ring`,
    `${glowLayerId}-hover`,
    `${pointLayerId}-hover`,
  ];
}

export function getSharedPointRelatedSourceIds(sourceId: string): string[] {
  return [sourceId, `${sourceId}-hover`, `${sourceId}-selection`];
}

/**
 * Tear down shared point layers/sources so they can be recreated with tolerance: 0.
 * Returns true when anything was removed.
 */
export function tearDownSharedPointLayers(map: MapInstance, ids: SharedPointLayerIds): boolean {
  if (!map.getSource?.(ids.sourceId)) return false;

  for (const layerId of getSharedPointRelatedLayerIds(ids)) {
    try {
      if (map.getLayer?.(layerId)) map.removeLayer?.(layerId);
    } catch {
      // ignore
    }
  }

  for (const srcId of getSharedPointRelatedSourceIds(ids.sourceId)) {
    try {
      if (map.getSource?.(srcId)) map.removeSource?.(srcId);
    } catch {
      // ignore
    }
  }

  return true;
}

export function isMapTilerPointHelperAvailable(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof (window as Window & { maptilersdk?: { helpers?: { addPoint?: unknown } } }).maptilersdk
      ?.helpers?.addPoint === 'function'
  );
}

/** Create a GeoJSON source with tolerance: 0 so points are not dropped at low zoom. */
export function ensureSharedPointGeoJsonSource(
  map: MapInstance,
  sourceId: string,
  geojson: FeatureCollection,
  promoteId: string
): void {
  if (map.getSource?.(sourceId)) return;
  map.addSource?.(sourceId, {
    type: 'geojson',
    data: geojson,
    promoteId,
    tolerance: 0,
  });
}

export interface UpdateSharedPointSourceOptions {
  /** Defer setData via requestIdleCallback when feature count exceeds this threshold. */
  largeListThreshold?: number;
  idleTimeoutMs?: number;
}

/** Update shared point source data, optionally deferring for large lists. */
export async function updateSharedPointSourceData(
  map: MapInstance,
  sourceId: string,
  geojson: FeatureCollection,
  options: UpdateSharedPointSourceOptions = {}
): Promise<boolean> {
  const threshold = options.largeListThreshold ?? 500;
  const idleTimeoutMs = options.idleTimeoutMs ?? 100;

  let payload = geojson;
  if (geojson.features.length >= threshold) {
    payload = await new Promise<FeatureCollection>((resolve) => {
      const deliver = () => resolve(geojson);
      if (typeof requestIdleCallback === 'function') {
        requestIdleCallback(deliver, { timeout: idleTimeoutMs });
      } else {
        setTimeout(deliver, 0);
      }
    });
  }

  return updateSourceData(map, sourceId, payload);
}

export interface CreateSharedPointLayerSetOptions extends SharedPointLayerPaintConfig {
  ids: SharedPointLayerIds;
  geojson: FeatureCollection;
  mapProvider?: string | null;
  useMapTilerPointHelper?: boolean;
}

/**
 * Create glow + point + hover + selection layers for a shared point source.
 * Source should already exist (see ensureSharedPointGeoJsonSource).
 */
export async function createSharedPointLayerSet(
  map: MapInstance,
  options: CreateSharedPointLayerSetOptions
): Promise<void> {
  const {
    ids: { sourceId, glowLayerId, pointLayerId },
    geojson,
    mapProvider,
    useMapTilerPointHelper,
    ...layerConfig
  } = options;

  const useHelper =
    useMapTilerPointHelper ?? (mapProvider === 'maptiler' && isMapTilerPointHelperAvailable());

  const { createSharedPointLayers } = await import('./layer-styles');

  createSharedPointLayers({
    map,
    sourceId,
    glowLayerId,
    pointLayerId,
    useFeatureStateHover: false,
    ...(useHelper ? { useMapTilerPointHelper: true, geojson } : {}),
    ...layerConfig,
  });
}

export interface SyncExistingSharedPointLayersOptions {
  map: MapInstance;
  ids: SharedPointLayerIds;
  geojson: FeatureCollection;
  paint: ApplySharedPointPaintOptions;
  updateOptions?: UpdateSharedPointSourceOptions;
}

/** Update data + paint on an existing shared point layer set. */
export async function syncExistingSharedPointLayers(
  options: SyncExistingSharedPointLayersOptions
): Promise<boolean> {
  const { map, ids, geojson, paint, updateOptions } = options;
  const ok = await updateSharedPointSourceData(map, ids.sourceId, geojson, updateOptions);
  if (ok) {
    applySharedPointLayerPaint(map, paint);
  }
  return ok;
}

export { applySharedPointLayerPaint, attachSharedPointHoverGlowRadiusSync };

async function importLayerStylesModule() {
  return import('./layer-styles');
}

type LayerStylesModule = Awaited<ReturnType<typeof importLayerStylesModule>>;
let layerStylesModule: LayerStylesModule | null = null;
let layerStylesLoading: Promise<LayerStylesModule> | null = null;

/** Pre-warm layer-styles during idle time (lazy-loaded ~300KB module). */
export function preloadSharedPointLayerStyles(): void {
  if (layerStylesModule || layerStylesLoading) return;
  layerStylesLoading = importLayerStylesModule().then((m) => {
    layerStylesModule = m;
    return m;
  });
}

async function getLayerStylesModule(): Promise<LayerStylesModule> {
  if (layerStylesModule) return layerStylesModule;
  if (!layerStylesLoading) preloadSharedPointLayerStyles();
  return layerStylesLoading!;
}

export interface CreateSharedPointLayersFromPaintOptions {
  map: MapInstance;
  ids: SharedPointLayerIds;
  geojson: FeatureCollection;
  paint: ApplySharedPointPaintOptions;
  circleOpacity?: number | unknown[];
  glowHoverOpacity?: number;
  glowBlur?: number;
  glowHitAreaScale?: number;
  selectionRingColor?: string;
  promoteId?: string;
  mapProvider?: string | null;
  useMapTilerPointHelper?: boolean;
}

/**
 * Create glow + point + hover + selection layers from app paint config.
 * Apps own feature properties (_color, brand, ratings); geokit owns layer structure and sync.
 */
export async function createSharedPointLayersFromPaint(
  options: CreateSharedPointLayersFromPaintOptions
): Promise<void> {
  const {
    map,
    ids,
    geojson,
    paint,
    circleOpacity = 0.95,
    glowHoverOpacity = SHARED_POINT_DEFAULT_GLOW_HOVER_OPACITY,
    glowBlur = SHARED_POINT_GLOW_BLUR,
    glowHitAreaScale = SHARED_POINT_GLOW_HIT_AREA_SCALE,
    selectionRingColor,
    promoteId,
    mapProvider,
    useMapTilerPointHelper,
  } = options;

  const { getGlowRadiusInterpolation } = await getLayerStylesModule();
  const glowRadius = getGlowRadiusInterpolation({ scale: glowHitAreaScale });
  const strokeWidthExpression = paint.strokeWidthExpression ?? sharedPointStrokeWidthExpression();
  const strokeColorExpression = paint.strokeColorExpression ?? sharedPointStrokeColorExpression();
  const glowColorExpression = paint.glowColorExpression ?? paintColorFromProperty();

  await createSharedPointLayerSet(map, {
    ids,
    geojson,
    mapProvider,
    useMapTilerPointHelper,
    promoteId,
    circleColor: paint.pointColorExpression,
    circleOpacity,
    circleStrokeColor: strokeColorExpression,
    circleStrokeWidth: strokeWidthExpression,
    glowColor: glowColorExpression,
    glowOpacity: paint.glowOpacity ?? SHARED_POINT_UNIFORM_GLOW_OPACITY,
    glowHoverOpacity,
    glowBlur,
    pointRadius: paint.pointRadiusExpression,
    glowRadius,
    selectionRingColor,
  });

  applySharedPointLayerPaint(map, paint);
}
