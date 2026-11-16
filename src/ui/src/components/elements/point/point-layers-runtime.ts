/**
 * Geokit Point Component
 *
 * Creates simple geometric points/dots on the map for marking coordinates.
 * Optional glow: set glow or glow="true" for a halo behind the point (off by default). Use glow-color or leave unset to match the point color.
 * Visual states: hover (on mouseover), selected (ring + shadow; attribute `selected` or focus()/blur()).
 *
 * Usage:
 * <gk-point lat="40.7128" lng="-74.0060" color="#ff0000" size="8"></gk-point>
 * <gk-point lat="40.7128" lng="-74.0060" color="#ff0000" size="8" glow></gk-point>
 */

import { MapChildElement } from '../../map-child-element';
import {
  extractPointLngLat,
  normalizeCoordinatesArray,
  isValidCoordinate,
} from '@doppler-group/geokit/core/coordinates';
import type { MapEvent, MapRenderedFeature } from '../../../providers/types';
import { getCSSVariable, getCSSVariableNumber } from '../../../utils/theme';
import { createGeokitLogger } from '../../../utils/logger';
import { PopupElement } from '../popup/popup';
import { readFirstPointCoordinatesFromGeoJsonSource } from '../../../utils/geojson-source-options';
import { applyPointPaintProperties } from './point-style';
import { createPointLayers as createPointLayersFn, type PointMapLike } from './point-layers';
import {
  applySelectedVisual as applySelectedVisualFn,
  clearSelectedVisual,
} from './point-selection';

import { pointEl } from './point-el';
const { debug } = createGeokitLogger('point');

export interface PointOptions {
  lat: number;
  lng: number;
  color?: string;
  size?: number;
  opacity?: number;
  blur?: number;
  strokeColor?: string;
  strokeWidth?: number;
  strokeOpacity?: number;
  shadow?: boolean;
  shadowColor?: string;
  shadowBlur?: number;
  shadowOpacity?: number;
  /** When true, show a halo/glow behind the point (default: false). */
  glow?: boolean;
  /** Glow color; defaults to the point color when not set. */
  glowColor?: string;
  glowOpacity?: number;
  glowBlur?: number;
  pointId?: string;
  pointName?: string;
}

import { PointBase } from './point-base';

