/** Selection state, lookups, and setters. */
import type { MapInstance } from '../../../../providers/types';
import type { Feature } from '@local-hosting/geokit/core/types';
import { getFeatureId } from '@local-hosting/geokit/core/geojson';
import { getCSSVariable, getCSSVariableNumber } from '../../../map-surface/theme';
import { debug } from '../../../map-surface/logger';
import { HOVER_CONFIG, type HoverStateHandlers } from '../../../map-surface/feature-state-hover';
import {
  buildSharedPointFeatureStateHoverPaint,
  expandInterpolateCaseMultiply,
  literalNumberFromPaintExpression,
  resolveSharedPointFloatingBadgeTokens,
  scaleInterpolateRadiusStops,
  SHARED_POINT_FLOATING_BADGE_HOVER_LIGHTEN,
  sharedPointFloatingBadgeRadiusExpression,
  SHARED_POINT_FLOATING_BADGE_SELECTED_TRANSLATE,
  sharedPointFloatingBadgeOuterStrokeWidthExpression,
  SHARED_POINT_FLOATING_BADGE_SHADOW_OPACITY,
  SHARED_POINT_FLOATING_BADGE_SHADOW_TRANSLATE,
  SHARED_POINT_FLOATING_BADGE_GLASS_BLUR,
  SHARED_POINT_FLOATING_BADGE_GLASS_OPACITY,
  SHARED_POINT_FLOATING_BADGE_GLASS_PAD,
  SHARED_POINT_FLOATING_BADGE_SOFT_COLOR_PROPERTY,
  lightenHexTowardWhite,
  sharedPointFloatingBadgeGlassRadiusExpression,
  sharedPointFloatingBadgeHoverRingColorAt,
  sharedPointFloatingBadgeRingWidthExpression,
  sharedPointFloatingBadgeSelectedRadiusExpression,
  sharedPointFloatingBadgeNormalizeViewportTranslate,
  sharedPointFloatingBadgeSelectionTranslateAt,
  sharedPointFloatingBadgeShadowRadiusExpression,
  sharedPointFloatingBadgeSoftColor,
  sharedPointFloatingBadgeTranslatesNearlyEqual,
  sharedPointGlassLayerId,
  sharedPointHitLayerIds,
  sharedPointHoverBadgeLayerId,
  sharedPointHoverBadgeOuterLayerId,
  sharedPointFloatingBadgeOuterDiscRadius,
  sharedPointFloatingBadgeOuterStrokeRadius,
  sharedPointOuterStrokeLayerId,
  sharedPointRadiusPlusStrokeWidth,
  sharedPointSelectionBadgeLayerId,
  sharedPointSelectionBadgeOuterLayerId,
  sharedPointFloatingBadgeSelectionFillExpression,
  resolveFloatingBadgeSelectionKeyColor,
  resolveFloatingBadgeSelectionAccentColor,
  sharedPointFloatingBadgeRestingColor,
  SHARED_POINT_FLOATING_BADGE_SELECTED_COLOR_PROPERTY,
  SHARED_POINT_FLOATING_BADGE_KEY_COLOR_PROPERTY,
  syncSharedPointSelectedLayerFilter,
  hideFloatingBadgeCircleSelectionLayers,
  SHARED_POINT_FLOATING_BADGE_FALLBACK_COLOR,
} from '../../../paint/shared-point-paint';
import { syncBadgeChrome } from '../../../markers/badge';
import { sharedPointCircleBodyFilter, trySetLayerFilter } from '../../../markers/marker-shape';
import { resolveSharedPointLayerIdForSource } from '../../../shared-points/shared-point-heal';
import { selectionBadgeAnimByMap } from './animation-state';

// ============================================================================
// Types
// ============================================================================

import type { SharedPointLayersConfig, CircleStyleOptions } from '../types';
import {
  getPointRadiusInterpolation, getGlowRadiusInterpolation, SELECTION_RING_STROKE_WIDTH, SELECTION_RING_GAP_PX,
} from '../circle-glow';
import { offsetRadiusInterpolation } from '../category-expressions';
import { omitNil } from '../circle-glow';
import {
  resolveGlowBlur, resolveGlowOpacity, resolveSharedGlowColor, resolveDefaultLayerColor, resolveDefaultStrokeColor,
  resolveMapTilerHelperPointColor,
} from '../types';

