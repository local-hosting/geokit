/**
 * Geokit Point Component
 *
 * Creates simple geometric points/dots on the map for marking coordinates
 *
 * Usage:
 * <gk-point lat="40.7128" lng="-74.0060" color="#ff0000" size="8"></gk-point>
 */

import { MapChildElement } from '../map-child-element';
import { normalizeCoordinatesArray, isValidCoordinate } from '../../../utils/coordinates';
import type { MapEvent, MapRenderedFeature } from '../../providers/types';
import { getCSSVariable, getCSSVariableNumber } from '../../utils/theme';
import { debug } from '../../utils/logger';
import { PopupElement } from './popup';

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
  glow?: boolean;
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
  ];

  private sourceId: string | null = null;
  private layerId: string | null = null;
  private shadowLayerId: string | null = null;
  private glowLayerId: string | null = null;
  private highlightSourceId: string | null = null;
  private highlightLayerId: string | null = null;
  private popupInstance: { remove: () => void } | null = null;
  /** Last feature.properties shown in popup (for re-open after style change so tags/address persist). */
  private _lastPopupProperties: Record<string, unknown> | null = null;
  private focusLayers: {
    focusLayerId: string;
    shadowLayerId: string;
    focusSourceId: string;
  } | null = null;
  private clickHandler: ((e: MapEvent) => void) | null = null;
  private mapClickHandler: ((e: MapEvent) => void) | null = null;
  private clearHandler: ((event: Event) => void) | null = null;
  private clearPopupHandler: ((event: Event) => void) | null = null;
  private focusCreatedTime: number | null = null;
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
        this.highlightSourceId = `point-highlight-${uuid}`;
        this.highlightLayerId = `point-highlight-layer-${uuid}`;
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
    const hadFocus = !!this.focusLayers;
    // Wait for new style to be ready so addSource/addLayer succeed (e.g. when switching to light, style may not be ready yet).
    this.waitForStyleLoaded(() => {
      if (!this.map) return;
      this.addPoint();
      if (hadFocus) {
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
          this.handlePointFocus(
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

    // Clear all focus handler
    this.clearHandler = (event: Event) => {
      const customEvent = event as CustomEvent;
      const { pointElement, pointId: excludePointId } = customEvent.detail || {};

      if (pointElement === this) return;

      const thisPointId = this._propPointId ?? this.safeGetAttribute('point-id');
      if (excludePointId && thisPointId && String(thisPointId) === String(excludePointId)) {
        return;
      }

      const now = Date.now();
      if (this.focusCreatedTime && now - this.focusCreatedTime < 200) {
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

    document.addEventListener('gk-clear-all-focus', this.clearHandler);
    document.addEventListener('gk-clear-all-popups', this.clearPopupHandler);
  }

  private addPoint(): void {
    if (!this.map) return;

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

    try {
      this.map.addSource(this.sourceId, {
        type: 'geojson',
        data: pointData,
        promoteId: 'point-id',
      });
    } catch (error) {
      console.error('[Point] Failed to add source:', error);
      return;
    }

    // Highlight source: single point driven by setData (hover/focus), no feature-state
    const emptyHighlight: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };
    try {
      this.map.addSource(this.highlightSourceId!, {
        type: 'geojson',
        data: emptyHighlight,
      });
    } catch (error) {
      console.error('[Point] Failed to add highlight source:', error);
    }

    // Add glow layer if enabled (bottom layer - constant opacity, no feature-state)
    if (this.glow && this.glowLayerId) {
      debug.log('[Point] glow layer ADD (createPointLayers)', {
        where: 'point.ts createPointLayers',
        when: 'after source, before point layer',
        glowLayerId: this.glowLayerId,
        sourceId: this.sourceId,
      });
      try {
        this.map.addLayer({
          id: this.glowLayerId,
          type: 'circle',
          source: this.sourceId,
          paint: {
            'circle-radius': this.getGlowRadiusExpression(),
            'circle-color': this.glowColor,
            'circle-opacity': this.glowOpacity,
            'circle-blur': this.glowBlur,
          },
        });
        debug.log('[Point] glow layer ADD done', { glowLayerId: this.glowLayerId });
      } catch (error) {
        console.error('[Point] Failed to add glow layer:', error);
      }
    } else {
      debug.log('[Point] glow layer SKIP (not added)', {
        where: 'point.ts createPointLayers',
        reason: !this.glow ? 'glow disabled' : 'no glowLayerId',
        glow: this.glow,
        glowLayerId: this.glowLayerId ?? null,
      });
    }

    // Add shadow layer if enabled
    if (this.shadow && this.shadowLayerId) {
      try {
        this.map.addLayer({
          id: this.shadowLayerId,
          type: 'circle',
          source: this.sourceId,
          paint: {
            'circle-radius': this.getShadowRadiusExpression(),
            'circle-color': this.shadowColor,
            'circle-opacity': this.shadowOpacity,
            'circle-blur': this.shadowBlur,
          },
        });
      } catch (error) {
        console.error('[Point] Failed to add shadow layer:', error);
      }
    }

    // Highlight layer: shape above glow, below dot; shown via setData on hover/focus (no feature-state)
    const highlightOpacity = getCSSVariableNumber(
      this.mapElement,
      '--gk-point-glow-hover-opacity',
      0.5
    );
    const highlightColor =
      getCSSVariable(this.mapElement, '--gk-point-glow-color', this.glowColor) || this.glowColor;
    if (this.highlightLayerId && this.highlightSourceId) {
      try {
        this.map.addLayer(
          {
            id: this.highlightLayerId,
            type: 'circle',
            source: this.highlightSourceId,
            paint: {
              'circle-radius': this.getZoomRadiusExpression(),
              'circle-color': highlightColor,
              'circle-opacity': highlightOpacity,
              'circle-blur': 0,
            },
          },
          this.layerId
        );
      } catch (error) {
        console.error('[Point] Failed to add highlight layer:', error);
      }
    }

    // Add main point layer (constant opacity, no feature-state)
    const paint: Record<string, unknown> = {
      'circle-radius': this.getZoomRadiusExpression(),
      'circle-color': this.color,
      'circle-opacity': this.opacity,
      'circle-blur': this.pointBlur,
    };

    if (this.strokeWidth > 0) {
      paint['circle-stroke-width'] = this.strokeWidth;
      paint['circle-stroke-color'] = this.strokeColor;
      paint['circle-stroke-opacity'] = this.strokeOpacity;
    } else {
      paint['circle-stroke-width'] = 0;
    }

    try {
      this.map.addLayer({
        id: this.layerId,
        type: 'circle',
        source: this.sourceId,
        paint,
      });
      debug.log('[Point] createPointLayers done', { layerId: this.layerId });
    } catch (error) {
      console.error('[Point] Failed to add main layer:', error);
    }
  }

  private hoverLayerId: string | null = null;

  private setHighlightAt(coordinates: [number, number] | null): void {
    if (!this.map || !this.highlightSourceId) return;
    const source = this.map.getSource?.(this.highlightSourceId) as
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
    this.hoverLayerId = this.glow && this.glowLayerId ? this.glowLayerId : this.layerId;
    const hoverLayerId = this.hoverLayerId;

    // Hover: drive highlight layer via setData (no feature-state)
    const onMouseEnter = (e: MapEvent): void => {
      const canvas = this.map?.getCanvas?.();
      if (canvas?.style) canvas.style.cursor = 'pointer';
      const features = e?.features;
      if (
        features?.length &&
        features[0].geometry?.type === 'Point' &&
        'coordinates' in features[0].geometry
      ) {
        this.setHighlightAt(features[0].geometry.coordinates as [number, number]);
      }
    };
    const onMouseLeave = (): void => {
      const canvas = this.map?.getCanvas?.();
      if (canvas?.style) canvas.style.cursor = '';
      if (!this.focusLayers) this.setHighlightAt(null);
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
        this.handlePointFocus(
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
  }

  private handlePointFocus(
    feature: GeoJSON.Feature,
    pointId: string | null,
    pointName: string | null,
    lngLat: { lng: number; lat: number }
  ): void {
    // Clear existing focus state
    if (this.popupInstance) {
      this.popupInstance.remove();
      this.popupInstance = null;
    }
    this.blur();

    // Apply focus visual - use type guard to safely access coordinates
    if (
      feature.geometry &&
      feature.geometry.type === 'Point' &&
      'coordinates' in feature.geometry
    ) {
      this.applyFocusVisual(feature);
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

        // Listen for popup close to blur the point
        const popup = this.popupInstance as { on?: (event: string, fn: () => void) => void } | null;
        if (popup?.on) {
          popup.on('close', () => {
            this.blur();
            this.popupInstance = null;
          });
        }

        this.popupCreatedTime = Date.now();
      } catch (error) {
        console.warn('[PointElement] Failed to show popup:', error);
      }
    }

    // Dispatch focus event
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
   * Apply focus visual state to the point (white stroke ring + shadow + glow highlight)
   */
  private applyFocusVisual(feature: GeoJSON.Feature): void {
    if (!this.map || !this.layerId || !this.sourceId) return;

    this.blur();

    const focusLayerId = `${this.layerId}-focus`;
    const shadowLayerId = `${this.layerId}-focus-shadow`;
    const focusSourceId = `${this.sourceId}-focus`;

    const focusData: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: [JSON.parse(JSON.stringify(feature))],
    };

    try {
      if (this.map.getSource?.(focusSourceId)) {
        this.map.removeSource(focusSourceId);
      }

      this.map.addSource(focusSourceId, {
        type: 'geojson',
        data: focusData,
      });

      if (this.map?.getLayer?.(shadowLayerId)) {
        this.map.removeLayer(shadowLayerId);
      }
      if (this.map?.getLayer?.(focusLayerId)) {
        this.map.removeLayer(focusLayerId);
      }

      // Read focus colors from CSS variables
      const focusShadowColor = getCSSVariable(this.mapElement, '--gk-focus-shadow-color', '');
      const focusRingColor = getCSSVariable(this.mapElement, '--gk-focus-ring-color', '');

      // Add shadow
      this.map.addLayer(
        {
          id: shadowLayerId,
          type: 'circle',
          source: focusSourceId,
          paint: {
            'circle-radius': this.getShadowRadiusExpression(),
            'circle-color': focusShadowColor,
            'circle-opacity': getCSSVariableNumber(
              this.mapElement,
              '--gk-point-glow-focus-opacity',
              0
            ),
            'circle-blur': 3,
            'circle-stroke-width': 0,
          },
        },
        this.layerId
      );

      // Add focus ring
      this.map.addLayer(
        {
          id: focusLayerId,
          type: 'circle',
          source: focusSourceId,
          paint: {
            'circle-radius': this.getZoomRadiusExpression(),
            'circle-color': 'transparent',
            'circle-opacity': 1,
            'circle-stroke-width': 2,
            'circle-stroke-color': focusRingColor,
            'circle-stroke-opacity': 1,
          },
        },
        this.layerId
      );

      this.focusLayers = { focusLayerId, shadowLayerId, focusSourceId };
      this.focusCreatedTime = Date.now();

      // Show highlight layer at focus position (no feature-state)
      if (feature.geometry?.type === 'Point' && 'coordinates' in feature.geometry) {
        this.setHighlightAt(feature.geometry.coordinates as [number, number]);
      }
    } catch (error) {
      console.error('[Point] Error applying focus:', error);
      this.blur();
    }
  }

  /**
   * Remove focus visual state (blur the point)
   */
  public blur(): void {
    if (!this.map) return;

    this.setHighlightAt(null);

    // Remove focus layers
    if (!this.focusLayers) return;

    const { focusLayerId, shadowLayerId, focusSourceId } = this.focusLayers;

    if (this.map?.getLayer?.(focusLayerId)) this.map.removeLayer(focusLayerId);
    if (this.map?.getLayer?.(shadowLayerId)) this.map.removeLayer(shadowLayerId);
    if (this.map?.getSource?.(focusSourceId)) this.map.removeSource(focusSourceId);

    this.focusLayers = null;
  }

  private removePoint(): void {
    if (!this.map) return;

    if (this.popupInstance) {
      this.popupInstance.remove();
      this.popupInstance = null;
    }

    // Remove event listeners
    if (this.clickHandler && this.layerId) {
      try {
        this.map.off('click', this.layerId, this.clickHandler);
        this.map.off('touchend', this.layerId, this.clickHandler);
      } catch {
        // Ignore
      }
      this.clickHandler = null;
    }

    if (this.mapClickHandler) {
      try {
        this.map.off('click', this.mapClickHandler);
        this.map.off('touchend', this.mapClickHandler);
      } catch {
        // Ignore
      }
      this.mapClickHandler = null;
    }

    // Remove hover listeners (attached to glow or point layer)
    const hoverLayer = this.hoverLayerId ?? this.layerId;
    if (hoverLayer) {
      try {
        this.map.off('mouseenter', hoverLayer);
        this.map.off('mouseleave', hoverLayer);
      } catch {
        // Ignore
      }
      this.hoverLayerId = null;
    }

    this.setHighlightAt(null);

    // Cleanup layers
    if (this.glowLayerId) {
      debug.log('[Point] glow layer REMOVE (teardown)', {
        where: 'point.ts teardown -> cleanupMapLayers',
        when: 'before cleanupMapLayers',
        glowLayerId: this.glowLayerId,
      });
    }
    this.cleanupMapLayers(
      [this.layerId, this.shadowLayerId, this.glowLayerId, this.highlightLayerId].filter(
        Boolean
      ) as string[],
      [this.sourceId, this.highlightSourceId].filter(Boolean) as string[]
    );
  }

  private getZoomRadiusExpression(): unknown[] {
    const scale = this.size / 6;
    return [
      'interpolate',
      ['exponential', 1.8],
      ['zoom'],
      3,
      Math.max(1, 2 * scale),
      5,
      Math.max(1, 3 * scale),
      7,
      Math.max(1, 5 * scale),
      9,
      Math.max(2, 8 * scale),
      11,
      Math.max(3, 12 * scale),
      13,
      Math.max(4, 18 * scale),
      15,
      Math.max(6, 26 * scale),
      17,
      Math.max(8, 36 * scale),
      19,
      Math.max(10, 48 * scale),
    ];
  }

  private getShadowRadiusExpression(): unknown[] {
    const scale = this.size / 6;
    return [
      'interpolate',
      ['exponential', 1.8],
      ['zoom'],
      3,
      Math.max(1, 3 * scale),
      5,
      Math.max(1, 4 * scale),
      7,
      Math.max(2, 7 * scale),
      9,
      Math.max(3, 11 * scale),
      11,
      Math.max(4, 16 * scale),
      13,
      Math.max(6, 24 * scale),
      15,
      Math.max(8, 34 * scale),
      17,
      Math.max(10, 46 * scale),
      19,
      Math.max(12, 60 * scale),
    ];
  }

  /**
   * Get glow radius expression - larger than point for visual effect + hit area
   * Uses exponential interpolation for smooth zoom transitions
   */
  private getGlowRadiusExpression(): unknown[] {
    const scale = this.size / 6;
    return [
      'interpolate',
      ['exponential', 1.5],
      ['zoom'],
      3,
      Math.max(2, 3.5 * scale),
      6,
      Math.max(3, 5 * scale),
      8,
      Math.max(5, 8 * scale),
      10,
      Math.max(7, 11 * scale),
      14,
      Math.max(10, 14 * scale),
      18,
      Math.max(14, 18 * scale),
    ];
  }

  private updatePointStyle(): void {
    if (!this.map || !this.layerId) return;

    try {
      this.map?.setPaintProperty?.(this.layerId, 'circle-radius', this.getZoomRadiusExpression());
      this.map?.setPaintProperty?.(this.layerId, 'circle-color', this.color);
      this.map?.setPaintProperty?.(this.layerId, 'circle-opacity', this.opacity);

      if (this.strokeWidth > 0) {
        this.map?.setPaintProperty?.(this.layerId, 'circle-stroke-width', this.strokeWidth);
        this.map?.setPaintProperty?.(this.layerId, 'circle-stroke-color', this.strokeColor);
        this.map?.setPaintProperty?.(this.layerId, 'circle-stroke-opacity', this.strokeOpacity);
      } else {
        this.map?.setPaintProperty?.(this.layerId, 'circle-stroke-width', 0);
      }
    } catch {
      // Silently recreate point if style update fails
      this.addPoint();
    }
  }

  override attributeChangedCallback(
    name: string,
    oldValue: string | null,
    newValue: string | null
  ): void {
    if (this.isInitialized && oldValue !== newValue) {
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
    // Default true (glow on); only off when explicitly glow="false"
    return glowAttr !== 'false';
  }

  get glowColor(): string {
    // Default to point color if not specified
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
   * Programmatically focus the point (shows white stroke ring + shadow)
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

    this.applyFocusVisual(feature);
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
