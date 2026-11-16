/**
 * Heal glow + selection-ring layers after MapTiler helpers.addPoint skips them.
 */

import type { MapInstance } from '../../providers/types';
import type { ApplySharedPointPaintOptions, SharedPointLayerIds } from '../paint/shared-point-paint';
import {
  applySharedPointLayerPaint,
  paintColorFromProperty,
  SHARED_POINT_DEFAULT_GLOW_BLUR,
  SHARED_POINT_DEFAULT_GLOW_HOVER_OPACITY,
  SHARED_POINT_DEFAULT_GLOW_OPACITY,
  SHARED_POINT_GLOW_HIT_AREA_SCALE,
  SHARED_POINT_RADIUS_EXPRESSION,
  type SharedPointFeatureStateHoverOptions,
} from '../paint/shared-point-paint';
import { applyFloatingBadgeMarkerStackPaint } from '../markers/marker-stack';

const SHARED_POINT_GLOW_RADIUS_SCALE = 4;

export interface EnsureSharedPointLayerSetHealedOptions {
  paint?: ApplySharedPointPaintOptions;
  selectionRingColor?: string;
  selectionPointStrokeWidth?: number;
  glowColorFallback?: string;
  /** Hover glow opacity when feature-state hover paint is preserved during heal/resync. */
  glowHoverOpacity?: number;
  /** When false, heal applies static glow paint only. Default true. */
  useFeatureStateHover?: boolean;
  pointOpacity?: number | unknown[];
  glowHitAreaScale?: number;
  maxAttempts?: number;
  attemptDelayMs?: number;
  resyncOnStyleData?: boolean;
}

function selectionSourceId(sourceId: string): string {
  return `${sourceId}-selection`;
}

function selectionRingLayerId(pointLayerId: string): string {
  return `${pointLayerId}-selection-ring`;
}

export function isSharedPointLayerSetFullyComplete(
  map: MapInstance,
  ids: SharedPointLayerIds
): boolean {
  return (
    !!map.getSource?.(ids.sourceId) &&
    !!map.getLayer?.(ids.glowLayerId) &&
    !!map.getLayer?.(ids.pointLayerId) &&
    !!map.getSource?.(selectionSourceId(ids.sourceId)) &&
    !!map.getLayer?.(selectionRingLayerId(ids.pointLayerId))
  );
}

export function resolveSharedPointLayerIdForSource(
  map: MapInstance,
  sourceId: string
): string | undefined {
  const style = map.getStyle?.() as { layers?: Array<{ id?: string; source?: string; type?: string }> } | null | undefined;
  const layers = style?.layers;
  if (!Array.isArray(layers) || layers.length === 0) return undefined;
  for (const layer of layers) {
    if (
      layer.source === sourceId &&
      layer.type === 'circle' &&
      typeof layer.id === 'string' &&
      layer.id.endsWith('-points')
    ) {
      return layer.id;
    }
  }
  return undefined;
}

async function importLayerStyles() {
  return import('../layers/styles/index');
}

function readPointRadiusFromMap(map: MapInstance, pointLayerId: string): unknown[] {
  if (!map.getLayer?.(pointLayerId)) {
    return SHARED_POINT_RADIUS_EXPRESSION;
  }
  try {
    const getPaint = (map as { getPaintProperty?: (id: string, prop: string) => unknown }).getPaintProperty;
    const live = getPaint?.(pointLayerId, 'circle-radius');
    return Array.isArray(live) ? (live as unknown[]) : SHARED_POINT_RADIUS_EXPRESSION;
  } catch {
    return SHARED_POINT_RADIUS_EXPRESSION;
  }
}

function buildHealFeatureStateHover(
  glowRadius: unknown[] | number,
  options: EnsureSharedPointLayerSetHealedOptions
): SharedPointFeatureStateHoverOptions | undefined {
  if (options.useFeatureStateHover === false || !options.paint) return undefined;
  return {
    glowRadius,
    glowOpacity: options.paint.glowOpacity ?? SHARED_POINT_DEFAULT_GLOW_OPACITY,
    pointOpacity: options.pointOpacity ?? 0.95,
    glowHoverOpacity: options.glowHoverOpacity ?? SHARED_POINT_DEFAULT_GLOW_HOVER_OPACITY,
  };
}

export async function syncSharedPointGlowPaint(
  map: MapInstance,
  ids: SharedPointLayerIds,
  options: EnsureSharedPointLayerSetHealedOptions = {}
): Promise<boolean> {
  if (!map.getLayer?.(ids.glowLayerId) || !map.setPaintProperty) return false;

  const styles = await importLayerStyles();
  const glowHitAreaScale = options.glowHitAreaScale ?? SHARED_POINT_GLOW_HIT_AREA_SCALE;
  const glowRadius = styles.getGlowRadiusInterpolation({ scale: glowHitAreaScale });
  const glowBlur = options.paint?.glowBlur ?? SHARED_POINT_DEFAULT_GLOW_BLUR;
  const featureStateHover = buildHealFeatureStateHover(glowRadius, options);

  // Always prefer app paint (floating-badge shadow/stroke). Never clobber with default glow radius.
  if (options.paint) {
    applyFloatingBadgeMarkerStackPaint(
      map,
      ids,
      {
        ...options.paint,
        ids,
        ...(featureStateHover ? { featureStateHover } : {}),
        glowBlur,
      },
      applySharedPointLayerPaint
    );
    return true;
  }

  const glowColor = paintColorFromProperty('_color', options.glowColorFallback ?? '#888888');
  const healGlowRadius = styles.getGlowRadiusInterpolation({ scale: SHARED_POINT_GLOW_RADIUS_SCALE });
  const glowOpacity = SHARED_POINT_DEFAULT_GLOW_OPACITY;

  map.setPaintProperty(ids.glowLayerId, 'circle-radius', healGlowRadius);
  map.setPaintProperty(ids.glowLayerId, 'circle-color', glowColor);
  map.setPaintProperty(ids.glowLayerId, 'circle-opacity', glowOpacity);
  map.setPaintProperty(ids.glowLayerId, 'circle-blur', glowBlur);

  if (map.getLayer?.(ids.pointLayerId)) {
    const pointRadius = readPointRadiusFromMap(map, ids.pointLayerId);
    map.setPaintProperty(ids.pointLayerId, 'circle-radius', pointRadius);
  }

  return true;
}

