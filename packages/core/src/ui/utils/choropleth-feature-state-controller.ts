/**
 * Choropleth fill + optional outline with feature-state highlight.
 */

import type { FeatureCollection } from 'geojson';

export type ChoroplethFeatureStateMap = {
  getStyle?(): unknown;
  getSource?(id: string): { setData?: (data: FeatureCollection) => void } | undefined;
  getLayer?(id: string): unknown;
  addSource?(id: string, spec: Record<string, unknown>): void;
  addLayer?(layer: Record<string, unknown>, before?: string): void;
  removeLayer?(id: string): void;
  removeSource?(id: string): void;
  setPaintProperty?(layer: string, prop: string, value: unknown): void;
  setFeatureState?(target: { source: string; id: string }, state: Record<string, unknown>): void;
  removeFeatureState?(target: { source: string; id?: string }): void;
};

export type ChoroplethFeatureStateSpec = {
  sourceId: string;
  fillLayerId: string;
  outlineLayerId?: string;
  promoteId?: string;
  sourceOptions?: Record<string, unknown>;
  fillPaint: Record<string, unknown>;
  outlinePaint?: Record<string, unknown>;
  resolveInsertBefore?: (map: ChoroplethFeatureStateMap) => string | undefined;
  stackLayers?: (map: ChoroplethFeatureStateMap) => void;
};

export function createChoroplethFeatureStateController(spec: ChoroplethFeatureStateSpec) {
  let highlightedId: string | null = null;
  let layersMounted = false;

  function teardown(map: ChoroplethFeatureStateMap | null | undefined): void {
    if (!map?.getStyle?.()) {
      layersMounted = false;
      return;
    }
    try {
      if (spec.outlineLayerId && map.getLayer?.(spec.outlineLayerId)) {
        map.removeLayer?.(spec.outlineLayerId);
      }
      if (map.getLayer?.(spec.fillLayerId)) map.removeLayer?.(spec.fillLayerId);
      if (map.getSource?.(spec.sourceId)) map.removeSource?.(spec.sourceId);
    } catch {
      /* map torn down */
    }
    layersMounted = false;
    highlightedId = null;
  }

  function mount(map: ChoroplethFeatureStateMap): void {
    teardown(map);
    const beforeId = spec.resolveInsertBefore?.(map);

    map.addSource?.(spec.sourceId, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
      ...(spec.promoteId ? { promoteId: spec.promoteId } : {}),
      ...(spec.sourceOptions ?? {}),
    });

    map.addLayer?.(
      {
        id: spec.fillLayerId,
        type: 'fill',
        source: spec.sourceId,
        paint: spec.fillPaint,
      },
      beforeId
    );

    if (spec.outlineLayerId && spec.outlinePaint) {
      map.addLayer?.(
        {
          id: spec.outlineLayerId,
          type: 'line',
          source: spec.sourceId,
          paint: spec.outlinePaint,
        },
        beforeId
      );
    }

    spec.stackLayers?.(map);
    layersMounted = true;
  }

  function ensureMounted(map: ChoroplethFeatureStateMap): void {
    if (!layersMounted || !map.getSource?.(spec.sourceId)) mount(map);
  }

  function setData(map: ChoroplethFeatureStateMap, data: FeatureCollection): void {
    map.getSource?.(spec.sourceId)?.setData?.(data);
  }

  function setFillOpacity(map: ChoroplethFeatureStateMap, opacity: unknown): void {
    if (!map.getLayer?.(spec.fillLayerId)) return;
    map.setPaintProperty?.(spec.fillLayerId, 'fill-opacity', opacity);
  }

  function highlightFeature(
    map: ChoroplethFeatureStateMap,
    featureId: string | null,
    reload?: () => Promise<void>
  ): void {
    try {
      if (highlightedId) {
        map.removeFeatureState?.({ source: spec.sourceId, id: highlightedId });
      }
    } catch {
      /* ignore */
    }

    highlightedId = null;
    if (!featureId) return;

    highlightedId = featureId;
    const apply = () => {
      try {
        map.setFeatureState?.(
          { source: spec.sourceId, id: featureId },
          { highlight: true }
        );
      } catch {
        /* feature may not be loaded yet */
      }
    };

    if (reload) {
      void reload().then(() => {
        if (highlightedId === featureId) apply();
      });
      return;
    }

    apply();
  }

  return {
    spec,
    isMounted: () => layersMounted,
    mount,
    teardown,
    ensureMounted,
    setData,
    setFillOpacity,
    highlightFeature,
    getHighlightedId: () => highlightedId,
  };
}
