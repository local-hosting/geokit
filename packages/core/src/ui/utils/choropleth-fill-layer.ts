/**
 * Generic choropleth fill layer lifecycle (create / remove / visibility).
 */

import type { FeatureCollection } from 'geojson';
import { buildChoroplethFillPaint } from './choropleth-fill-paint.js';

export interface ChoroplethFillLayerSpec {
  sourceId: string;
  fillLayerId: string;
  sourceOptions?: Record<string, unknown>;
  fillColor: unknown;
  fillOpacity: unknown;
  fillOutlineColor?: unknown;
  fillAntialiasOptions?: () => Record<string, unknown>;
}

export interface ChoroplethFillLayerMap {
  getLayer?(id: string): unknown;
  getSource?(id: string): unknown;
  addSource?(id: string, spec: Record<string, unknown>): void;
  addLayer?(layer: Record<string, unknown>, before?: string): void;
  removeLayer?(id: string): void;
  removeSource?(id: string): void;
  setPaintProperty?(layer: string, prop: string, value: unknown): void;
}

export function createChoroplethFillLayer(
  map: ChoroplethFillLayerMap,
  geojson: FeatureCollection,
  spec: ChoroplethFillLayerSpec,
  beforeLayerId?: string
): void {
  removeChoroplethFillLayer(map, spec);

  map.addSource?.(spec.sourceId, {
    type: 'geojson',
    data: geojson,
    ...(spec.sourceOptions ?? {}),
  });

  const fillLayer: Record<string, unknown> = {
    id: spec.fillLayerId,
    type: 'fill',
    source: spec.sourceId,
    paint: buildChoroplethFillPaint(
      map as never,
      {
        'fill-color': spec.fillColor,
        'fill-opacity': spec.fillOpacity,
        ...(spec.fillOutlineColor !== undefined
          ? { 'fill-outline-color': spec.fillOutlineColor }
          : {}),
      },
      spec.fillAntialiasOptions?.() ?? {}
    ),
  };

  if (beforeLayerId && map.getLayer?.(beforeLayerId)) {
    map.addLayer?.(fillLayer, beforeLayerId);
  } else {
    map.addLayer?.(fillLayer);
  }
}

export function removeChoroplethFillLayer(
  map: ChoroplethFillLayerMap,
  spec: Pick<ChoroplethFillLayerSpec, 'sourceId' | 'fillLayerId'>
): void {
  try {
    if (map.getLayer?.(spec.fillLayerId)) map.removeLayer?.(spec.fillLayerId);
    if (map.getSource?.(spec.sourceId)) map.removeSource?.(spec.sourceId);
  } catch {
    // map may be destroyed
  }
}

export function setChoroplethFillVisibility(
  map: ChoroplethFillLayerMap,
  spec: Pick<ChoroplethFillLayerSpec, 'fillLayerId' | 'fillOpacity'>,
  visible: boolean,
  hiddenOpacity: unknown = 0
): void {
  if (!map.getLayer?.(spec.fillLayerId)) return;
  map.setPaintProperty?.(
    spec.fillLayerId,
    'fill-opacity',
    visible ? spec.fillOpacity : hiddenOpacity
  );
}