function tryMountGlowLayer(
  map: MapInstance,
  ids: SharedPointLayerIds,
  options: EnsureSharedPointLayerSetHealedOptions
): boolean {
  if (map.getLayer?.(ids.glowLayerId)) return true;
  if (!map.getLayer?.(ids.pointLayerId) || !map.getSource?.(ids.sourceId) || !map.addLayer) {
    return false;
  }

  const glowColor =
    options.paint?.glowColorExpression ??
    paintColorFromProperty('_color', options.glowColorFallback ?? '#888888');

  try {
    map.addLayer(
      {
        id: ids.glowLayerId,
        type: 'circle',
        source: ids.sourceId,
        minzoom: 0,
        layout: { visibility: 'visible' },
        paint: {
          'circle-radius': SHARED_POINT_RADIUS_EXPRESSION,
          'circle-color': glowColor,
          'circle-opacity': options.paint?.glowOpacity ?? SHARED_POINT_DEFAULT_GLOW_OPACITY,
          'circle-blur': options.paint?.glowBlur ?? SHARED_POINT_DEFAULT_GLOW_BLUR,
        },
      } as never,
      ids.pointLayerId
    );
    return !!map.getLayer?.(ids.glowLayerId);
  } catch {
    return false;
  }
}

async function tryMountSelectionRing(
  map: MapInstance,
  ids: SharedPointLayerIds,
  options: EnsureSharedPointLayerSetHealedOptions
): Promise<boolean> {
  if (!map.getLayer?.(ids.pointLayerId)) return false;

  const styles = await importLayerStyles();
  const pointRadius =
    options.paint?.pointRadiusExpression ?? readPointRadiusFromMap(map, ids.pointLayerId);
  const strokeWidth = options.selectionPointStrokeWidth ?? 0;

  styles.ensureSharedPointSelectionRingLayer(
    map,
    ids.sourceId,
    ids.pointLayerId,
    options.selectionRingColor ?? '#ffffff',
    pointRadius,
    strokeWidth
  );

  return (
    !!map.getSource?.(selectionSourceId(ids.sourceId)) &&
    !!map.getLayer?.(selectionRingLayerId(ids.pointLayerId))
  );
}

function attachGlowStyleDataResync(
  map: MapInstance,
  ids: SharedPointLayerIds,
  options: EnsureSharedPointLayerSetHealedOptions
): void {
  if (options.resyncOnStyleData === false || !map.on || !map.off) return;

  let resyncs = 0;
  const onStyleData = () => {
    if (resyncs >= 8) {
      map.off?.('styledata', onStyleData);
      return;
    }
    void syncSharedPointGlowPaint(map, ids, options).then(ok => {
      if (ok) resyncs += 1;
    });
  };

  map.on('styledata', onStyleData);
  void syncSharedPointGlowPaint(map, ids, options);
}


export async function syncSharedPointSelectionRingPaint(
  map: MapInstance,
  ids: SharedPointLayerIds,
  options: EnsureSharedPointLayerSetHealedOptions = {}
): Promise<boolean> {
  if (!map.getLayer?.(ids.pointLayerId)) return false;
  const styles = await importLayerStyles();
  const pointRadius =
    options.paint?.pointRadiusExpression ?? readPointRadiusFromMap(map, ids.pointLayerId);
  styles.ensureSharedPointSelectionRingLayer(
    map,
    ids.sourceId,
    ids.pointLayerId,
    options.selectionRingColor ?? '#ffffff',
    pointRadius,
    options.selectionPointStrokeWidth ?? 0
  );
  return !!map.getLayer?.(selectionRingLayerId(ids.pointLayerId));
}

async function healOnce(
  map: MapInstance,
  ids: SharedPointLayerIds,
  options: EnsureSharedPointLayerSetHealedOptions
): Promise<boolean> {
  tryMountGlowLayer(map, ids, options);
  await tryMountSelectionRing(map, ids, options);
  await syncSharedPointSelectionRingPaint(map, ids, options);
  await syncSharedPointGlowPaint(map, ids, options);
  return isSharedPointLayerSetFullyComplete(map, ids);
}

export async function ensureSharedPointLayerSetHealed(
  map: MapInstance,
  ids: SharedPointLayerIds,
  options: EnsureSharedPointLayerSetHealedOptions = {}
): Promise<boolean> {
  const maxAttempts = options.maxAttempts ?? 40;
  const attemptDelayMs = options.attemptDelayMs ?? 100;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    if (await healOnce(map, ids, options)) {
      attachGlowStyleDataResync(map, ids, options);
      return true;
    }
    await new Promise(resolve => setTimeout(resolve, attemptDelayMs));
  }

  await healOnce(map, ids, options);
  attachGlowStyleDataResync(map, ids, options);
  return isSharedPointLayerSetFullyComplete(map, ids);
}
