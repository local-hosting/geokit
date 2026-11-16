/**
 * Sync helpers for shared point layer sets (source + glow + point + hover + selection).
 */

import type { FeatureCollection, Point } from 'geojson';
import type { MapInstance } from '../../providers/types';
import { updateSourceData } from '../map-surface/map-utils';
import {
  annotatePointFeaturesFloatingBadgeHover,
  applySharedPointLayerPaint,
  attachSharedPointHoverGlowRadiusSync,
  paintColorFromProperty,
  sharedPointFloatingBadgeSelectedRadiusExpression,
  sharedPointRadiusPlusStrokeWidth,
  sharedPointStrokeColorExpression,
  sharedPointStrokeWidthExpression,
  SHARED_POINT_DEFAULT_GLOW_HOVER_OPACITY,
  SHARED_POINT_GLOW_BLUR,
  SHARED_POINT_GLOW_HIT_AREA_SCALE,
  SHARED_POINT_UNIFORM_GLOW_OPACITY,
  type ApplySharedPointPaintOptions,
  type SharedPointFeatureStateHoverOptions,
  type SharedPointLayerIds,
  SHARED_POINT_FLOATING_BADGE_FALLBACK_COLOR,
} from '../paint/shared-point-paint';
import {
  applyFloatingBadgeMarkerStackPaint,
  buildFloatingBadgeStack,
  ensureFloatingBadgeMarkerStack,
  syncFloatingBadgeStackFilters,
} from '../markers/marker-stack';

function geojsonWithFloatingBadgeHoverColors(
  geojson: FeatureCollection,
  paint: {
    selectionGroundBadge?: boolean;
    selectionGroundBadgeFallbackColor?: string;
    selectedDarken?: number;
  }
): FeatureCollection {
  if (!paint.selectionGroundBadge) return geojson;
  return annotatePointFeaturesFloatingBadgeHover(geojson as FeatureCollection<Point>, {
    fallbackColor: paint.selectionGroundBadgeFallbackColor?.trim() || SHARED_POINT_FLOATING_BADGE_FALLBACK_COLOR,
    selectedAmount: paint.selectedDarken,
  });
}

function shouldApplyFeatureStateHoverGlow(
  useFeatureStateHover: boolean,
  paint: { skipFeatureStateHoverGlow?: boolean; selectionGroundBadge?: boolean }
): boolean {
  return (
    useFeatureStateHover &&
    !paint.skipFeatureStateHoverGlow &&
    !paint.selectionGroundBadge
  );
}
import { ensureSharedPointLayerSetHealed } from './shared-point-heal';
import {
  applyEmbedScaleToSharedPointLayerOptions,
  COMPACT_EMBED_GLOW_BLUR,
  COMPACT_EMBED_MIN_RADIUS_PX,
} from '../map-surface/embed-point-scale';

function resolveCompactGlowBlur(
  compactPoints?: boolean,
  glowBlur?: number | unknown[]
): number | unknown[] | undefined {
  if (glowBlur != null) return glowBlur;
  return compactPoints ? COMPACT_EMBED_GLOW_BLUR : undefined;
}

function applySharedPointGlowBlur(
  map: MapInstance,
  glowLayerId: string,
  glowBlur: number | unknown[]
): void {
  if (!map.getLayer?.(glowLayerId)) return;
  try {
    map.setPaintProperty?.(glowLayerId, 'circle-blur', glowBlur);
  } catch {
    // ignore
  }
}

