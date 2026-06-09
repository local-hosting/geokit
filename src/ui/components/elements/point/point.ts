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
import { normalizeCoordinatesArray, isValidCoordinate } from '../../../../utils/coordinates';
import type { MapEvent, MapRenderedFeature } from '../../../providers/types';
import { getCSSVariable, getCSSVariableNumber } from '../../../utils/theme';
import { debug } from '../../../utils/logger';
import { PopupElement } from '../popup/popup';
import { applyPointPaintProperties } from './point-style';
import { createPointLayers as createPointLayersFn, type PointMapLike } from './point-layers';
import {
  applySelectedVisual as applySelectedVisualFn,
  clearSelectedVisual,
} from './point-selection';

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

export class PointElement extends MapChildElement {
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

  private sourceId: string | null = null;
  private layerId: string | null = null;
  private shadowLayerId: string | null = null;
  private glowLayerId: string | null = null;
  private hoverSourceId: string | null = null;
  private hoverLayerId: string | null = null;
  /** Layer we attach mouseenter/mouseleave to (glow or main); for teardown only. */
  private hoverEventLayerId: string | null = null;
  private popupInstance: { remove: () => void } | null = null;
  /** Last feature.properties shown in popup (for re-open after style change so tags/address persist). */
  private _lastPopupProperties: Record<string, unknown> | null = null;
  /** Selected state: ring + shadow. Synced with selected attribute and focus()/blur(). */
  private selectedLayers: {
    layerId: string;
    shadowLayerId: string;
    sourceId: string;
  } | null = null;
  private clickHandler: ((e: MapEvent) => void) | null = null;
  private mapClickHandler: ((e: MapEvent) => void) | null = null;
  private clearHandler: ((event: Event) => void) | null = null;
  private clearPopupHandler: ((event: Event) => void) | null = null;
  private selectedCreatedTime: number | null = null;
  private popupCreatedTime: number | null = null;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  private hasGeneratedIds = false;

  // Store options as properties (works in JSDOM without setAttribute issues)
  private _propLat?: number;
  private _propLng?: number;
  private _propColor?: string;
  private _propSize?: number;
  private _propOpacity?: number;
  private _propBlur?: number;
  private _propStrokeWidth?: number;
  private _propStrokeColor?: string;
  private _propStrokeOpacity?: number;
  private _propShadow?: boolean;
  private _propShadowColor?: string;
  private _propShadowBlur?: number;
  private _propShadowOpacity?: number;
  private _propGlow?: boolean;
  private _propGlowColor?: string;
  private _propGlowOpacity?: number;
  private _propGlowBlur?: number;
  private _propPointId?: string;
  private _propPointName?: string;

  /**
   * Apply stored create options as properties (not attributes)
   * This avoids JSDOM's buggy setAttribute for custom elements
   */
  protected applyCreateOptions(options: PointOptions): void {
    // Store as properties - getters will read from these
    this._propLat = options.lat;
    this._propLng = options.lng;
    if (options.color) this._propColor = options.color;
    if (options.size !== undefined) this._propSize = options.size;
    if (options.opacity !== undefined) this._propOpacity = options.opacity;
    if (options.blur !== undefined) this._propBlur = options.blur;
    if (options.strokeWidth !== undefined) this._propStrokeWidth = options.strokeWidth;
    if (options.strokeColor) this._propStrokeColor = options.strokeColor;
    if (options.strokeOpacity !== undefined) this._propStrokeOpacity = options.strokeOpacity;
    if (options.shadow) {
      this._propShadow = true;
      if (options.shadowColor) this._propShadowColor = options.shadowColor;
      if (options.shadowBlur !== undefined) this._propShadowBlur = options.shadowBlur;
      if (options.shadowOpacity !== undefined) this._propShadowOpacity = options.shadowOpacity;
    }
    if (options.glow) {
      this._propGlow = true;
      if (options.glowColor) this._propGlowColor = options.glowColor;
      if (options.glowOpacity !== undefined) this._propGlowOpacity = options.glowOpacity;
      if (options.glowBlur !== undefined) this._propGlowBlur = options.glowBlur;
    }
    if (options.pointId) this._propPointId = options.pointId;
    if (options.pointName) this._propPointName = options.pointName;
  }

