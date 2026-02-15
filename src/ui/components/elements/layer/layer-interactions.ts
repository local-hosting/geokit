/**
 * Layer click/hover interactions: setup and teardown (Single Responsibility)
 */

import type { MapEvent } from '../../../providers/types';

export interface LayerClickEventDetail {
  feature: GeoJSON.Feature;
  lngLat: { lng: number; lat: number };
  layerId: string;
  sourceId: string;
  originalEvent: MouseEvent | TouchEvent;
}

export interface LayerMouseEnterEventDetail {
  feature: GeoJSON.Feature;
  lngLat: { lng: number; lat: number };
  layerId: string;
  sourceId: string;
}

export interface LayerMouseLeaveEventDetail {
  layerId: string;
  sourceId: string;
}

export interface LayerInteractionsState {
  currentHoveredFeatureId: string | number | null;
  hoveredFeatureId: string | number | null;
}

type MapLike = {
  on(event: string, handler: (e: MapEvent) => void): void;
  on(event: string, handler: () => void): void;
  off(event: string, handler: (e: MapEvent) => void): void;
  off(event: string, handler: () => void): void;
  queryRenderedFeatures?(
    point: { x: number; y: number },
    options?: { layers: string[] }
  ): Array<{
    id?: string | number;
    geometry?: GeoJSON.Geometry;
    properties?: Record<string, unknown>;
  }>;
  getCanvas?(): HTMLCanvasElement | undefined;
  setFeatureState?(state: { source: string; id: string | number }, props: { hover: boolean }): void;
};

export interface LayerInteractionsContext {
  map: MapLike;
  layerId: string;
  sourceId: string;
  queryLayers: string[];
  hoverState: boolean;
  cursor: string;
  state: LayerInteractionsState;
  dispatchClick: (detail: LayerClickEventDetail) => void;
  dispatchMouseEnter: (detail: LayerMouseEnterEventDetail) => void;
  dispatchMouseLeave: (detail: LayerMouseLeaveEventDetail) => void;
  element: HTMLElement;
}

/**
 * Register click, mousemove, mouseleave on map and gk-map-unload on element.
 * Returns a teardown function that unregisters listeners and clears hover state.
 */
export function setupLayerInteractions(ctx: LayerInteractionsContext): () => void {
  const { map, layerId, sourceId, queryLayers, hoverState, cursor, state, element } = ctx;

  const queryFeaturesAtPoint = (point: { x: number; y: number }) => {
    try {
      return map.queryRenderedFeatures?.(point, { layers: queryLayers }) ?? [];
    } catch {
      return [];
    }
  };

  const clickHandler = (e: MapEvent) => {
    if (!e.point) return;
    const features = queryFeaturesAtPoint(e.point);
    if (features.length === 0) return;
    const feature = features[0];
    const lngLat = e.lngLat ?? { lng: 0, lat: 0 };
    const featureId = feature.id as string | number | undefined;
    const geoJsonFeature: GeoJSON.Feature = {
      type: 'Feature',
      geometry: feature.geometry as GeoJSON.Geometry,
      properties: feature.properties ?? {},
      ...(featureId !== undefined && { id: featureId }),
    };
    ctx.dispatchClick({
      feature: geoJsonFeature,
      lngLat: { lng: lngLat.lng, lat: lngLat.lat },
      layerId,
      sourceId,
      originalEvent: e.originalEvent as MouseEvent | TouchEvent,
    });
  };

  const mouseMoveHandler = (e: MapEvent) => {
    if (!e.point) return;
    const features = queryFeaturesAtPoint(e.point);
    const featureId =
      features.length > 0 ? (features[0].id as string | number | undefined) : undefined;
    if (featureId === state.currentHoveredFeatureId) return;

    const container = map.getCanvas?.();

    if (state.currentHoveredFeatureId !== null && featureId !== state.currentHoveredFeatureId) {
      if (container) container.style.cursor = '';
      if (hoverState && state.hoveredFeatureId !== null) {
        try {
          map.setFeatureState?.({ source: sourceId, id: state.hoveredFeatureId }, { hover: false });
        } catch {
          // Ignore
        }
        state.hoveredFeatureId = null;
      }
      ctx.dispatchMouseLeave({ layerId, sourceId });
    }

    if (featureId !== undefined && features.length > 0) {
      const feature = features[0];
      const lngLat = e.lngLat ?? { lng: 0, lat: 0 };
      if (container) container.style.cursor = cursor;
      if (hoverState) {
        state.hoveredFeatureId = featureId;
        try {
          map.setFeatureState?.({ source: sourceId, id: featureId }, { hover: true });
        } catch {
          // Ignore
        }
      }
      const geoJsonFeature: GeoJSON.Feature = {
        type: 'Feature',
        geometry: feature.geometry as GeoJSON.Geometry,
        properties: feature.properties ?? {},
        ...(featureId !== undefined && { id: featureId }),
      };
      ctx.dispatchMouseEnter({
        feature: geoJsonFeature,
        lngLat: { lng: lngLat.lng, lat: lngLat.lat },
        layerId,
        sourceId,
      });
    }

    state.currentHoveredFeatureId = featureId ?? null;
  };

  const mouseLeaveHandler = () => {
    if (state.currentHoveredFeatureId === null) return;
    const container = map.getCanvas?.();
    if (container) container.style.cursor = '';
    if (hoverState && state.hoveredFeatureId !== null) {
      try {
        map.setFeatureState?.({ source: sourceId, id: state.hoveredFeatureId }, { hover: false });
      } catch {
        // Ignore
      }
      state.hoveredFeatureId = null;
    }
    ctx.dispatchMouseLeave({ layerId, sourceId });
    state.currentHoveredFeatureId = null;
  };

  const teardown = () => {
    element.removeEventListener('gk-map-unload', teardown);
    if (!map.off) return;
    try {
      map.off('click', clickHandler);
      map.off('mousemove', mouseMoveHandler);
      map.off('mouseleave', mouseLeaveHandler);
    } catch {
      // Map may already be destroyed
    }
    if (state.hoveredFeatureId !== null) {
      try {
        map.setFeatureState?.({ source: sourceId, id: state.hoveredFeatureId }, { hover: false });
      } catch {
        // Ignore
      }
      state.hoveredFeatureId = null;
    }
    state.currentHoveredFeatureId = null;
  };

  map.on('click', clickHandler);
  map.on('mousemove', mouseMoveHandler);
  map.on('mouseleave', mouseLeaveHandler);
  element.addEventListener('gk-map-unload', teardown);

  return teardown;
}
