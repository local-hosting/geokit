/**
 * Imperative H3 hex grid layer — GeoJSON source + fill (+ optional line).
 */

import type { FeatureCollection, Polygon } from 'geojson';

export type H3GridLayerMap = {
  getSource?(id: string): { setData?: (data: FeatureCollection) => void } | undefined;
  addSource?(id: string, spec: Record<string, unknown>): void;
  getLayer?(id: string): unknown;
  addLayer?(layer: Record<string, unknown>, before?: string): void;
  removeLayer?(id: string): void;
  removeSource?(id: string): void;
  setPaintProperty?(layerId: string, property: string, value: unknown): void;
  on?(
    event: string,
    layerOrHandler: string | ((...args: unknown[]) => void),
    handler?: (...args: unknown[]) => void
  ): void;
  off?(
    event: string,
    layerOrHandler: string | ((...args: unknown[]) => void),
    handler?: (...args: unknown[]) => void
  ): void;
  getCanvas?: () => HTMLCanvasElement;
};

export type H3GridLayerPaintSpec = {
  sourceId: string;
  fillLayerId: string;
  lineLayerId?: string;
  emptyCollection?: FeatureCollection<Polygon>;
  fillLayer: Record<string, unknown>;
  lineLayer?: Record<string, unknown>;
  resolveInsertBefore?: (map: H3GridLayerMap) => string | undefined;
  /** Remove legacy layer ids on ensure (e.g. after paint migration). */
  legacyLayerIds?: readonly string[];
};

export function createH3GridLayerController(spec: H3GridLayerPaintSpec) {
  const empty =
    spec.emptyCollection ??
    ({ type: 'FeatureCollection', features: [] } satisfies FeatureCollection<Polygon>);

  function ensureLayers(map: H3GridLayerMap): void {
    const styleMap = map as { isStyleLoaded?: () => boolean };
    if (
      typeof styleMap.isStyleLoaded === 'function' &&
      !styleMap.isStyleLoaded()
    ) {
      return;
    }

    try {
      for (const legacyId of spec.legacyLayerIds ?? []) {
        if (map.getLayer?.(legacyId)) map.removeLayer?.(legacyId);
      }

      if (!map.getSource?.(spec.sourceId)) {
        map.addSource?.(spec.sourceId, {
          type: 'geojson',
          data: empty,
        });
      }

      const before = spec.resolveInsertBefore?.(map);

      if (!map.getLayer?.(spec.fillLayerId)) {
        map.addLayer?.(spec.fillLayer, before);
      }

      if (spec.lineLayerId && spec.lineLayer && !map.getLayer?.(spec.lineLayerId)) {
        map.addLayer?.(spec.lineLayer, spec.fillLayerId);
      }
    } catch {
      /* style still loading or map torn down */
    }
  }

  function setData(map: H3GridLayerMap, data: FeatureCollection): void {
    map.getSource?.(spec.sourceId)?.setData?.(data);
  }

  function removeLayers(map: H3GridLayerMap | null | undefined): void {
    if (!map) return;
    try {
      if (spec.lineLayerId && map.getLayer?.(spec.lineLayerId)) {
        map.removeLayer?.(spec.lineLayerId);
      }
      if (map.getLayer?.(spec.fillLayerId)) map.removeLayer?.(spec.fillLayerId);
      if (map.getSource?.(spec.sourceId)) map.removeSource?.(spec.sourceId);
    } catch {
      /* map torn down */
    }
  }

  function bindHoverOpacity(
    map: H3GridLayerMap,
    hoverOpacity: number,
    idleOpacity: unknown = ['coalesce', ['get', 'fillOpacity'], 0]
  ): () => void {
    if (!map.getLayer?.(spec.fillLayerId)) return () => {};

    const onEnter = () => {
      map.setPaintProperty?.(spec.fillLayerId, 'fill-opacity', hoverOpacity);
      const canvas = map.getCanvas?.();
      if (canvas) canvas.style.cursor = 'pointer';
    };

    const onLeave = () => {
      map.setPaintProperty?.(spec.fillLayerId, 'fill-opacity', idleOpacity);
      const canvas = map.getCanvas?.();
      if (canvas) canvas.style.cursor = '';
    };

    map.on?.('mouseenter', spec.fillLayerId, onEnter);
    map.on?.('mouseleave', spec.fillLayerId, onLeave);

    return () => {
      map.off?.('mouseenter', spec.fillLayerId, onEnter);
      map.off?.('mouseleave', spec.fillLayerId, onLeave);
    };
  }

  function bindClick(
    map: H3GridLayerMap,
    handler: (event: unknown) => void
  ): () => void {
    map.on?.('click', spec.fillLayerId, handler);
    return () => map.off?.('click', spec.fillLayerId, handler);
  }

  return {
    spec,
    ensureLayers,
    setData,
    removeLayers,
    bindHoverOpacity,
    bindClick,
  };
}