  override async connectedCallback() {
    try {
      // Apply options from create() factory method as attributes
      // This ensures attributes are set after element is connected (works in JSDOM/Happy-DOM)
      const createOptions = (this as any)._createOptions;
      if (createOptions) {
        this.applyCreateOptions(createOptions);
        // Clear stored options
        (this as any)._createOptions = undefined;
      }

      // Generate unique IDs BEFORE calling super (which sets isInitialized)
      if (!this.hasGeneratedIds) {
        const uuid = crypto.randomUUID();
        this.sourceId = `point-source-${uuid}`;
        this.layerId = `point-layer-${uuid}`;
        this.shadowLayerId = `point-shadow-${uuid}`;
        this.glowLayerId = `point-glow-${uuid}`;
        this.hoverSourceId = `point-hover-${uuid}`;
        this.hoverLayerId = `point-hover-layer-${uuid}`;
        this.hasGeneratedIds = true;
      }

      // Always find parent map, even if already initialized (for map reuse)
      // This is critical when points are moved between maps via map pool
      this.addToParentMap();

      // Call super only if not already initialized (to avoid duplicate setup)
      if (!this.isInitialized) {
        await super.connectedCallback();
      }

      // Setup event listeners (idempotent)
      this.setupEventListeners();
    } catch (error) {
      console.error(`[Point] Error in connectedCallback:`, error);
      throw error;
    }
  }

  protected override async onMapReady(): Promise<void> {
    // By the time onMapReady is called, the parent gk-map is fully initialized
    // (either via gk-map-ready event or direct getMap() check)
    // No need to wait for style - it's already loaded
    if (!this.map) return;

    this.addPoint();
  }

