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
} from '@local-hosting/geokit/core/coordinates';
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

export class PointBase extends MapChildElement {
  static observedAttributes = [
    'lat',
    'lng',
    'color',
    'size',
    'opacity',
    'blur',
    'stroke-color',
    'stroke-width',
    'stroke-opacity',
    'shadow',
    'shadow-color',
    'shadow-blur',
    'shadow-opacity',
    'glow',
    'glow-color',
    'glow-opacity',
    'glow-blur',
    'point-id',
    'point-name',
    'selected',
  ];

  protected sourceId: string | null = null;
  protected layerId: string | null = null;
  protected shadowLayerId: string | null = null;
  protected glowLayerId: string | null = null;
  protected hoverSourceId: string | null = null;
  protected hoverLayerId: string | null = null;
  /** Layer we attach mouseenter/mouseleave to (glow or main); for teardown only. */
  protected hoverEventLayerId: string | null = null;
  protected popupInstance: { remove: () => void } | null = null;
  /** Last feature.properties shown in popup (for re-open after style change so tags/address persist). */
  protected _lastPopupProperties: Record<string, unknown> | null = null;
  /** Selected state: ring + shadow. Synced with selected attribute and focus()/blur(). */
  protected selectedLayers: {
    layerId: string;
    shadowLayerId: string;
    sourceId: string;
  } | null = null;
  protected clickHandler: ((e: MapEvent) => void) | null = null;
  protected mapClickHandler: ((e: MapEvent) => void) | null = null;
  protected clearHandler: ((event: Event) => void) | null = null;
  protected clearPopupHandler: ((event: Event) => void) | null = null;
  protected selectedCreatedTime: number | null = null;
  protected popupCreatedTime: number | null = null;

  constructor() {
    super();
    pointEl(this).attachShadow({ mode: 'open' });
  }

  protected hasGeneratedIds = false;

  // Store options as properties (works in JSDOM without setAttribute issues)
  protected _propLat?: number;
  protected _propLng?: number;
  protected _propColor?: string;
  protected _propSize?: number;
  protected _propOpacity?: number;
  protected _propBlur?: number;
  protected _propStrokeWidth?: number;
  protected _propStrokeColor?: string;
  protected _propStrokeOpacity?: number;
  protected _propShadow?: boolean;
  protected _propShadowColor?: string;
  protected _propShadowBlur?: number;
  protected _propShadowOpacity?: number;
  protected _propGlow?: boolean;
  protected _propGlowColor?: string;
  protected _propGlowOpacity?: number;
  protected _propGlowBlur?: number;
  protected _propPointId?: string;
  protected _propPointName?: string;

  /**
   * Apply stored create options as properties (not attributes)
   * This avoids JSDOM's buggy setAttribute for custom elements
   */
  protected applyCreateOptions(options: PointOptions): void {
    // Store as properties - getters will read from these
    pointEl(this)._propLat = options.lat;
    pointEl(this)._propLng = options.lng;
    if (options.color) pointEl(this)._propColor = options.color;
    if (options.size !== undefined) pointEl(this)._propSize = options.size;
    if (options.opacity !== undefined) pointEl(this)._propOpacity = options.opacity;
    if (options.blur !== undefined) pointEl(this)._propBlur = options.blur;
    if (options.strokeWidth !== undefined) pointEl(this)._propStrokeWidth = options.strokeWidth;
    if (options.strokeColor) pointEl(this)._propStrokeColor = options.strokeColor;
    if (options.strokeOpacity !== undefined) pointEl(this)._propStrokeOpacity = options.strokeOpacity;
    if (options.shadow) {
      pointEl(this)._propShadow = true;
      if (options.shadowColor) pointEl(this)._propShadowColor = options.shadowColor;
      if (options.shadowBlur !== undefined) pointEl(this)._propShadowBlur = options.shadowBlur;
      if (options.shadowOpacity !== undefined) pointEl(this)._propShadowOpacity = options.shadowOpacity;
    }
    if (options.glow) {
      pointEl(this)._propGlow = true;
      if (options.glowColor) pointEl(this)._propGlowColor = options.glowColor;
      if (options.glowOpacity !== undefined) pointEl(this)._propGlowOpacity = options.glowOpacity;
      if (options.glowBlur !== undefined) pointEl(this)._propGlowBlur = options.glowBlur;
    }
    if (options.pointId) pointEl(this)._propPointId = options.pointId;
    if (options.pointName) pointEl(this)._propPointName = options.pointName;
  }

  override async connectedCallback() {
    try {
      // Apply options from create() factory method as attributes
      // This ensures attributes are set after element is connected (works in JSDOM/Happy-DOM)
      const createOptions = (this as any)._createOptions;
      if (createOptions) {
        pointEl(this).applyCreateOptions(createOptions);
        // Clear stored options
        (this as any)._createOptions = undefined;
      }

      // Generate unique IDs BEFORE calling super (which sets isInitialized)
      if (!pointEl(this).hasGeneratedIds) {
        const uuid = crypto.randomUUID();
        pointEl(this).sourceId = `point-source-${uuid}`;
        pointEl(this).layerId = `point-layer-${uuid}`;
        pointEl(this).shadowLayerId = `point-shadow-${uuid}`;
        pointEl(this).glowLayerId = `point-glow-${uuid}`;
        pointEl(this).hoverSourceId = `point-hover-${uuid}`;
        pointEl(this).hoverLayerId = `point-hover-layer-${uuid}`;
        pointEl(this).hasGeneratedIds = true;
      }

      // Always find parent map, even if already initialized (for map reuse)
      // This is critical when points are moved between maps via map pool
      pointEl(this).addToParentMap();

      // Call super only if not already initialized (to avoid duplicate setup)
      if (!pointEl(this).isInitialized) {
        await super.connectedCallback();
      }

      // Setup event listeners (idempotent)
      pointEl(this).setupEventListeners();
    } catch (error) {
      console.error(`[gk-point] Error in connectedCallback:`, error);
      throw error;
    }
  }

