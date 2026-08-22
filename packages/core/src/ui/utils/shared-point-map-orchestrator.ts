/**
 * Shared point layers + isochrone placeholder + geodesic radius rings.
 */

import type { FeatureCollection } from 'geojson';
import {
  createSharedPointLayerController,
  type SharedPointLayerController,
  type SharedPointLayerControllerOptions,
} from './shared-point-layer-controller.js';
import {
  ensureGeodesicRadiusRingLayers,
  updateGeodesicRadiusRingData,
} from './geodesic-circle.js';

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

export type SharedPointMapOrchestrator = SharedPointLayerController & {
  getIsochroneSourceId: () => string;
  ensureSelectionLayers: (map: SharedPointMapLike) => void;
  updateSelectionCoords: (coords: { lng: number; lat: number } | null) => void;
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
          'fill-antialias': false,
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

  function updateSelectionCoords(coords: { lng: number; lat: number } | null): void {
    options.onSelectionCoordsChange?.(coords);
    const gkMap = options.getGkMap();
    const map = gkMap?.getMap?.();
    if (!map || !options.radiusRings?.length) return;
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