import {
  animateSharedPointSelectionBadgeTranslate,
  cancelSelectionBadgeAnimation,
  setSelectionBadgeTranslate,
  sharedPointSelectionBadgeTranslateForCamera,
} from './badge-translate';
import { EMPTY_GEOJSON, extractPointLngLat, type GeoJSONSourceWithSetData } from './geojson';
import {
  ensureSelectionRingOnTop,
  ensureSharedPointSelectionRingLayer,
  setupSelectionGroundBadgeLayers,
} from '../shared-point-layers';

/** Property order for resolving feature ids on shared point layers. */
export const DEFAULT_SHARED_POINT_ID_PROPERTIES = ['slug', 'id', 'point-id', 'id:google-maps'];

export { extractPointLngLat };

function featureMatchesId(
  item: GeoJSON.Feature,
  target: string,
  idProperties: string[]
): boolean {
  if (item.id != null && String(item.id) === target) return true;
  if (!item.properties) return false;
  return idProperties.some((prop) => String(item.properties?.[prop] ?? '') === target);
}

/** Read GeoJSON from a source — MapLibre/MapTiler store data under several private keys. */
function readGeoJsonSourceFeatures(source: unknown): GeoJSON.Feature[] {
  if (!source || typeof source !== 'object') return [];
  const s = source as {
    _data?: GeoJSON.FeatureCollection;
    _geojson?: GeoJSON.FeatureCollection;
    data?: GeoJSON.FeatureCollection;
    _options?: { data?: GeoJSON.FeatureCollection };
    serialize?: () => { data?: GeoJSON.FeatureCollection };
  };
  const candidates = [s._data, s._geojson, s.data, s._options?.data];
  for (const data of candidates) {
    if (data?.features?.length) return data.features;
  }
  try {
    const serialized = s.serialize?.()?.data;
    if (serialized?.features?.length) return serialized.features;
  } catch {
    /* ignore */
  }
  return [];
}

/** Canonical point coordinates from the GeoJSON source (not click lngLat). */
function lookupSharedPointFeature(
  map: MapInstance,
  sourceId: string,
  featureId: string,
  idProperties: string[] = DEFAULT_SHARED_POINT_ID_PROPERTIES
): GeoJSON.Feature | null {
  const target = String(featureId);
  const source = map.getSource?.(sourceId);
  const fromSource = readGeoJsonSourceFeatures(source).find((item) =>
    featureMatchesId(item, target, idProperties)
  );
  if (fromSource) return fromSource;

  // Worker-backed sources may not expose `_data` — fall back to queried features.
  const queried =
    (
      map as {
        querySourceFeatures?(sourceId: string, params?: unknown): GeoJSON.Feature[];
      }
    ).querySourceFeatures?.(sourceId) ?? [];
  return queried.find((item) => featureMatchesId(item, target, idProperties)) ?? null;
}

export function resolveSharedPointRingColor(
  properties: Record<string, unknown> | null | undefined,
  fallbackColor: string
): string {
  // Prefer identity key / resting — never a hover-lit `_color` (that wash stuck forever).
  const key = properties?.[SHARED_POINT_FLOATING_BADGE_KEY_COLOR_PROPERTY];
  if (typeof key === 'string' && key.trim()) return key.trim();

  const resting = properties?._colorResting;
  if (typeof resting === 'string' && resting.trim()) return resting.trim();

  const color = typeof properties?._color === 'string' ? properties._color.trim() : '';
  const hover =
    typeof properties?._colorHover === 'string' ? properties._colorHover.trim() : '';
  const rawFallback = fallbackColor.trim() || SHARED_POINT_FLOATING_BADGE_FALLBACK_COLOR;
  // One intensify pass — same as annotate/forceFallbackKey — so unannotated pins
  // don't keep the softer raw locker hue next to key-colored neighbors.
  const keyFallback = sharedPointFloatingBadgeRestingColor(rawFallback);
  if (color && hover && color.toLowerCase() === hover.toLowerCase()) {
    return keyFallback;
  }
  if (color) return color;

  for (const prop of ['color', 'marker-color'] as const) {
    const raw = properties?.[prop];
    if (typeof raw === 'string' && raw.trim()) return raw.trim();
  }
  return keyFallback;
}