  protected override async onMapReady(): Promise<void> {
    await super.onMapReady();
    if (!pointEl(this).map) return;

    // MapTiler may report loaded() before addSource/addLayer are safe; defer like polyline.
    pointEl(this).waitForStyleLoaded(() => pointEl(this).addPoint());
  }

  /** Re-add point layers after map style change only when overlays were dropped. */
  protected override onStyleLoad(): void {
    debug.log('onStyleLoad', {
      hasMap: !!pointEl(this).map,
      sourceId: pointEl(this).sourceId,
      layerId: pointEl(this).layerId,
    });
    if (!pointEl(this).map) return;
    // Theme swaps preserve custom overlays — skip rebuild when source+layer survived.
    if (
      pointEl(this).sourceId &&
      pointEl(this).layerId &&
      pointEl(this).map.getSource?.(pointEl(this).sourceId) &&
      pointEl(this).map.getLayer?.(pointEl(this).layerId)
    ) {
      return;
    }
    const hadSelected = !!pointEl(this).selectedLayers;
    // Wait for new style to be ready so addSource/addLayer succeed (e.g. when switching to light, style may not be ready yet).
    pointEl(this).waitForStyleLoaded(() => {
      if (!pointEl(this).map) return;
      pointEl(this).addPoint();
      if (hadSelected) {
        const lat = pointEl(this)._propLat ?? parseFloat(pointEl(this).safeGetAttribute('lat') || '');
        const lng = pointEl(this)._propLng ?? parseFloat(pointEl(this).safeGetAttribute('lng') || '');
        if (!isNaN(lat) && !isNaN(lng)) {
          const pointId = pointEl(this)._propPointId ?? pointEl(this).safeGetAttribute('point-id');
          const pointName = pointEl(this)._propPointName ?? pointEl(this).safeGetAttribute('point-name');
          const properties: Record<string, unknown> = {
            ...(pointEl(this)._lastPopupProperties ?? {}),
            'point-id': pointId ?? pointEl(this).sourceId ?? '',
            ...(pointName && { 'point-name': pointName }),
          };
          const feature: GeoJSON.Feature = {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [lng, lat] },
            properties,
          };
          const canonical = pointEl(this).canonicalPointFeature(feature);
          const anchorLngLat = (canonical && extractPointLngLat(canonical.geometry)) ?? {
            lng,
            lat,
          };
          pointEl(this).handlePointSelect(
            feature,
            pointId != null ? String(pointId) : null,
            pointName != null ? String(pointName) : null,
            anchorLngLat
          );
        }
      }
    });
  }

  protected setupEventListeners(): void {
    // Clear popup handler
    pointEl(this).clearPopupHandler = (event: Event) => {
      const customEvent = event as CustomEvent;
      const { pointElement, pointId: excludePointId } = customEvent.detail || {};

      if (pointElement === this) return;

      const thisPointId = pointEl(this)._propPointId ?? pointEl(this).safeGetAttribute('point-id');
      if (excludePointId && thisPointId && String(thisPointId) === String(excludePointId)) {
        return;
      }

      if (pointEl(this).popupInstance) {
        pointEl(this).popupInstance.remove();
        pointEl(this).popupInstance = null;
      }
    };

    // Clear selected state on other points
    pointEl(this).clearHandler = (event: Event) => {
      const customEvent = event as CustomEvent;
      const { pointElement, pointId: excludePointId } = customEvent.detail || {};

      if (pointElement === this) return;

      const thisPointId = pointEl(this)._propPointId ?? pointEl(this).safeGetAttribute('point-id');
      if (excludePointId && thisPointId && String(thisPointId) === String(excludePointId)) {
        return;
      }

      const now = Date.now();
      if (pointEl(this).selectedCreatedTime && now - pointEl(this).selectedCreatedTime < 200) {
        return;
      }

      if (pointEl(this).popupInstance) {
        if (!pointEl(this).popupCreatedTime || now - pointEl(this).popupCreatedTime > 100) {
          pointEl(this).blur();
          pointEl(this).popupInstance.remove();
          pointEl(this).popupInstance = null;
        }
      } else {
        pointEl(this).blur();
      }
    };

    document.addEventListener('gk-clear-all-focus', pointEl(this).clearHandler); // clears selected state
    document.addEventListener('gk-clear-all-popups', pointEl(this).clearPopupHandler);
  }

  /**
   * When inside a gk-point-layer, the parent owns the shared layers; this point only contributes data.
   */
  protected listingPopupProperties(): Record<string, unknown> {
    const extra = (this as { _dataProperties?: Record<string, unknown> })._dataProperties;
    if (!extra || typeof extra !== 'object') return {};
    const out: Record<string, unknown> = {};
    if (typeof extra.url === 'string' && extra.url.trim()) out.url = extra.url.trim();
    if (typeof extra.city === 'string' && extra.city.trim()) out.city = extra.city.trim();
    if (typeof extra.state === 'string' && extra.state.trim()) out.state = extra.state.trim();
    return out;
  }

  protected get isInsidePointLayer(): boolean {
    return pointEl(this).parentElement?.tagName?.toLowerCase() === 'gk-point-layer';
  }

}
