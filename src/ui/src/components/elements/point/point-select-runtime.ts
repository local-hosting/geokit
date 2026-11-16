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

import { PointLayersRuntime } from './point-layers-runtime';

export class PointSelectRuntime extends PointLayersRuntime {
  protected canonicalPointFeature(fallback: GeoJSON.Feature): GeoJSON.Feature | null {
    const properties = { ...(fallback.properties as Record<string, unknown>) };

    if (pointEl(this).map && pointEl(this).sourceId) {
      const source = pointEl(this).map.getSource?.(pointEl(this).sourceId) as
        | {
            _data?: GeoJSON.FeatureCollection;
            _geojson?: GeoJSON.FeatureCollection;
            data?: GeoJSON.FeatureCollection;
          }
        | undefined;
      const fromSource = readFirstPointCoordinatesFromGeoJsonSource(source);
      if (fromSource) {
        return {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: fromSource },
          properties,
        };
      }
    }

    const lat = pointEl(this)._propLat ?? parseFloat(pointEl(this).safeGetAttribute('lat') || '');
    const lng = pointEl(this)._propLng ?? parseFloat(pointEl(this).safeGetAttribute('lng') || '');
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return fallback.geometry?.type === 'Point' ? fallback : null;
    }
    const normalized = normalizeCoordinatesArray([[lng, lat]], 'lonlat', 'auto');
    const [normLng, normLat] = normalized[0];
    return {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [normLng, normLat] },
      properties,
    };
  }

  protected handlePointSelect(
    feature: GeoJSON.Feature,
    pointId: string | null,
    pointName: string | null,
    lngLat: { lng: number; lat: number }
  ): void {
    // Clear existing selected state
    if (pointEl(this).popupInstance) {
      pointEl(this).popupInstance.remove();
      pointEl(this).popupInstance = null;
    }
    pointEl(this).blur();

    // Ring must use canonical map coordinates (lat/lng attrs), not click lngLat.
    const selectedFeature = pointEl(this).canonicalPointFeature(feature);
    const anchorLngLat =
      (selectedFeature && extractPointLngLat(selectedFeature.geometry)) ?? lngLat;
    if (selectedFeature) {
      pointEl(this).applySelectedVisual(selectedFeature);
      pointEl(this).setHoverAt(null);
    }

    // Parse title from pointName
    let title = '';
    if (pointName) {
      const dashIndex = pointName.indexOf('-');
      if (dashIndex > 0) {
        title = pointName.substring(0, dashIndex).trim();
        title = title.replace(/,(\S)/g, ', $1');
      } else {
        title = pointName;
      }
    }
    if (!title && pointId) {
      title = pointId;
    }

    const popupProperties = {
      ...((feature.properties as Record<string, unknown>) || {}),
      ...pointEl(this).listingPopupProperties(),
    };
    const listingUrl = typeof popupProperties.url === 'string' ? popupProperties.url.trim() : '';

    // Show popup when we have a title or an external listing link
    if ((title || listingUrl) && pointEl(this).map) {
      try {
        const properties = popupProperties as Record<string, any>;
        pointEl(this)._lastPopupProperties = { ...properties };
        // Get provider from parent map element
        const provider = pointEl(this).getUIProvider();

        pointEl(this).popupInstance = PopupElement.showPointPopup(
          pointEl(this).popupInstance,
          pointEl(this).map,
          anchorLngLat,
          title,
          properties,
          provider
        );

        const onPopupClose = (): void => {
          pointEl(this).blur();
          pointEl(this).popupInstance = null;
        };

        // Listen for popup close (MapLibre/Mapbox fire 'close' when popup is removed)
        const popup = pointEl(this).popupInstance as { on?: (event: string, fn: () => void) => void } | null;
        if (popup?.on) {
          popup.on('close', onPopupClose);
        }

        // DOM fallback: close button may remove popup without firing 'close' in some SDK versions
        requestAnimationFrame(() => {
          const el = (pointEl(this).popupInstance as { getElement?: () => HTMLElement })?.getElement?.();
          const closeBtn = el?.querySelector?.(
            '.maplibregl-popup-close-button, .mapboxgl-popup-close-button'
          ) as HTMLElement | null;
          if (closeBtn) {
            closeBtn.addEventListener('click', onPopupClose, { once: true });
          }
        });

        pointEl(this).popupCreatedTime = Date.now();
      } catch (error) {
        console.warn('[gk-point] Failed to show popup:', error);
      }
    }

    // Dispatch selected/focus event (gk-point-focus for backward compatibility)
    requestAnimationFrame(() => {
      pointEl(this).dispatchEvent(
        new CustomEvent('gk-point-focus', {
          detail: {
            pointId,
            pointName,
            title,
            lngLat: anchorLngLat,
            map: pointEl(this).map,
            pointElement: this,
          },
          bubbles: true,
          cancelable: true,
        })
      );
    });
  }

  /**
   * Apply selected visual state (white stroke ring + shadow). Hover glow is separate (hover only).
   */
  protected applySelectedVisual(feature: GeoJSON.Feature): void {
    if (!pointEl(this).map || !pointEl(this).layerId || !pointEl(this).sourceId) return;
    pointEl(this).blur();
    const result = applySelectedVisualFn(
      pointEl(this).map as any,
      pointEl(this).layerId,
      pointEl(this).sourceId,
      pointEl(this).size,
      pointEl(this).mapElement ?? document.documentElement,
      feature,
      { pointColor: pointEl(this).color, strokeWidth: pointEl(this).strokeWidth }
    );
    if (result) {
      pointEl(this).selectedLayers = result;
      pointEl(this).selectedCreatedTime = Date.now();
      pointEl(this).safeSetAttribute('selected', 'true');
    }
  }

  /**
   * Clear selected state (remove ring + shadow). Same as blur().
   */
  public blur(): void {
    if (!pointEl(this).map) return;
    pointEl(this).setHoverAt(null);
    pointEl(this).removeAttribute('selected');
    clearSelectedVisual(pointEl(this).map as any, pointEl(this).selectedLayers);
    pointEl(this).selectedLayers = null;
  }

  protected removePoint(): void {
    if (!pointEl(this).map) return;

    if (pointEl(this).popupInstance) {
      pointEl(this).popupInstance.remove();
      pointEl(this).popupInstance = null;
    }

    pointEl(this).removeMapListeners();

    // Cleanup layers
    if (pointEl(this).glowLayerId) {
      debug.log('glow layer REMOVE (teardown)', {
        where: 'point.ts teardown -> cleanupMapLayers',
        when: 'before cleanupMapLayers',
        glowLayerId: pointEl(this).glowLayerId,
      });
    }
    const hoverPointLayerId = pointEl(this).hoverLayerId ? `${pointEl(this).hoverLayerId}-point` : null;
    pointEl(this).cleanupMapLayers(
      [
        pointEl(this).layerId,
        pointEl(this).shadowLayerId,
        pointEl(this).glowLayerId,
        pointEl(this).hoverLayerId,
        hoverPointLayerId,
      ].filter(Boolean) as string[],
      [pointEl(this).sourceId, pointEl(this).hoverSourceId].filter(Boolean) as string[]
    );
  }

  protected updatePointStyle(): void {
    if (!pointEl(this).map || !pointEl(this).layerId) return;
    try {
      applyPointPaintProperties(pointEl(this).map, pointEl(this).layerId, {
        size: pointEl(this).size,
        color: pointEl(this).color,
        opacity: pointEl(this).opacity,
        strokeWidth: pointEl(this).strokeWidth,
        strokeColor: pointEl(this).strokeColor,
        strokeOpacity: pointEl(this).strokeOpacity,
      });
    } catch {
      pointEl(this).addPoint();
    }
  }

  override attributeChangedCallback(
    name: string,
    oldValue: string | null,
    newValue: string | null
  ): void {
    if (pointEl(this).isInitialized && oldValue !== newValue) {
      if (name === 'selected') {
        if (newValue !== null && newValue !== 'false') {
          if (!pointEl(this).selectedLayers) pointEl(this).focus();
        } else {
          pointEl(this).blur();
        }
        return;
      }
      if (
        ['size', 'color', 'opacity', 'stroke-color', 'stroke-width', 'stroke-opacity'].includes(
          name
        )
      ) {
        pointEl(this).updatePointStyle();
      } else if (name === 'lat' || name === 'lng') {
        pointEl(this).addPoint(); // Recreate for position changes
      } else if (name?.startsWith('shadow') || name?.startsWith('glow')) {
        pointEl(this).addPoint(); // Recreate for shadow/glow changes
      } else {
        pointEl(this).addPoint();
      }
    }
  }

  override disconnectedCallback(): void {
    if (pointEl(this).clearHandler) {
      document.removeEventListener('gk-clear-all-focus', pointEl(this).clearHandler);
      document.removeEventListener('gk-clear-all-popups', pointEl(this).clearPopupHandler!);
      pointEl(this).clearHandler = null;
      pointEl(this).clearPopupHandler = null;
    }
    pointEl(this).removePoint();
    super.disconnectedCallback();
  }

  // Getters - read from properties first, then attributes, then CSS variables
}