/** Layer paint config passed through to createSharedPointLayers (layer-styles). */
export interface SharedPointLayerPaintConfig {
  circleColor: string | unknown[];
  circleOpacity: number | unknown[];
  circleStrokeColor: string | unknown[];
  circleStrokeWidth: number | unknown[];
  glowColor?: string | unknown[];
  glowOpacity: number | unknown[];
  glowHoverOpacity: number | unknown[];
  glowBlur: number | unknown[];
  pointRadius: unknown;
  glowRadius: unknown[];
  filter?: unknown[];
  beforeLayerId?: string;
  promoteId?: string;
  selectionRingColor?: string;
  selectionShadowColor?: string;
  selectionPointStrokeWidth?: number;
  outerStrokeColor?: string | unknown[];
  outerStrokeWidth?: number | unknown[];
  glowTranslate?: [number, number] | unknown[];
  glowPitchAlignment?: 'map' | 'viewport';
  glowPitchScale?: 'map' | 'viewport';
  pointTranslate?: [number, number] | unknown[];
  pointTranslateAnchor?: 'map' | 'viewport';
  hoverTranslate?: [number, number] | unknown[];
  selectedTranslate?: [number, number] | unknown[];
  selectionShadowTranslate?: [number, number] | unknown[];
  selectionGroundBadge?: boolean;
  selectionGroundBadgeFallbackColor?: string;
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
  return [...buildFloatingBadgeStack(ids).all];
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


/** True when source, glow, and point layers for a shared point set are all mounted. */
export function isSharedPointLayerSetComplete(
  map: MapInstance,
  ids: SharedPointLayerIds
): boolean {
  return (
    !!map.getSource?.(ids.sourceId) &&
    !!map.getLayer?.(ids.glowLayerId) &&
    !!map.getLayer?.(ids.pointLayerId)
  );
}

const DEFAULT_SHARED_POINT_LAYER_SET_WAIT_MS = 4_000;

function idleOnce(map: MapInstance): Promise<void> {
  return new Promise((resolve) => {
    if (typeof map.once === 'function') {
      map.once('idle', () => resolve());
      return;
    }
    setTimeout(resolve, 50);
  });
}

/** Wait for glow + point layers; re-run heal until the shared point set is complete. */
export async function waitForSharedPointLayerSetComplete(
  map: MapInstance,
  ids: SharedPointLayerIds,
  heal: () => void | Promise<void>,
  maxWaitMs = DEFAULT_SHARED_POINT_LAYER_SET_WAIT_MS
): Promise<boolean> {
  if (isSharedPointLayerSetComplete(map, ids)) return true;

  await heal();
  if (isSharedPointLayerSetComplete(map, ids)) return true;

  const deadline = Date.now() + maxWaitMs;
  while (Date.now() < deadline) {
    await idleOnce(map);
    if (isSharedPointLayerSetComplete(map, ids)) return true;
    await heal();
    if (isSharedPointLayerSetComplete(map, ids)) return true;
  }

  return isSharedPointLayerSetComplete(map, ids);
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

function buildFeatureStateHoverOptions(
  glowRadius: unknown[] | number,
  glowOpacity: number | unknown[],
  pointOpacity: number | unknown[],
  glowHoverOpacity: number
): SharedPointFeatureStateHoverOptions {
  return { glowRadius, glowOpacity, pointOpacity, glowHoverOpacity };
}

export interface CreateSharedPointLayerSetOptions extends SharedPointLayerPaintConfig {
  ids: SharedPointLayerIds;
  geojson: FeatureCollection;
  mapProvider?: string | null;
  useMapTilerPointHelper?: boolean;
  /** When true, glow/point layers respond to feature-state hover from setupHoverLayers. Default true. */
  useFeatureStateHover?: boolean;
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
    useFeatureStateHover = true,
    ...layerConfig
  } = options;

  const useHelper =
    useMapTilerPointHelper ?? (mapProvider === 'maptiler' && isMapTilerPointHelperAvailable());

  const { createSharedPointLayers } = await import('../layers/styles/index');

  createSharedPointLayers({
    map,
    sourceId,
    glowLayerId,
    pointLayerId,
    useFeatureStateHover,
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
  useFeatureStateHover?: boolean;
  glowHoverOpacity?: number;
  glowHitAreaScale?: number;
  pointOpacity?: number | unknown[];
  compactPoints?: boolean;
  embedPointScale?: number;
  referenceHeightPx?: number;
  glowBlur?: number | unknown[];
  /** Recreate missing glow/point layers when the set is incomplete. Default true. */
  healIncompleteLayerSet?: boolean;
  promoteId?: string;
  mapProvider?: string | null;
  useMapTilerPointHelper?: boolean;
  selectionRingColor?: string;
  selectionShadowColor?: string;
  selectionPointStrokeWidth?: number;
  layerSetWaitMs?: number;
}

/** Update data + paint on an existing shared point layer set. */
export async function syncExistingSharedPointLayers(
  options: SyncExistingSharedPointLayersOptions
): Promise<boolean> {
  const {
    map,
    ids,
    geojson,
    paint,
    updateOptions,
    useFeatureStateHover = true,
    glowHoverOpacity = SHARED_POINT_DEFAULT_GLOW_HOVER_OPACITY,
    glowHitAreaScale = SHARED_POINT_GLOW_HIT_AREA_SCALE,
    pointOpacity = 0.95,
    compactPoints,
    embedPointScale,
    referenceHeightPx,
    glowBlur,
  } = options;
  const scaled = applyEmbedScaleToSharedPointLayerOptions({
    map,
    paint,
    glowHitAreaScale,
    compactPoints,
    embedPointScale,
    referenceHeightPx,
  });
  const resolvedGlowBlur = resolveCompactGlowBlur(
    compactPoints,
    paint.glowBlur ?? glowBlur
  );
  const healIncompleteLayerSet = options.healIncompleteLayerSet !== false;
  const annotatedGeojson = geojsonWithFloatingBadgeHoverColors(geojson, paint);
  const ok = await updateSharedPointSourceData(
    map,
    ids.sourceId,
    annotatedGeojson,
    updateOptions
  );

  if (healIncompleteLayerSet && !isSharedPointLayerSetComplete(map, ids)) {
    await createSharedPointLayersFromPaint({
      map,
      ids,
      geojson: annotatedGeojson,
      paint,
      circleOpacity: pointOpacity,
      glowHoverOpacity,
      glowBlur,
      glowHitAreaScale,
      compactPoints,
      embedPointScale,
      referenceHeightPx,
      promoteId: options.promoteId,
      mapProvider: options.mapProvider,
      useMapTilerPointHelper: options.useMapTilerPointHelper,
      useFeatureStateHover,
      selectionRingColor: options.selectionRingColor,
      selectionShadowColor: options.selectionShadowColor,
      selectionPointStrokeWidth: options.selectionPointStrokeWidth,
      layerSetWaitMs: options.layerSetWaitMs,
    });
  }

  if (ok || map.getSource?.(ids.sourceId)) {
    const applyHoverGlow = shouldApplyFeatureStateHoverGlow(
      useFeatureStateHover,
      scaled.paint
    );
    let featureStateHover: SharedPointFeatureStateHoverOptions | undefined;
    if (applyHoverGlow) {
      const { getGlowRadiusInterpolation } = await getLayerStylesModule();
      featureStateHover = buildFeatureStateHoverOptions(
        getGlowRadiusInterpolation({
          scale: scaled.glowHitAreaScale,
          ...(compactPoints ? { minRadiusPx: COMPACT_EMBED_MIN_RADIUS_PX } : {}),
        }),
        scaled.paint.glowOpacity ?? SHARED_POINT_UNIFORM_GLOW_OPACITY,
        pointOpacity,
        glowHoverOpacity
      );
    }
    await ensureSharedPointLayerSetHealed(map, ids, {
      paint: scaled.paint,
      selectionRingColor: options.selectionRingColor,
      selectionPointStrokeWidth: options.selectionPointStrokeWidth,
      glowColorFallback: SHARED_POINT_FLOATING_BADGE_FALLBACK_COLOR,
      glowHoverOpacity,
      useFeatureStateHover: applyHoverGlow,
      pointOpacity,
      glowHitAreaScale: scaled.glowHitAreaScale,
    });

    applyFloatingBadgeMarkerStackPaint(map, ids, scaled.paint, applySharedPointLayerPaint);
    // Prefer paint zoom-scaled blur; only fall back to compact numeric blur when paint omits it.
    if (scaled.paint.glowBlur == null && resolvedGlowBlur != null) {
      applySharedPointGlowBlur(map, ids.glowLayerId, resolvedGlowBlur);
    }
    await ensureFloatingBadgeChrome(map, ids, scaled.paint);
    await attachSharedPointHoverAfterMount(map, ids, {
      promoteId: options.promoteId,
      paint: scaled.paint,
      glowHoverOpacity,
      pointOpacity,
    });
  }
  return ok;
}

export { applySharedPointLayerPaint, attachSharedPointHoverGlowRadiusSync };

async function importLayerStylesModule() {
  return import('../layers/styles/index');
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
  glowBlur?: number | unknown[];
  glowHitAreaScale?: number;
  selectionRingColor?: string;
  selectionShadowColor?: string;
  selectionPointStrokeWidth?: number;
  promoteId?: string;
  mapProvider?: string | null;
  useMapTilerPointHelper?: boolean;
  useFeatureStateHover?: boolean;
  /** Shrink point/glow radii when the map container is shorter than the reference height. */
  compactPoints?: boolean;
  /** Explicit embed scale multiplier (overrides height detection). */
  embedPointScale?: number;
  referenceHeightPx?: number;
  /** Max wait for MapTiler async point + glow mount. Default 4000ms. Set 0 in unit tests. */
  layerSetWaitMs?: number;
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
    glowBlur,
    glowHitAreaScale = SHARED_POINT_GLOW_HIT_AREA_SCALE,
    selectionRingColor,
    selectionShadowColor,
    selectionPointStrokeWidth,
    promoteId,
    mapProvider,
    useMapTilerPointHelper,
    useFeatureStateHover = true,
    compactPoints,
    embedPointScale,
    referenceHeightPx,
  } = options;

  const scaled = applyEmbedScaleToSharedPointLayerOptions({
    map,
    paint,
    glowHitAreaScale,
    compactPoints,
    embedPointScale,
    referenceHeightPx,
  });
  const annotatedGeojson = geojsonWithFloatingBadgeHoverColors(geojson, paint);
  const resolvedGlowBlur =
    resolveCompactGlowBlur(compactPoints, scaled.paint.glowBlur ?? glowBlur) ??
    SHARED_POINT_GLOW_BLUR;
  const applyHoverGlow = shouldApplyFeatureStateHoverGlow(useFeatureStateHover, scaled.paint);

  const { getGlowRadiusInterpolation } = await getLayerStylesModule();
  const glowRadius =
    scaled.paint.glowRadiusExpression ??
    getGlowRadiusInterpolation({
      scale: scaled.glowHitAreaScale,
      ...(compactPoints ? { minRadiusPx: COMPACT_EMBED_MIN_RADIUS_PX } : {}),
    });
  const resolvedPointOpacity =
    typeof circleOpacity === 'number' || Array.isArray(circleOpacity) ? circleOpacity : 0.95;
  const strokeWidthExpression =
    scaled.paint.strokeWidthExpression ?? sharedPointStrokeWidthExpression();
  const strokeColorExpression =
    scaled.paint.strokeColorExpression ?? sharedPointStrokeColorExpression();
  const glowColorExpression = scaled.paint.glowColorExpression ?? paintColorFromProperty();
  const outerStrokeWidthExpression = scaled.paint.outerStrokeWidthExpression;
  const outerStrokeColorExpression = scaled.paint.outerStrokeColorExpression;

  const layerSetOptions = {
    ids,
    geojson: annotatedGeojson,
    mapProvider,
    useMapTilerPointHelper,
    useFeatureStateHover: applyHoverGlow,
    promoteId,
    circleColor: scaled.paint.pointColorExpression,
    circleOpacity,
    circleStrokeColor: strokeColorExpression,
    circleStrokeWidth: strokeWidthExpression,
    glowColor: glowColorExpression,
    glowOpacity: scaled.paint.glowOpacity ?? SHARED_POINT_UNIFORM_GLOW_OPACITY,
    glowHoverOpacity,
    glowBlur: resolvedGlowBlur,
    pointRadius: scaled.paint.pointRadiusExpression,
    glowRadius,
    selectionRingColor,
    selectionShadowColor,
    selectionPointStrokeWidth,
    ...(outerStrokeWidthExpression != null && outerStrokeColorExpression != null
      ? {
          outerStrokeWidth: outerStrokeWidthExpression,
          outerStrokeColor: outerStrokeColorExpression,
        }
      : {}),
    ...(scaled.paint.glowTranslate != null
      ? { glowTranslate: scaled.paint.glowTranslate }
      : {}),
    ...(scaled.paint.glowPitchAlignment != null
      ? { glowPitchAlignment: scaled.paint.glowPitchAlignment }
      : {}),
    ...(scaled.paint.glowPitchScale != null
      ? { glowPitchScale: scaled.paint.glowPitchScale }
      : {}),
    ...(scaled.paint.pointTranslate != null
      ? { pointTranslate: scaled.paint.pointTranslate }
      : {}),
    ...(scaled.paint.pointTranslateAnchor != null
      ? { pointTranslateAnchor: scaled.paint.pointTranslateAnchor }
      : {}),
    ...(scaled.paint.hoverTranslate != null
      ? { hoverTranslate: scaled.paint.hoverTranslate }
      : {}),
    ...(scaled.paint.selectedTranslate != null
      ? { selectedTranslate: scaled.paint.selectedTranslate }
      : {}),
    ...(scaled.paint.selectionShadowTranslate != null
      ? { selectionShadowTranslate: scaled.paint.selectionShadowTranslate }
      : {}),
    ...(scaled.paint.selectionGroundBadge
      ? { selectionGroundBadge: true }
      : {}),
    ...(scaled.paint.selectionGroundBadgeFallbackColor
      ? {
          selectionGroundBadgeFallbackColor: scaled.paint.selectionGroundBadgeFallbackColor,
        }
      : {}),
  };

  const healSharedPointLayerSet = async () => {
    const pointExists = !!map.getLayer?.(ids.pointLayerId);
    await createSharedPointLayerSet(map, {
      ...layerSetOptions,
      useMapTilerPointHelper: pointExists ? false : layerSetOptions.useMapTilerPointHelper,
    });
  };

  await createSharedPointLayerSet(map, layerSetOptions);
  await waitForSharedPointLayerSetComplete(
    map,
    ids,
    healSharedPointLayerSet,
    options.layerSetWaitMs ?? 4000
  );

  await ensureSharedPointLayerSetHealed(map, ids, {
    paint: scaled.paint,
    selectionRingColor,
    selectionPointStrokeWidth,
    glowColorFallback: SHARED_POINT_FLOATING_BADGE_FALLBACK_COLOR,
    glowHoverOpacity,
    useFeatureStateHover: applyHoverGlow,
    pointOpacity: resolvedPointOpacity,
    glowHitAreaScale: scaled.glowHitAreaScale,
  });

  applyFloatingBadgeMarkerStackPaint(
    map,
    ids,
    {
      ...scaled.paint,
      featureStateHover: applyHoverGlow
        ? buildFeatureStateHoverOptions(
            glowRadius,
            scaled.paint.glowOpacity ?? SHARED_POINT_UNIFORM_GLOW_OPACITY,
            resolvedPointOpacity,
            glowHoverOpacity
          )
        : undefined,
    },
    applySharedPointLayerPaint
  );

  await ensureFloatingBadgeChrome(map, ids, scaled.paint);

  // Layers may mount async (MapTiler helper) — re-attach after wait/heal so hits work.
  await attachSharedPointHoverAfterMount(map, ids, {
    promoteId,
    paint: scaled.paint,
    glowHoverOpacity,
    pointOpacity: resolvedPointOpacity,
  });
}

/** Ensure circle + rounded stacks via the floating-badge marker factory. */
async function ensureFloatingBadgeChrome(
  map: MapInstance,
  ids: SharedPointLayerIds,
  paint: ApplySharedPointPaintOptions
): Promise<void> {
  await ensureFloatingBadgeMarkerStack({
    map,
    ids,
    paint,
    setupCircleChrome: async (mapInstance, layerIds, paintConfig) => {
      const styles = await getLayerStylesModule();
      if (
        paintConfig.outerStrokeWidthExpression != null &&
        paintConfig.outerStrokeColorExpression != null &&
        typeof styles.setupSharedPointOuterStrokeLayer === 'function'
      ) {
        styles.setupSharedPointOuterStrokeLayer(mapInstance, layerIds.sourceId, layerIds.pointLayerId, {
          pointRadius: paintConfig.pointRadiusExpression ?? 4,
          coloredStrokeWidth: paintConfig.strokeWidthExpression ?? 0,
          outerStrokeWidth: paintConfig.outerStrokeWidthExpression,
          outerStrokeColor: paintConfig.outerStrokeColorExpression,
          outerStrokeOpacity: paintConfig.outerStrokeOpacity,
          pointTranslate: paintConfig.pointTranslate,
        });
      }
      if (
        paintConfig.glassRadiusExpression != null &&
        paintConfig.glassColorExpression != null &&
        typeof styles.setupSharedPointGlassLayer === 'function'
      ) {
        styles.setupSharedPointGlassLayer(mapInstance, layerIds.sourceId, layerIds.pointLayerId, {
          glassRadius: paintConfig.glassRadiusExpression,
          glassColor: paintConfig.glassColorExpression,
          glowColor: paintConfig.strokeColorExpression,
          pointRadius: paintConfig.pointRadiusExpression,
          ringWidth: paintConfig.strokeWidthExpression,
          glassOpacity: paintConfig.glassOpacity,
          glassBlur: paintConfig.glassBlur,
          pointTranslate: paintConfig.pointTranslate,
        });
      }
      if (typeof styles.setupSelectionGroundBadgeLayers === 'function') {
        styles.setupSelectionGroundBadgeLayers(mapInstance, layerIds.sourceId, layerIds.pointLayerId, {
          fallbackColor: paintConfig.selectionGroundBadgeFallbackColor,
        });
      }
      if (!mapInstance.setPaintProperty) return;
      for (const layerId of [
        layerIds.pointLayerId,
        `${layerIds.pointLayerId}-outer-stroke`,
        `${layerIds.pointLayerId}-glass`,
        `${layerIds.pointLayerId}-selection-badge`,
        `${layerIds.pointLayerId}-selection-badge-outer`,
      ]) {
        if (!mapInstance.getLayer?.(layerId)) continue;
        try {
          if (paintConfig.pointTranslateAnchor) {
            mapInstance.setPaintProperty(layerId, 'circle-translate-anchor', paintConfig.pointTranslateAnchor);
          }
        } catch {
          /* ignore */
        }
      }
      for (const layerId of [
        layerIds.pointLayerId,
        `${layerIds.pointLayerId}-outer-stroke`,
        `${layerIds.pointLayerId}-glass`,
      ]) {
        if (!mapInstance.getLayer?.(layerId) || paintConfig.pointTranslate == null) continue;
        try {
          mapInstance.setPaintProperty(layerId, 'circle-translate', paintConfig.pointTranslate);
        } catch {
          /* ignore */
        }
      }
      const sel = `${layerIds.pointLayerId}-selection-badge`;
      const selOuter = `${layerIds.pointLayerId}-selection-badge-outer`;
      try {
        if (mapInstance.getLayer?.(sel) && paintConfig.pointRadiusExpression != null) {
          const selectedRadius = sharedPointFloatingBadgeSelectedRadiusExpression(
            paintConfig.pointRadiusExpression as unknown[]
          );
          mapInstance.setPaintProperty(sel, 'circle-radius', selectedRadius);
          if (paintConfig.strokeWidthExpression != null) {
            mapInstance.setPaintProperty(sel, 'circle-stroke-width', paintConfig.strokeWidthExpression);
          }
          if (paintConfig.selectionFillExpression != null) {
            mapInstance.setPaintProperty(sel, 'circle-color', paintConfig.selectionFillExpression);
          }
          if (paintConfig.selectionStrokeColorExpression != null) {
            mapInstance.setPaintProperty(sel, 'circle-stroke-color', paintConfig.selectionStrokeColorExpression);
          }
        }
        if (mapInstance.getLayer?.(selOuter) && paintConfig.pointRadiusExpression != null) {
          const ring = paintConfig.strokeWidthExpression ?? 0;
          const selectedRadius = sharedPointFloatingBadgeSelectedRadiusExpression(
            paintConfig.pointRadiusExpression as unknown[]
          );
          mapInstance.setPaintProperty(
            selOuter,
            'circle-radius',
            sharedPointRadiusPlusStrokeWidth(selectedRadius, ring as number | unknown[])
          );
          if (paintConfig.outerStrokeWidthExpression != null) {
            mapInstance.setPaintProperty(selOuter, 'circle-stroke-width', paintConfig.outerStrokeWidthExpression);
          }
          if (paintConfig.selectionOuterStrokeColorExpression != null) {
            mapInstance.setPaintProperty(
              selOuter,
              'circle-stroke-color',
              paintConfig.selectionOuterStrokeColorExpression
            );
          }
        }
      } catch {
        /* style swap */
      }
    },
  });
}

async function attachSharedPointHoverAfterMount(
  map: MapInstance,
  ids: SharedPointLayerIds,
  options: {
    promoteId?: string;
    paint: ApplySharedPointPaintOptions;
    glowHoverOpacity: number;
    pointOpacity: number | unknown[];
  }
): Promise<void> {
  const styles = await getLayerStylesModule();
  const ensure = styles.ensureSharedPointHoverLayers;
  if (typeof ensure !== 'function') return;
  ensure(map, ids.sourceId, ids.glowLayerId, ids.pointLayerId, {
    glowRadius: options.paint.glowRadiusExpression ?? [],
    glowColor: options.paint.glowColorExpression ?? '#000000',
    glowBlur: options.paint.glowBlur ?? 0,
    glowHoverOpacity: options.glowHoverOpacity,
    circleColor: options.paint.pointColorExpression ?? '#ffffff',
    pointRadius: options.paint.pointRadiusExpression ?? 4,
    promoteId: options.promoteId,
    selectionGroundBadge: options.paint.selectionGroundBadge,
    selectionGroundBadgeFallbackColor: options.paint.selectionGroundBadgeFallbackColor,
    selectionPointStrokeWidth: 0,
    selectionRingColor: undefined,
    floatTranslate: options.paint.pointTranslate,
    hoverTranslate: options.paint.hoverTranslate,
    selectedTranslate: options.paint.selectedTranslate,
  });
  syncFloatingBadgeStackFilters(map, ids, options.promoteId);
}