/** Prefer annotated `_colorHover`, else lighten the resting ring toward white. */
export function resolveSharedPointHoverRingColor(
  properties: Record<string, unknown> | null | undefined,
  fallbackColor: string,
  lightenAmount = SHARED_POINT_FLOATING_BADGE_HOVER_LIGHTEN
): string {
  const annotated = properties?._colorHover;
  if (typeof annotated === 'string' && annotated.trim()) return annotated.trim();
  const amount =
    typeof lightenAmount === 'number' && Number.isFinite(lightenAmount)
      ? lightenAmount
      : SHARED_POINT_FLOATING_BADGE_HOVER_LIGHTEN;
  return lightenHexTowardWhite(resolveSharedPointRingColor(properties, fallbackColor), amount);
}

export function lookupSharedPointCoords(
  map: MapInstance,
  sourceId: string,
  featureId: string,
  idProperties: string[] = DEFAULT_SHARED_POINT_ID_PROPERTIES
): { lng: number; lat: number } | null {
  const feature = lookupSharedPointFeature(map, sourceId, featureId, idProperties);
  return feature ? extractPointLngLat(feature.geometry) : null;
}

export function lookupSharedPointProperties(
  map: MapInstance,
  sourceId: string,
  featureId: string,
  idProperties: string[] = DEFAULT_SHARED_POINT_ID_PROPERTIES
): Record<string, unknown> | null {
  const feature = lookupSharedPointFeature(map, sourceId, featureId, idProperties);
  if (!feature?.properties || typeof feature.properties !== 'object') return null;
  return { ...(feature.properties as Record<string, unknown>) };
}

export function resolveSharedPointSelectionLngLat(
  map: MapInstance,
  sourceId: string,
  featureId: string | null,
  eventGeometry: unknown,
  clickLngLat?: { lng: number; lat: number } | null,
  idProperties: string[] = DEFAULT_SHARED_POINT_ID_PROPERTIES
): { lng: number; lat: number } | null {
  if (featureId) {
    const fromSource = lookupSharedPointCoords(map, sourceId, String(featureId), idProperties);
    if (fromSource) return fromSource;
  }
  return extractPointLngLat(eventGeometry) ?? clickLngLat ?? null;
}

/**
 * Update the selection ring for shared point layers.
 * Sets the dedicated selection source to a single Point feature at the given
 * coordinates, or clears it when coordinates is null.
 *
 * @param map - Map instance
 * @param sourceId - The base source ID used when creating the shared point layers
 * @param coordinates - Selected point coordinates, or null to clear
 */
export function updateSharedPointSelection(
  map: MapInstance,
  sourceId: string,
  selection: {
    lngLat: { lng: number; lat: number };
    properties?: Record<string, unknown>;
    /** Feature id for hit-testing / getFeatureId on selection badge layers. */
    featureId?: string | null;
    /** Property key mirrored onto the selection feature (e.g. `venueId`). */
    promoteId?: string;
  } | null
): void {
  const selectionSourceId = `${sourceId}-selection`;
  const source = map?.getSource?.(selectionSourceId) as GeoJSONSourceWithSetData | undefined;
  if (!source?.setData) return;

  try {
    if (selection?.lngLat) {
      const featureId = selection.featureId != null ? String(selection.featureId) : undefined;
      const promoteId = selection.promoteId?.trim() || 'venueId';
      const properties: Record<string, unknown> = { ...(selection.properties ?? {}) };
      if (featureId) {
        properties[promoteId] = properties[promoteId] ?? featureId;
        if (promoteId !== 'venueId') properties.venueId = properties.venueId ?? featureId;
      }
      source.setData({
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            ...(featureId ? { id: featureId } : {}),
            geometry: {
              type: 'Point',
              coordinates: [selection.lngLat.lng, selection.lngLat.lat],
            },
            properties,
          },
        ],
      });
    } else {
      source.setData(EMPTY_GEOJSON);
    }
  } catch {
    // Ignore - source may have been removed
  }
}

export interface SharedPointSelectionState {
  featureId: string | null;
  lngLat: { lng: number; lat: number } | null;
}