export class PointLayersRuntime extends PointBase {
  protected addPoint(): void {
    if (!pointEl(this).map) return;

    // When inside gk-point-layer, don't create own source/layers; parent gathers from children
    if (pointEl(this).isInsidePointLayer) {
      pointEl(this).dispatchEvent(new CustomEvent('gk-point-data-changed', { bubbles: true }));
      return;
    }

    // Read from properties first (set by create()), then fall back to attributes
    const lat = pointEl(this)._propLat ?? parseFloat(pointEl(this).safeGetAttribute('lat') || '');
    const lng = pointEl(this)._propLng ?? parseFloat(pointEl(this).safeGetAttribute('lng') || '');

    // Skip if attributes haven't been set yet
    if (isNaN(lat) || isNaN(lng)) {
      debug.log('addPoint skipped: no lat/lng', { lat, lng });
      return;
    }
    debug.log('addPoint', { lat, lng, sourceId: pointEl(this).sourceId, layerId: pointEl(this).layerId });

    if (!isValidCoordinate([lat, lng])) {
      console.warn('[gk-point] Invalid lat/lng coordinates', { lat, lng });
      return;
    }

    // Normalize coordinates
    const normalized = normalizeCoordinatesArray([[lng, lat]], 'lonlat', 'auto');
    const [normLng, normLat] = normalized[0];

    // Remove existing point
    pointEl(this).removePoint();

    // Get point metadata - read from properties first (set by create())
    const pointId = pointEl(this)._propPointId ?? pointEl(this).safeGetAttribute('point-id');
    const pointName = pointEl(this)._propPointName ?? pointEl(this).safeGetAttribute('point-name');

    // Create GeoJSON point data. Always set point-id for feature-state (hover) and promoteId.
    const featureId = pointId ?? pointEl(this).sourceId ?? `point-${crypto.randomUUID()}`;
    const pointData: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [normLng, normLat],
          },
          properties: {
            color: pointEl(this).color,
            size: pointEl(this).size,
            'point-id': featureId,
            ...(pointId && { id: pointId }),
            ...(pointName && { 'point-name': pointName }),
            ...pointEl(this).listingPopupProperties(),
          },
        },
      ],
    };

    pointEl(this).createPointLayers(pointData, featureId);

    // Setup both hover and click handlers (hover always; click when pointId or pointName)
    pointEl(this).setupInteractions(featureId);

    // Dispatch event
    pointEl(this).dispatchEvent(
      new CustomEvent('point-created', {
        detail: { lat: normLat, lng: normLng, element: this },
        bubbles: true,
      })
    );
  }

  protected createPointLayers(pointData: GeoJSON.FeatureCollection, _featureId: string): void {
    if (!pointEl(this).map || !pointEl(this).sourceId || !pointEl(this).layerId) {
      debug.log('createPointLayers skipped: map or IDs missing', {
        hasMap: !!pointEl(this).map,
        sourceId: pointEl(this).sourceId,
        layerId: pointEl(this).layerId,
      });
      console.warn('[gk-point] Cannot create layers: map or IDs missing', {
        hasMap: !!pointEl(this).map,
        sourceId: pointEl(this).sourceId,
        layerId: pointEl(this).layerId,
      });
      return;
    }
    debug.log('createPointLayers adding source + layers', {
      sourceId: pointEl(this).sourceId,
      layerId: pointEl(this).layerId,
    });
    createPointLayersFn(
      {
        map: pointEl(this).map as PointMapLike,
        mapElement: pointEl(this).mapElement ?? document.documentElement,
        sourceId: pointEl(this).sourceId,
        layerId: pointEl(this).layerId,
        shadowLayerId: pointEl(this).shadowLayerId,
        glowLayerId: pointEl(this).glowLayerId,
        hoverSourceId: pointEl(this).hoverSourceId,
        hoverLayerId: pointEl(this).hoverLayerId,
        size: pointEl(this).size,
        color: pointEl(this).color,
        opacity: pointEl(this).opacity,
        pointBlur: pointEl(this).pointBlur,
        strokeWidth: pointEl(this).strokeWidth,
        strokeColor: pointEl(this).strokeColor,
        strokeOpacity: pointEl(this).strokeOpacity,
        glow: pointEl(this).glow,
        glowColor: pointEl(this).glowColor,
        glowOpacity: pointEl(this).glowOpacity,
        glowBlur: pointEl(this).glowBlur,
        shadow: pointEl(this).shadow,
        shadowColor: pointEl(this).shadowColor,
        shadowOpacity: pointEl(this).shadowOpacity,
        shadowBlur: pointEl(this).shadowBlur,
      },
      pointData
    );
  }

  protected setHoverAt(coordinates: [number, number] | null): void {
    if (!pointEl(this).map || !pointEl(this).hoverSourceId) return;
    const source = pointEl(this).map.getSource?.(pointEl(this).hoverSourceId) as
      | { setData?: (d: GeoJSON.FeatureCollection) => void }
      | undefined;
    const setData = source?.setData;
    if (!setData) return;
    const setDataFn = setData as (d: GeoJSON.FeatureCollection) => void;
    try {
      if (!coordinates) {
        setDataFn({ type: 'FeatureCollection', features: [] });
        return;
      }
      setDataFn({
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: { type: 'Point', coordinates },
            properties: {},
          },
        ],
      });
    } catch {
      // Source may be stale after style change or removal (SDK can throw setting _data)
    }
  }

  protected setupInteractions(_featureId: string): void {
    if (!pointEl(this).map || !pointEl(this).layerId) return;

    // Use glow layer for hover when present (larger hit area); otherwise point layer
    pointEl(this).hoverEventLayerId = pointEl(this).glow && pointEl(this).glowLayerId ? pointEl(this).glowLayerId : pointEl(this).layerId;
    const hoverLayerId = pointEl(this).hoverEventLayerId;

    // Hover: drive hover glow layer via setData + dispatch gk-point-hover / gk-point-hover-end
    const onMouseEnter = (e: MapEvent): void => {
      if (pointEl(this).selectedLayers) return;
      const canvas = pointEl(this).map?.getCanvas?.();
      if (canvas?.style) canvas.style.cursor = 'pointer';
      const features = e?.features;
      if (
        features?.length &&
        features[0].geometry?.type === 'Point' &&
        'coordinates' in features[0].geometry
      ) {
        const coords = features[0].geometry.coordinates as [number, number];
        pointEl(this).setHoverAt(coords);

        const pointId = pointEl(this)._propPointId ?? pointEl(this).safeGetAttribute('point-id');
        const pointName = pointEl(this)._propPointName ?? pointEl(this).safeGetAttribute('point-name');
        pointEl(this).dispatchEvent(
          new CustomEvent('gk-point-hover', {
            detail: {
              pointId,
              pointName,
              lngLat: { lng: coords[0], lat: coords[1] },
              map: pointEl(this).map,
              pointElement: this,
            },
            bubbles: true,
            cancelable: true,
          })
        );
      }
    };
    const onMouseLeave = (): void => {
      const canvas = pointEl(this).map?.getCanvas?.();
      if (canvas?.style) canvas.style.cursor = '';
      pointEl(this).setHoverAt(null);

      pointEl(this).dispatchEvent(
        new CustomEvent('gk-point-hover-end', {
          detail: { map: pointEl(this).map, pointElement: this },
          bubbles: true,
          cancelable: true,
        })
      );
    };
    pointEl(this).map.on('mouseenter', hoverLayerId, onMouseEnter);
    pointEl(this).map.on('mouseleave', hoverLayerId, onMouseLeave);

    // Click handling
    pointEl(this).clickHandler = (e: MapEvent) => {
      if (e.originalEvent) {
        e.originalEvent.stopPropagation();
        e.originalEvent.stopImmediatePropagation();
      }

      const feature = e.features?.[0];
      if (!feature || !e.lngLat) return;

      // Type guard: ensure feature has required properties
      if (!('properties' in feature) || !('geometry' in feature)) return;

      const pointId =
        (feature.properties as Record<string, unknown>)?.['point-id'] ||
        (feature.properties as Record<string, unknown>)?.['id'] ||
        pointEl(this)._propPointId ||
        pointEl(this).safeGetAttribute('point-id');
      const pointName =
        (feature.properties as Record<string, unknown>)?.['point-name'] ||
        (feature.properties as Record<string, unknown>)?.['name'] ||
        pointEl(this)._propPointName ||
        pointEl(this).safeGetAttribute('point-name');

      if (pointId || pointName) {
        // Create a proper GeoJSON Feature for type safety
        const geoJsonFeature: GeoJSON.Feature = {
          type: 'Feature',
          geometry: feature.geometry as GeoJSON.Geometry,
          properties: (feature.properties as Record<string, unknown>) || {},
        };
        pointEl(this).handlePointSelect(
          geoJsonFeature,
          typeof pointId === 'string' ? pointId : null,
          typeof pointName === 'string' ? pointName : null,
          e.lngLat
        );
      }
    };

    pointEl(this).map.on('click', pointEl(this).layerId, pointEl(this).clickHandler);
    pointEl(this).map.on('touchend', pointEl(this).layerId, pointEl(this).clickHandler);

    // Map click for blur (deselection)
    pointEl(this).mapClickHandler = (e: MapEvent) => {
      if (!pointEl(this).map || !pointEl(this).layerId) return;
      if (!pointEl(this).map.getLayer?.(pointEl(this).layerId)) return;
      if (typeof pointEl(this).map.isStyleLoaded === 'function' && !pointEl(this).map.isStyleLoaded()) return;
      if (!e.point || !pointEl(this).map.queryRenderedFeatures) return;

      let features: MapRenderedFeature[] = [];
      try {
        features = pointEl(this).map.queryRenderedFeatures(e.point, { layers: [pointEl(this).layerId] });
      } catch {
        // MapTiler/MapLibre can throw e.g. "unknown feature value" when parsing vector tiles
        return;
      }
      if (features.length === 0) {
        pointEl(this).blur();
        if (pointEl(this).popupInstance) {
          pointEl(this).popupInstance.remove();
          pointEl(this).popupInstance = null;
        }

        pointEl(this).dispatchEvent(
          new CustomEvent('gk-point-blur', {
            detail: { map: pointEl(this).map },
            bubbles: true,
            cancelable: true,
          })
        );
      }
    };

    pointEl(this).map.on('click', pointEl(this).mapClickHandler);
    pointEl(this).map.on('touchend', pointEl(this).mapClickHandler);

    // Remove map listeners when map is about to be destroyed (freeze) so no handler runs on destroyed map
    pointEl(this)._mapUnloadHandler = () => pointEl(this).removeMapListeners();
    pointEl(this).addEventListener('gk-map-unload', pointEl(this)._mapUnloadHandler);
  }

  /**
   * Remove only map event listeners (used on gk-map-unload before map.remove()).
   * Does not remove layers; map.remove() destroys the map.
   */
  protected removeMapListeners(): void {
    if (pointEl(this)._mapUnloadHandler) {
      pointEl(this).removeEventListener('gk-map-unload', pointEl(this)._mapUnloadHandler);
      pointEl(this)._mapUnloadHandler = null;
    }
    if (!pointEl(this).map?.off) return;

    if (pointEl(this).clickHandler && pointEl(this).layerId) {
      try {
        pointEl(this).map.off('click', pointEl(this).layerId, pointEl(this).clickHandler);
        pointEl(this).map.off('touchend', pointEl(this).layerId, pointEl(this).clickHandler);
      } catch {
        // Map may already be destroyed
      }
      pointEl(this).clickHandler = null;
    }

    if (pointEl(this).mapClickHandler) {
      try {
        pointEl(this).map.off('click', pointEl(this).mapClickHandler);
        pointEl(this).map.off('touchend', pointEl(this).mapClickHandler);
      } catch {
        // Map may already be destroyed
      }
      pointEl(this).mapClickHandler = null;
    }

    const hoverLayer = pointEl(this).hoverEventLayerId ?? pointEl(this).layerId;
    if (hoverLayer) {
      try {
        pointEl(this).map.off('mouseenter', hoverLayer);
        pointEl(this).map.off('mouseleave', hoverLayer);
      } catch {
        // Map may already be destroyed
      }
      pointEl(this).hoverEventLayerId = null;
    }

    pointEl(this).setHoverAt(null);
  }

  /** Feature geometry aligned with the main point source — keeps ring/shadow centered on the dot. */
}