  /** Re-add point layers after map style change (e.g. theme toggle). */
  protected override onStyleLoad(): void {
    debug.log('[Point] onStyleLoad', {
      hasMap: !!this.map,
      sourceId: this.sourceId,
      layerId: this.layerId,
    });
    if (!this.map) return;
    const hadSelected = !!this.selectedLayers;
    // Wait for new style to be ready so addSource/addLayer succeed (e.g. when switching to light, style may not be ready yet).
    this.waitForStyleLoaded(() => {
      if (!this.map) return;
      this.addPoint();
      if (hadSelected) {
        const lat = this._propLat ?? parseFloat(this.safeGetAttribute('lat') || '');
        const lng = this._propLng ?? parseFloat(this.safeGetAttribute('lng') || '');
        if (!isNaN(lat) && !isNaN(lng)) {
          const pointId = this._propPointId ?? this.safeGetAttribute('point-id');
          const pointName = this._propPointName ?? this.safeGetAttribute('point-name');
          const properties: Record<string, unknown> = {
            ...(this._lastPopupProperties ?? {}),
            'point-id': pointId ?? this.sourceId ?? '',
            ...(pointName && { 'point-name': pointName }),
          };
          const feature: GeoJSON.Feature = {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [lng, lat] },
            properties,
          };
          this.handlePointSelect(
            feature,
            pointId != null ? String(pointId) : null,
            pointName != null ? String(pointName) : null,
            { lng, lat }
          );
        }
      }
    });
  }

  private setupEventListeners(): void {
    // Clear popup handler
    this.clearPopupHandler = (event: Event) => {
      const customEvent = event as CustomEvent;
      const { pointElement, pointId: excludePointId } = customEvent.detail || {};

      if (pointElement === this) return;

      const thisPointId = this._propPointId ?? this.safeGetAttribute('point-id');
      if (excludePointId && thisPointId && String(thisPointId) === String(excludePointId)) {
        return;
      }

      if (this.popupInstance) {
        this.popupInstance.remove();
        this.popupInstance = null;
      }
    };

    // Clear selected state on other points
    this.clearHandler = (event: Event) => {
      const customEvent = event as CustomEvent;
      const { pointElement, pointId: excludePointId } = customEvent.detail || {};

      if (pointElement === this) return;

      const thisPointId = this._propPointId ?? this.safeGetAttribute('point-id');
      if (excludePointId && thisPointId && String(thisPointId) === String(excludePointId)) {
        return;
      }

      const now = Date.now();
      if (this.selectedCreatedTime && now - this.selectedCreatedTime < 200) {
        return;
      }

      if (this.popupInstance) {
        if (!this.popupCreatedTime || now - this.popupCreatedTime > 100) {
          this.blur();
          this.popupInstance.remove();
          this.popupInstance = null;
        }
      } else {
        this.blur();
      }
    };

    document.addEventListener('gk-clear-all-focus', this.clearHandler); // clears selected state
    document.addEventListener('gk-clear-all-popups', this.clearPopupHandler);
  }

  /**
   * When inside a gk-point-layer, the parent owns the shared layers; this point only contributes data.
   */
  private get isInsidePointLayer(): boolean {
    return this.parentElement?.tagName?.toLowerCase() === 'gk-point-layer';
  }

  private addPoint(): void {
    if (!this.map) return;

    // When inside gk-point-layer, don't create own source/layers; parent gathers from children
    if (this.isInsidePointLayer) {
      this.dispatchEvent(new CustomEvent('gk-point-data-changed', { bubbles: true }));
      return;
    }

    // Read from properties first (set by create()), then fall back to attributes
    const lat = this._propLat ?? parseFloat(this.safeGetAttribute('lat') || '');
    const lng = this._propLng ?? parseFloat(this.safeGetAttribute('lng') || '');

    // Skip if attributes haven't been set yet
    if (isNaN(lat) || isNaN(lng)) {
      debug.log('[Point] addPoint skipped: no lat/lng', { lat, lng });
      return;
    }
    debug.log('[Point] addPoint', { lat, lng, sourceId: this.sourceId, layerId: this.layerId });

    if (!isValidCoordinate([lat, lng])) {
      console.warn('Point: Invalid lat/lng coordinates', { lat, lng });
      return;
    }

    // Normalize coordinates
    const normalized = normalizeCoordinatesArray([[lng, lat]], 'lonlat', 'auto');
    const [normLng, normLat] = normalized[0];

    // Remove existing point
    this.removePoint();

    // Get point metadata - read from properties first (set by create())
    const pointId = this._propPointId ?? this.safeGetAttribute('point-id');
    const pointName = this._propPointName ?? this.safeGetAttribute('point-name');

    // Create GeoJSON point data. Always set point-id for feature-state (hover) and promoteId.
    const featureId = pointId ?? this.sourceId ?? `point-${crypto.randomUUID()}`;
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
            color: this.color,
            size: this.size,
            'point-id': featureId,
            ...(pointId && { id: pointId }),
            ...(pointName && { 'point-name': pointName }),
          },
        },
      ],
    };

    this.createPointLayers(pointData, featureId);

    // Setup both hover and click handlers (hover always; click when pointId or pointName)
    this.setupInteractions(featureId);

    // Dispatch event
    this.dispatchEvent(
      new CustomEvent('point-created', {
        detail: { lat: normLat, lng: normLng, element: this },
        bubbles: true,
      })
    );
  }

  private createPointLayers(pointData: GeoJSON.FeatureCollection, _featureId: string): void {
    if (!this.map || !this.sourceId || !this.layerId) {
      debug.log('[Point] createPointLayers skipped: map or IDs missing', {
        hasMap: !!this.map,
        sourceId: this.sourceId,
        layerId: this.layerId,
      });
      console.warn('[Point] Cannot create layers: map or IDs missing', {
        hasMap: !!this.map,
        sourceId: this.sourceId,
        layerId: this.layerId,
      });
      return;
    }
    debug.log('[Point] createPointLayers adding source + layers', {
      sourceId: this.sourceId,
      layerId: this.layerId,
    });
    createPointLayersFn(
      {
        map: this.map as PointMapLike,
        mapElement: this.mapElement ?? document.documentElement,
        sourceId: this.sourceId,
        layerId: this.layerId,
        shadowLayerId: this.shadowLayerId,
        glowLayerId: this.glowLayerId,
        hoverSourceId: this.hoverSourceId,
        hoverLayerId: this.hoverLayerId,
        size: this.size,
        color: this.color,
        opacity: this.opacity,
        pointBlur: this.pointBlur,
        strokeWidth: this.strokeWidth,
        strokeColor: this.strokeColor,
        strokeOpacity: this.strokeOpacity,
        glow: this.glow,
        glowColor: this.glowColor,
        glowOpacity: this.glowOpacity,
        glowBlur: this.glowBlur,
        shadow: this.shadow,
        shadowColor: this.shadowColor,
        shadowOpacity: this.shadowOpacity,
        shadowBlur: this.shadowBlur,
      },
      pointData
    );
  }

  private setHoverAt(coordinates: [number, number] | null): void {
    if (!this.map || !this.hoverSourceId) return;
    const source = this.map.getSource?.(this.hoverSourceId) as
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

  private setupInteractions(_featureId: string): void {
    if (!this.map || !this.layerId) return;

    // Use glow layer for hover when present (larger hit area); otherwise point layer
    this.hoverEventLayerId = this.glow && this.glowLayerId ? this.glowLayerId : this.layerId;
    const hoverLayerId = this.hoverEventLayerId;

    // Hover: drive hover glow layer via setData + dispatch gk-point-hover / gk-point-hover-end
    const onMouseEnter = (e: MapEvent): void => {
      const canvas = this.map?.getCanvas?.();
      if (canvas?.style) canvas.style.cursor = 'pointer';
      const features = e?.features;
      if (
        features?.length &&
        features[0].geometry?.type === 'Point' &&
        'coordinates' in features[0].geometry
      ) {
        const coords = features[0].geometry.coordinates as [number, number];
        this.setHoverAt(coords);

        const pointId = this._propPointId ?? this.safeGetAttribute('point-id');
        const pointName = this._propPointName ?? this.safeGetAttribute('point-name');
        this.dispatchEvent(
          new CustomEvent('gk-point-hover', {
            detail: {
              pointId,
              pointName,
              lngLat: { lng: coords[0], lat: coords[1] },
              map: this.map,
              pointElement: this,
            },
            bubbles: true,
            cancelable: true,
          })
        );
      }
    };
    const onMouseLeave = (): void => {
      const canvas = this.map?.getCanvas?.();
      if (canvas?.style) canvas.style.cursor = '';
      if (!this.selectedLayers) this.setHoverAt(null);

      this.dispatchEvent(
        new CustomEvent('gk-point-hover-end', {
          detail: { map: this.map, pointElement: this },
          bubbles: true,
          cancelable: true,
        })
      );
    };
    this.map.on('mouseenter', hoverLayerId, onMouseEnter);
    this.map.on('mouseleave', hoverLayerId, onMouseLeave);

    // Click handling
    this.clickHandler = (e: MapEvent) => {
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
        this._propPointId ||
        this.safeGetAttribute('point-id');
      const pointName =
        (feature.properties as Record<string, unknown>)?.['point-name'] ||
        this._propPointName ||
        this.safeGetAttribute('point-name');

      if (pointId || pointName) {
        // Create a proper GeoJSON Feature for type safety
        const geoJsonFeature: GeoJSON.Feature = {
          type: 'Feature',
          geometry: feature.geometry as GeoJSON.Geometry,
          properties: (feature.properties as Record<string, unknown>) || {},
        };
        this.handlePointSelect(
          geoJsonFeature,
          typeof pointId === 'string' ? pointId : null,
          typeof pointName === 'string' ? pointName : null,
          e.lngLat
        );
      }
    };

    this.map.on('click', this.layerId, this.clickHandler);
    this.map.on('touchend', this.layerId, this.clickHandler);

    // Map click for blur (deselection)
    this.mapClickHandler = (e: MapEvent) => {
      if (!this.map || !this.layerId) return;
      if (!this.map.getLayer?.(this.layerId)) return;
      if (typeof this.map.isStyleLoaded === 'function' && !this.map.isStyleLoaded()) return;
      if (!e.point || !this.map.queryRenderedFeatures) return;

      let features: MapRenderedFeature[] = [];
      try {
        features = this.map.queryRenderedFeatures(e.point, { layers: [this.layerId] });
      } catch {
        // MapTiler/MapLibre can throw e.g. "unknown feature value" when parsing vector tiles
        return;
      }
      if (features.length === 0) {
        this.blur();
        if (this.popupInstance) {
          this.popupInstance.remove();
          this.popupInstance = null;
        }

        this.dispatchEvent(
          new CustomEvent('gk-point-blur', {
            detail: { map: this.map },
            bubbles: true,
            cancelable: true,
          })
        );
      }
    };

    this.map.on('click', this.mapClickHandler);
    this.map.on('touchend', this.mapClickHandler);

    // Remove map listeners when map is about to be destroyed (freeze) so no handler runs on destroyed map
    this._mapUnloadHandler = () => this.removeMapListeners();
    this.addEventListener('gk-map-unload', this._mapUnloadHandler);
  }

  /**
   * Remove only map event listeners (used on gk-map-unload before map.remove()).
   * Does not remove layers; map.remove() destroys the map.
   */
  private removeMapListeners(): void {
    if (this._mapUnloadHandler) {
      this.removeEventListener('gk-map-unload', this._mapUnloadHandler);
      this._mapUnloadHandler = null;
    }
    if (!this.map?.off) return;

    if (this.clickHandler && this.layerId) {
      try {
        this.map.off('click', this.layerId, this.clickHandler);
        this.map.off('touchend', this.layerId, this.clickHandler);
      } catch {
        // Map may already be destroyed
      }
      this.clickHandler = null;
    }

    if (this.mapClickHandler) {
      try {
        this.map.off('click', this.mapClickHandler);
        this.map.off('touchend', this.mapClickHandler);
      } catch {
        // Map may already be destroyed
      }
      this.mapClickHandler = null;
    }

    const hoverLayer = this.hoverEventLayerId ?? this.layerId;
    if (hoverLayer) {
      try {
        this.map.off('mouseenter', hoverLayer);
        this.map.off('mouseleave', hoverLayer);
      } catch {
        // Map may already be destroyed
      }
      this.hoverEventLayerId = null;
    }

    this.setHoverAt(null);
  }

  private handlePointSelect(
    feature: GeoJSON.Feature,
    pointId: string | null,
    pointName: string | null,
    lngLat: { lng: number; lat: number }
  ): void {
    // Clear existing selected state
    if (this.popupInstance) {
      this.popupInstance.remove();
      this.popupInstance = null;
    }
    this.blur();

    // Apply selected visual (ring + shadow) - use type guard to safely access coordinates
    if (
      feature.geometry &&
      feature.geometry.type === 'Point' &&
      'coordinates' in feature.geometry
    ) {
      this.applySelectedVisual(feature);
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

    // Show popup if we have a title
    if (title && this.map) {
      try {
        const properties = (feature.properties as Record<string, any>) || {};
        this._lastPopupProperties = { ...properties };
        // Get provider from parent map element
        const provider = this.getUIProvider();

        this.popupInstance = PopupElement.showPointPopup(
          this.popupInstance,
          this.map,
          lngLat,
          title,
          properties,
          provider
        );

        const onPopupClose = (): void => {
          this.blur();
          this.popupInstance = null;
        };

        // Listen for popup close (MapLibre/Mapbox fire 'close' when popup is removed)
        const popup = this.popupInstance as { on?: (event: string, fn: () => void) => void } | null;
        if (popup?.on) {
          popup.on('close', onPopupClose);
        }

        // DOM fallback: close button may remove popup without firing 'close' in some SDK versions
        requestAnimationFrame(() => {
          const el = (this.popupInstance as { getElement?: () => HTMLElement })?.getElement?.();
          const closeBtn = el?.querySelector?.(
            '.maplibregl-popup-close-button, .mapboxgl-popup-close-button'
          ) as HTMLElement | null;
          if (closeBtn) {
            closeBtn.addEventListener('click', onPopupClose, { once: true });
          }
        });

        this.popupCreatedTime = Date.now();
      } catch (error) {
        console.warn('[PointElement] Failed to show popup:', error);
      }
    }

    // Dispatch selected/focus event (gk-point-focus for backward compatibility)
    requestAnimationFrame(() => {
      this.dispatchEvent(
        new CustomEvent('gk-point-focus', {
          detail: { pointId, pointName, title, lngLat, map: this.map, pointElement: this },
          bubbles: true,
          cancelable: true,
        })
      );
    });
  }

  /**
   * Apply selected visual state (white stroke ring + shadow). Hover glow is separate (hover only).
   */
  private applySelectedVisual(feature: GeoJSON.Feature): void {
    if (!this.map || !this.layerId || !this.sourceId) return;
    this.blur();
    const result = applySelectedVisualFn(
      this.map as any,
      this.layerId,
      this.sourceId,
      this.size,
      this.mapElement ?? document.documentElement,
      feature,
      { pointColor: this.color }
    );
    if (result) {
      this.selectedLayers = result;
      this.selectedCreatedTime = Date.now();
      this.safeSetAttribute('selected', 'true');
    }
  }

  /**
   * Clear selected state (remove ring + shadow). Same as blur().
   */
  public blur(): void {
    if (!this.map) return;
    this.setHoverAt(null);
    this.removeAttribute('selected');
    clearSelectedVisual(this.map as any, this.selectedLayers);
    this.selectedLayers = null;
  }

  private removePoint(): void {
    if (!this.map) return;

    if (this.popupInstance) {
      this.popupInstance.remove();
      this.popupInstance = null;
    }

    this.removeMapListeners();

    // Cleanup layers
    if (this.glowLayerId) {
      debug.log('[Point] glow layer REMOVE (teardown)', {
        where: 'point.ts teardown -> cleanupMapLayers',
        when: 'before cleanupMapLayers',
        glowLayerId: this.glowLayerId,
      });
    }
    const hoverPointLayerId = this.hoverLayerId ? `${this.hoverLayerId}-point` : null;
    this.cleanupMapLayers(
      [
        this.layerId,
        this.shadowLayerId,
        this.glowLayerId,
        this.hoverLayerId,
        hoverPointLayerId,
      ].filter(Boolean) as string[],
      [this.sourceId, this.hoverSourceId].filter(Boolean) as string[]
    );
  }

  private updatePointStyle(): void {
    if (!this.map || !this.layerId) return;
    try {
      applyPointPaintProperties(this.map, this.layerId, {
        size: this.size,
        color: this.color,
        opacity: this.opacity,
        strokeWidth: this.strokeWidth,
        strokeColor: this.strokeColor,
        strokeOpacity: this.strokeOpacity,
      });
    } catch {
      this.addPoint();
    }
  }

  override attributeChangedCallback(
    name: string,
    oldValue: string | null,
    newValue: string | null
  ): void {
    if (this.isInitialized && oldValue !== newValue) {
      if (name === 'selected') {
        if (newValue !== null && newValue !== 'false') {
          if (!this.selectedLayers) this.focus();
        } else {
          this.blur();
        }
        return;
      }
      if (
        ['size', 'color', 'opacity', 'stroke-color', 'stroke-width', 'stroke-opacity'].includes(
          name
        )
      ) {
        this.updatePointStyle();
      } else if (name === 'lat' || name === 'lng') {
        this.addPoint(); // Recreate for position changes
      } else if (name?.startsWith('shadow') || name?.startsWith('glow')) {
        this.addPoint(); // Recreate for shadow/glow changes
      } else {
        this.addPoint();
      }
    }
  }

  override disconnectedCallback(): void {
    if (this.clearHandler) {
      document.removeEventListener('gk-clear-all-focus', this.clearHandler);
      document.removeEventListener('gk-clear-all-popups', this.clearPopupHandler!);
      this.clearHandler = null;
      this.clearPopupHandler = null;
    }
    this.removePoint();
    super.disconnectedCallback();
  }

  // Getters - read from properties first, then attributes, then CSS variables
  get color(): string {
    return (
      this._propColor ??
      this.safeGetAttribute('color') ??
      getCSSVariable(this.mapElement, '--gk-point-color', '')
    );
  }

  get size(): number {
    if (this._propSize !== undefined) return this._propSize;
    return parseInt(this.safeGetAttribute('size') || '6') || 6;
  }

  get opacity(): number {
    if (this._propOpacity !== undefined) return this._propOpacity;
    return parseFloat(this.safeGetAttribute('opacity') || '1.0') || 1.0;
  }

  get pointBlur(): number {
    if (this._propBlur !== undefined) return this._propBlur;
    return parseFloat(this.safeGetAttribute('blur') || '0') || 0;
  }

  get strokeColor(): string {
    return (
      this._propStrokeColor ??
      this.safeGetAttribute('stroke-color') ??
      getCSSVariable(this.mapElement, '--gk-point-stroke-color', '')
    );
  }

  get strokeWidth(): number {
    if (this._propStrokeWidth !== undefined) return this._propStrokeWidth;
    const strokeWidth = this.safeGetAttribute('stroke-width');
    if (strokeWidth === null || strokeWidth === undefined) return 0;
    const parsed = parseFloat(strokeWidth);
    return isNaN(parsed) ? 0 : parsed;
  }

  get strokeOpacity(): number {
    if (this._propStrokeOpacity !== undefined) return this._propStrokeOpacity;
    return parseFloat(this.safeGetAttribute('stroke-opacity') || '0.8') || 0.8;
  }

  get shadow(): boolean {
    if (this._propShadow !== undefined) return this._propShadow;
    const shadowAttr = this.safeGetAttribute('shadow');
    return shadowAttr !== null && shadowAttr !== 'false';
  }

  get shadowColor(): string {
    return (
      this._propShadowColor ??
      this.safeGetAttribute('shadow-color') ??
      getCSSVariable(this.mapElement, '--gk-point-shadow-color', '')
    );
  }

  get shadowBlur(): number {
    if (this._propShadowBlur !== undefined) return this._propShadowBlur;
    return parseFloat(this.safeGetAttribute('shadow-blur') || '0.8') || 0.8;
  }

  get shadowOpacity(): number {
    if (this._propShadowOpacity !== undefined) return this._propShadowOpacity;
    return parseFloat(this.safeGetAttribute('shadow-opacity') || '0.4') || 0.4;
  }

  get glow(): boolean {
    if (this._propGlow !== undefined) return this._propGlow;
    const glowAttr = this.safeGetAttribute('glow');
    // Optional: off by default; on when glow, glow="true", or glow=""
    if (glowAttr === null) return false;
    return glowAttr !== 'false';
  }

  /** Glow halo color; defaults to the point color when not set. */
  get glowColor(): string {
    return this._propGlowColor ?? this.safeGetAttribute('glow-color') ?? this.color;
  }

  get glowOpacity(): number {
    if (this._propGlowOpacity !== undefined) return this._propGlowOpacity;
    const attrValue = this.safeGetAttribute('glow-opacity');
    if (attrValue) return parseFloat(attrValue) || 0;
    return getCSSVariableNumber(this.mapElement, '--gk-point-glow-opacity', 0);
  }

  get glowBlur(): number {
    if (this._propGlowBlur !== undefined) return this._propGlowBlur;
    return (
      parseFloat(this.safeGetAttribute('glow-blur') || '') ||
      getCSSVariableNumber(this.mapElement, '--gk-glow-blur', 0)
    );
  }

  // Public API

  /**
   * Select the point (shows ring + shadow). Same as setting selected attribute. focus() name kept for API familiarity.
   */
  public focus(): void {
    if (!this.map || !this.sourceId) return;

    const lat = this._propLat ?? parseFloat(this.safeGetAttribute('lat') || '');
    const lng = this._propLng ?? parseFloat(this.safeGetAttribute('lng') || '');
    if (isNaN(lat) || isNaN(lng)) return;

    const feature: GeoJSON.Feature = {
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [lng, lat],
      },
      properties: {},
    };

    this.applySelectedVisual(feature);
  }

  /** Whether the point is selected (ring visible). */
  get selected(): boolean {
    return this.selectedLayers != null;
  }

  /**
   * Return this point as a GeoJSON Feature for parent gk-point-layer to aggregate.
   * Used when this gk-point is a child of gk-point-layer (shared layers).
   */
  getFeatureData(): GeoJSON.Feature | null {
    const lat = this._propLat ?? parseFloat(this.safeGetAttribute('lat') || '');
    const lng = this._propLng ?? parseFloat(this.safeGetAttribute('lng') || '');
    if (isNaN(lat) || isNaN(lng) || !isValidCoordinate([lat, lng])) return null;
    const normalized = normalizeCoordinatesArray([[lng, lat]], 'lonlat', 'auto');
    const [normLng, normLat] = normalized[0];
    const pointId = this._propPointId ?? this.safeGetAttribute('point-id');
    const pointName = this._propPointName ?? this.safeGetAttribute('point-name');
    const featureId = pointId ?? `point-${this.sourceId ?? crypto.randomUUID()}`;
    return {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [normLng, normLat] },
      properties: {
        color: this.color,
        size: this.size,
        'point-id': featureId,
        ...(pointId && { id: pointId }),
        ...(pointName && { 'point-name': pointName }),
      },
    };
  }

  updatePosition(lat: number, lng: number): void {
    this._propLat = lat;
    this._propLng = lng;
    this.safeSetAttribute('lat', lat.toString());
    this.safeSetAttribute('lng', lng.toString());
  }

  updateStyle(color?: string, size?: number, opacity?: number): void {
    if (color !== undefined) {
      this._propColor = color;
      this.safeSetAttribute('color', color);
    }
    if (size !== undefined) {
      this._propSize = size;
      this.safeSetAttribute('size', size.toString());
    }
    if (opacity !== undefined) {
      this._propOpacity = opacity;
      this.safeSetAttribute('opacity', opacity.toString());
    }
  }

  /**
   * Factory method to create and configure a point element
   * @param options - Point configuration options
   * @returns Configured point element
   */
  static create(options: PointOptions): PointElement {
    const point = document.createElement('gk-point') as PointElement;

    // Store options to set as attributes when element is connected to DOM
    // This avoids JSDOM/Happy-DOM limitations where attributes can't be set before connection
    (point as any)._createOptions = options;

    return point;
  }

  /**
   * Create multiple point elements from GeoJSON FeatureCollection
   * @param geojson - GeoJSON FeatureCollection with Point features
   * @param options - Optional styling and behavior options
   * @returns Array of configured point elements
   */
  static createFromGeoJSON(
    geojson: GeoJSON.FeatureCollection,
    options: {
      color?: string;
      /** Property name to read color from each feature (takes precedence over color option) */
      colorProperty?: string;
      size?: number;
      opacity?: number;
      blur?: number;
      shadow?: boolean;
      shadowColor?: string;
      shadowBlur?: number;
      shadowOpacity?: number;
      glow?: boolean;
      glowColor?: string;
      glowOpacity?: number;
      glowBlur?: number;
      strokeWidth?: number;
      strokeColor?: string;
      idProperty?: string;
      nameProperty?: string;
    } = {}
  ): PointElement[] {
    // Read defaults from CSS variables (falls back to hardcoded if not set)
    const cssPointColor = getCSSVariable(document.documentElement, '--gk-point-color', '');
    const cssPointStroke = getCSSVariable(document.documentElement, '--gk-point-stroke-color', '');
    const cssPointShadow = getCSSVariable(document.documentElement, '--gk-point-shadow-color', '');
    const cssGlowOpacity = getCSSVariableNumber(
      document.documentElement,
      '--gk-point-glow-opacity',
      0
    );

    const {
      color: defaultColor = cssPointColor,
      colorProperty,
      size = 8,
      opacity = 1,
      blur = 0,
      shadow = true,
      shadowColor = cssPointShadow,
      shadowBlur = 1,
      shadowOpacity = cssGlowOpacity,
      glow = false,
      glowColor,
      glowOpacity = cssGlowOpacity,
      glowBlur = getCSSVariableNumber(document.documentElement, '--gk-glow-blur', 0),
      strokeWidth = 0,
      strokeColor = cssPointStroke,
      idProperty = 'id',
      nameProperty = 'name',
    } = options;

    const points: PointElement[] = [];

    geojson.features.forEach((feature) => {
      if (feature.geometry.type !== 'Point') {
        console.warn('Skipping non-Point feature:', feature);
        return;
      }

      const [lng, lat] = feature.geometry.coordinates;

      // Get color from feature property if colorProperty is specified, otherwise use default
      const featureColor =
        colorProperty && feature.properties?.[colorProperty]
          ? String(feature.properties[colorProperty])
          : defaultColor;

      const point = PointElement.create({
        lat,
        lng,
        color: featureColor,
        size,
        opacity,
        blur,
        shadow,
        shadowColor,
        shadowBlur,
        shadowOpacity,
        glow,
        glowColor,
        glowOpacity,
        glowBlur,
        strokeWidth,
        strokeColor,
        pointId: feature.properties?.[idProperty]
          ? String(feature.properties[idProperty])
          : undefined,
        pointName: feature.properties?.[nameProperty]
          ? String(feature.properties[nameProperty])
          : undefined,
      });

      // Store all properties for app use (as property to avoid JSDOM issues)
      if (feature.properties) {
        (point as any)._dataProperties = feature.properties;
      }

      points.push(point);
    });

    return points;
  }
}

// Register the custom element
if (!customElements.get('gk-point')) {
  customElements.define('gk-point', PointElement);
}