export interface SetSharedPointSelectionOptions {
  idProperties?: string[];
  /** Point layer id — used to keep the ring above the dot. */
  pointLayerId?: string;
  /** Glow layer id — filtered with the point when a grounded selection badge lands. */
  glowLayerId?: string;
  /** Feature property used as promoteId / filter key (e.g. `venueId`). */
  promoteId?: string;
  /** Ring stroke color when the selection layer must be mounted lazily. */
  selectionRingColor?: string;
  /** Point outline width (px) for ring radius math when mounting lazily. */
  selectionPointStrokeWidth?: number | unknown[];
  /**
   * Floating-badge active state: grounded badge only — keep the halo layer
   * mounted for the selection source, but never restore its stroke.
   */
  selectionGroundBadge?: boolean;
  /** Fallback ring color for grounded selection badge layers. */
  selectionGroundBadgeFallbackColor?: string;
  /** When set with dispatchEvent, fires gk-shared-point-selected on this element. */
  mapElement?: HTMLElement | null;
  dispatchEvent?: boolean;
}

function readPointRadiusFromLayer(map: MapInstance, pointLayerId: string): unknown {
  if (!map.getLayer?.(pointLayerId)) {
    return getPointRadiusInterpolation();
  }
  try {
    const getPaint = (map as { getPaintProperty?: (id: string, prop: string) => unknown })
      .getPaintProperty;
    const live = getPaint?.(pointLayerId, 'circle-radius');
    return Array.isArray(live) ? live : getPointRadiusInterpolation();
  } catch {
    return getPointRadiusInterpolation();
  }
}

/** Mount selection source + ring when MapTiler helper skipped them during layer create. */
function ensureSelectionRingReady(
  map: MapInstance,
  sourceId: string,
  options?: SetSharedPointSelectionOptions
): void {
  const pointLayerId =
    options?.pointLayerId ?? resolveSharedPointLayerIdForSource(map, sourceId);
  if (!pointLayerId || !map.getLayer?.(pointLayerId)) return;

  const selectionRingColor =
    options?.selectionRingColor ??
    (typeof document !== 'undefined'
      ? resolveDefaultStrokeColor(document.documentElement)
      : '#ffffff');
  try {
    // Floating-badge: keep selection source for the grounded badge, never paint the halo.
    ensureSharedPointSelectionRingLayer(
      map,
      sourceId,
      pointLayerId,
      selectionRingColor,
      readPointRadiusFromLayer(map, pointLayerId),
      options?.selectionPointStrokeWidth ?? 0,
      options?.selectionGroundBadge ? { hideHalo: true } : undefined
    );
    if (options?.selectionGroundBadge) {
      setupSelectionGroundBadgeLayers(map, sourceId, pointLayerId, {
        fallbackColor: options.selectionGroundBadgeFallbackColor,
      });
    }
  } catch {
    // Style may not be loaded yet (e.g. visibility restore) — ring data still updates below.
  }
}

const sharedPointSelectionByMap = new WeakMap<
  MapInstance,
  Map<string, SharedPointSelectionState>
>();

function getSharedPointSelectionMap(map: MapInstance): Map<string, SharedPointSelectionState> {
  let registry = sharedPointSelectionByMap.get(map);
  if (!registry) {
    registry = new Map();
    sharedPointSelectionByMap.set(map, registry);
  }
  return registry;
}

export function getSharedPointSelection(
  map: MapInstance,
  sourceId: string
): SharedPointSelectionState | null {
  return getSharedPointSelectionMap(map).get(sourceId) ?? null;
}

/** Toggle feature-state `selected` so floating badges can hide while grounded. */
function syncSharedPointSelectedFeatureState(
  map: MapInstance,
  sourceId: string,
  previousFeatureId: string | null,
  nextFeatureId: string | null
): void {
  if (!map.setFeatureState) return;
  // Mapbox fires/throws when the GeoJSON source is not on the style yet (init race).
  if (map.getSource && !map.getSource(sourceId)) return;
  if (previousFeatureId && previousFeatureId !== nextFeatureId) {
    try {
      map.setFeatureState({ source: sourceId, id: previousFeatureId }, { selected: false });
    } catch {
      /* source may not support feature-state yet */
    }
  }
  if (nextFeatureId) {
    try {
      map.setFeatureState({ source: sourceId, id: nextFeatureId }, { selected: true });
    } catch {
      /* promoteId / source missing */
    }
  }
}

