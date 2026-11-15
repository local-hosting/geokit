/**
 * Shared point layers + isochrone placeholder + geodesic radius rings.
 */

import type { FeatureCollection } from 'geojson';
import {
  createSharedPointLayerController,
  type SharedPointLayerController,
  type SharedPointLayerControllerOptions,
} from './shared-point-layer-controller';
import {
  ensureGeodesicRadiusRingLayers,
  updateGeodesicRadiusRingData,
} from '../map-surface/geodesic-circle';
import {
  DEFAULT_SHARED_POINT_ID_PROPERTIES,
  ensureSharedPointSelectionRingLayer,
  setSharedPointSelection,
  updateSharedPointSelection,
} from '../layers/styles/shared-point-layers';

export type SharedPointMapLike = {
  getSource?(id: string): unknown;
  getLayer?(id: string): unknown;
  addSource?(id: string, spec: Record<string, unknown>): void;
  addLayer?(layer: Record<string, unknown>, before?: string): void;
};

export type RadiusRingSpec = {
  miles: number;
  fillColor: string;
  fillOpacity: number;
};

export type SharedPointMapOrchestratorOptions = SharedPointLayerControllerOptions & {
  marketSlug: string | (() => string);
  isochroneFillColor: string;
  radiusRings?: readonly RadiusRingSpec[];
  onSelectionCoordsChange?: (coords: { lng: number; lat: number } | null) => void;
};

export type SharedPointSelectionUpdateMeta = {
  featureId?: string | null;
  properties?: Record<string, unknown> | null;
};

export type SharedPointMapOrchestrator = SharedPointLayerController & {
  getIsochroneSourceId: () => string;
  ensureSelectionLayers: (map: SharedPointMapLike) => void;
  updateSelectionCoords: (
    coords: { lng: number; lat: number } | null,
    meta?: SharedPointSelectionUpdateMeta
  ) => void;
};

const EMPTY_FC: FeatureCollection = { type: 'FeatureCollection', features: [] };

export function createSharedPointMapOrchestrator(
  options: SharedPointMapOrchestratorOptions
): SharedPointMapOrchestrator {
  const resolveMarketSlug = () =>
    typeof options.marketSlug === 'function'
      ? options.marketSlug()
      : options.marketSlug;

  function getIsochroneSourceId(): string {
    return `isochrone-selection-${resolveMarketSlug()}`;
  }

  function glowLayerId(map: SharedPointMapLike): string | undefined {
    const ids =
      typeof options.ids === 'function' ? options.ids() : options.ids;
    return map.getLayer?.(ids.glowLayerId) ? ids.glowLayerId : undefined;
  }

  function ensureIsochroneLayers(map: SharedPointMapLike): void {
    const sourceId = getIsochroneSourceId();
    const fillLayerId = `polygon-fill-${sourceId}`;
    const lineLayerId = `polygon-stroke-${sourceId}`;
    const beforeLayer = glowLayerId(map);

    if (!map.getSource?.(sourceId)) {
      map.addSource?.(sourceId, { type: 'geojson', data: EMPTY_FC });
    }

    if (!map.getLayer?.(fillLayerId)) {
      const fillSpec = {
        id: fillLayerId,
        type: 'fill',
        source: sourceId,
        paint: {
          'fill-color': options.isochroneFillColor,
          'fill-opacity': 0,
          // Dissolved H3 multipolygons: antialias + no outline avoids earcut seam quilt.
          'fill-antialias': true,
          'fill-outline-color': 'transparent',
        },
      };
      if (beforeLayer) map.addLayer?.(fillSpec, beforeLayer);
      else map.addLayer?.(fillSpec);
    }

    if (!map.getLayer?.(lineLayerId)) {
      const lineSpec = {
        id: lineLayerId,
        type: 'line',
        source: sourceId,
        paint: {
          'line-color': options.isochroneFillColor,
          'line-width': 0,
          'line-blur': 1,
        },
        layout: { 'line-join': 'round', 'line-cap': 'round' },
      };
      if (beforeLayer) map.addLayer?.(lineSpec, beforeLayer);
      else map.addLayer?.(lineSpec);
    }
  }

  function ensureRadiusRingLayers(map: SharedPointMapLike): void {
    const rings = options.radiusRings;
    if (!rings?.length) return;
    ensureGeodesicRadiusRingLayers(
      map as never,
      resolveMarketSlug(),
      rings,
      { beforeLayerId: glowLayerId(map) }
    );
  }

  function resolveSelectionRingColor(): string {
    const value =
      typeof options.selectionRingColor === 'function'
        ? options.selectionRingColor()
        : options.selectionRingColor;
    return value?.trim() || '#ffffff';
  }

  function updateSelectionCoords(
    coords: { lng: number; lat: number } | null,
    meta?: SharedPointSelectionUpdateMeta
  ): void {
    options.onSelectionCoordsChange?.(coords);
    const gkMap = options.getGkMap();
    const map = gkMap?.getMap?.();
    if (!map) return;

    const ids = typeof options.ids === 'function' ? options.ids() : options.ids;
    const ringColor = resolveSelectionRingColor();
    const paint = options.getPaintConfig?.();
    const selectionGroundBadge = paint?.selectionGroundBadge === true;
    const selectionStrokeWidth =
      typeof options.selectionPointStrokeWidth === 'function'
        ? options.selectionPointStrokeWidth()
        : options.selectionPointStrokeWidth;

    // Do not resize the halo from the inner white disk — that draws a grey ring on the center.
    // Floating-badge active state skips the halo entirely.
    if (map.getLayer?.(ids.pointLayerId) && !selectionGroundBadge) {
      ensureSharedPointSelectionRingLayer(
        map as never,
        ids.sourceId,
        ids.pointLayerId,
        ringColor,
        paint?.pointRadiusExpression,
        selectionStrokeWidth ?? 0
      );
    }

    const featureId = meta?.featureId ?? null;
    if (featureId != null || coords == null) {
      setSharedPointSelection(
        map as never,
        ids.sourceId,
        {
          featureId: coords && featureId ? featureId : null,
          lngLat: coords,
          properties: meta?.properties ?? null,
        },
        {
          pointLayerId: ids.pointLayerId,
          glowLayerId: ids.glowLayerId,
          promoteId: options.promoteId || 'venueId',
          selectionRingColor: ringColor,
          selectionPointStrokeWidth: selectionStrokeWidth,
          selectionGroundBadge,
          selectionGroundBadgeFallbackColor: paint?.selectionGroundBadgeFallbackColor,
          idProperties: [
            options.promoteId || 'venueId',
            ...DEFAULT_SHARED_POINT_ID_PROPERTIES,
          ].filter((v, i, arr): v is string => !!v && arr.indexOf(v) === i),
        }
      );
    } else {
      updateSharedPointSelection(
        map as never,
        ids.sourceId,
        coords ? { lngLat: coords, ...(meta?.properties ? { properties: meta.properties } : {}) } : null
      );
    }

    if (!options.radiusRings?.length) return;
    updateGeodesicRadiusRingData(
      map as never,
      resolveMarketSlug(),
      options.radiusRings,
      coords
    );
  }

  const pointController = createSharedPointLayerController({
    ...options,
    onAfterCreate: async map => {
      ensureIsochroneLayers(map);
      ensureRadiusRingLayers(map);
      await options.onAfterCreate?.(map);
    },
  });

  return {
    ...pointController,
    getIsochroneSourceId,
    ensureSelectionLayers: map => {
      ensureIsochroneLayers(map);
      ensureRadiusRingLayers(map);
    },
    updateSelectionCoords,
  };
}