export function clearSharedPointSelection(
  map: MapInstance,
  sourceId: string,
  options?: SetSharedPointSelectionOptions
): void {
  setSharedPointSelection(map, sourceId, { featureId: null, lngLat: null }, options);
}

/**
 * Move the shared-point selection ring and track the selected feature id.
 * Prefer gk-map.setSelectedPoint() from app code; this is used internally on click.
 */
export function setSharedPointSelection(
  map: MapInstance,
  sourceId: string,
  selection: {
    featureId: string | null;
    lngLat?: { lng: number; lat: number } | null;
    properties?: Record<string, unknown> | null;
  },
  options?: SetSharedPointSelectionOptions
): void {
  const previous = getSharedPointSelection(map, sourceId);
  const previousFeatureId = previous?.featureId ?? null;
  const featureId = selection.featureId;
  const lngLat = selection.lngLat ?? null;
  const properties = selection.properties ?? null;
  const pointLayerId =
    options?.pointLayerId ?? resolveSharedPointLayerIdForSource(map, sourceId);
  const promoteId =
    options?.promoteId?.trim() ||
    options?.idProperties?.[0] ||
    DEFAULT_SHARED_POINT_ID_PROPERTIES[0] ||
    'id';
  const idProperties = [
    promoteId,
    ...(options?.idProperties ?? DEFAULT_SHARED_POINT_ID_PROPERTIES),
  ].filter((v, i, arr): v is string => !!v && arr.indexOf(v) === i);

  if (!featureId || !lngLat) {
    syncSharedPointSelectedFeatureState(map, sourceId, previousFeatureId, null);
    if (pointLayerId) {
      syncSharedPointSelectedLayerFilter(map, {
        pointLayerId,
        glowLayerId: options?.glowLayerId,
        promoteId,
        featureId: null,
      });
      if (options?.selectionGroundBadge) {
        cancelSelectionBadgeAnimation(map, pointLayerId);
        hideFloatingBadgeCircleSelectionLayers(map, pointLayerId);
        const tokens = resolveSharedPointFloatingBadgeTokens();
        setSelectionBadgeTranslate(
          map,
          pointLayerId,
          sharedPointSelectionBadgeTranslateForCamera(
            tokens.floatTranslate,
            map.getPitch?.() ?? 0,
            map.getZoom?.() ?? 16
          )
        );
      }
    }
    getSharedPointSelectionMap(map).set(sourceId, { featureId: null, lngLat: null });
    updateSharedPointSelection(map, sourceId, null);
  } else {
    const resolvedLngLat =
      lookupSharedPointCoords(map, sourceId, String(featureId), idProperties) ?? lngLat;
    // Click/query props often omit `_color` — always merge the full source feature.
    const fromSource = lookupSharedPointProperties(map, sourceId, String(featureId), idProperties);
    const resolvedProperties: Record<string, unknown> = {
      ...(fromSource ?? {}),
      ...(properties ?? {}),
    };
    const fallback =
      options?.selectionGroundBadgeFallbackColor?.trim() || SHARED_POINT_FLOATING_BADGE_FALLBACK_COLOR;
    // Hover may have washed `_color` — keep resting locker key for the ring.
    const keyColor = resolveFloatingBadgeSelectionKeyColor(resolvedProperties, fallback);
    const accentColor = resolveFloatingBadgeSelectionAccentColor(resolvedProperties, fallback);
    resolvedProperties._color = keyColor;
    resolvedProperties._colorResting ??= keyColor;
    resolvedProperties[SHARED_POINT_FLOATING_BADGE_SELECTED_COLOR_PROPERTY] = accentColor;
    getSharedPointSelectionMap(map).set(sourceId, { featureId, lngLat: resolvedLngLat });
    ensureSelectionRingReady(map, sourceId, options);
    updateSharedPointSelection(map, sourceId, {
      lngLat: resolvedLngLat,
      featureId,
      promoteId,
      properties: resolvedProperties,
    });
    // Selection source draws the grounded badge; resting stack drops this feature.
    syncSharedPointSelectedFeatureState(map, sourceId, previousFeatureId, featureId);
    if (pointLayerId) {
      const selectionChanged = featureId !== previousFeatureId;
      if (options?.selectionGroundBadge) {
        // Paint the selection badge at float height before filtering resting off.
        syncBadgeChrome(map, pointLayerId, {
          keyColor,
          properties: resolvedProperties,
        });
        if (selectionChanged) {
          animateSharedPointSelectionBadgeTranslate(map, pointLayerId);
        } else if (!selectionBadgeAnimByMap.get(map)?.has(pointLayerId)) {
          const tokens = resolveSharedPointFloatingBadgeTokens();
          setSelectionBadgeTranslate(
            map,
            pointLayerId,
            sharedPointSelectionBadgeTranslateForCamera(
              tokens.selectedTranslate,
              map.getPitch?.() ?? 0,
              map.getZoom?.() ?? 16
            )
          );
        }
        syncSharedPointSelectedLayerFilter(map, {
          pointLayerId,
          glowLayerId: options?.glowLayerId,
          promoteId,
          featureId,
        });
      } else {
        syncSharedPointSelectedLayerFilter(map, {
          pointLayerId,
          glowLayerId: options?.glowLayerId,
          promoteId,
          featureId,
        });
        syncBadgeChrome(map, pointLayerId, {
          keyColor,
          properties: resolvedProperties,
        });
      }
    }
    clearSharedPointHoverOverlay(map, sourceId);
    if (pointLayerId && !options?.selectionGroundBadge) {
      ensureSelectionRingOnTop(map, pointLayerId);
    }
  }

  const changed = featureId !== previousFeatureId;
  if (options?.dispatchEvent && options.mapElement && changed) {
    options.mapElement.dispatchEvent(
      new CustomEvent('gk-shared-point-selected', {
        detail: {
          sourceId,
          featureId,
          previousFeatureId,
          lngLat,
          map,
          element: options.mapElement,
        },
        bubbles: true,
      })
    );
  }
}

export function clearSharedPointHoverOverlay(map: MapInstance, sourceId: string): void {
  const hoverSourceId = `${sourceId}-hover`;
  const source = map.getSource?.(hoverSourceId) as GeoJSONSourceWithSetData | undefined;
  if (!source?.setData) return;
  try {
    source.setData(EMPTY_GEOJSON);
  } catch {
    // Source may have been removed during style swap
  }
}

/** Patch one feature's ring `_color` in the main GeoJSON source (in-place hover lighten). */
export function patchSharedPointFeatureRingColor(
  map: MapInstance,
  sourceId: string,
  featureId: string,
  ringColor: string,
  idProperties: string[],
  options?: { restingColor?: string }
): void {
  const source = map.getSource?.(sourceId) as
    | (GeoJSONSourceWithSetData & {
        _data?: GeoJSON.FeatureCollection;
        data?: GeoJSON.FeatureCollection;
      })
    | undefined;
  if (!source?.setData) return;
  const features = readGeoJsonSourceFeatures(source);
  if (!features.length) return;
  const target = String(featureId);
  const nextFeatures = features.map((feature) => {
    if (!featureMatchesId(feature, target, idProperties)) return feature;
    const prev = feature.properties ?? {};
    const resting =
      options?.restingColor ??
      resolveSharedPointRingColor(prev, SHARED_POINT_FLOATING_BADGE_FALLBACK_COLOR);
    const key =
      typeof prev[SHARED_POINT_FLOATING_BADGE_KEY_COLOR_PROPERTY] === 'string' &&
      String(prev[SHARED_POINT_FLOATING_BADGE_KEY_COLOR_PROPERTY]).trim()
        ? String(prev[SHARED_POINT_FLOATING_BADGE_KEY_COLOR_PROPERTY]).trim()
        : resting;
    return {
      ...feature,
      properties: {
        ...prev,
        // Preserve vivid identity while `_color` is temporarily lit for hover.
        [SHARED_POINT_FLOATING_BADGE_KEY_COLOR_PROPERTY]: key,
        _colorResting: resting,
        _color: ringColor,
      },
    };
  });
  const next: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: nextFeatures,
  };
  try {
    source.setData(next);
    if ('_data' in source) source._data = next;
    if ('data' in source) source.data = next;
  } catch {
    /* style swap */
  }
}
