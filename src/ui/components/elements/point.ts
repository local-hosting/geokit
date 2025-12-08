/**
 * Geokit Point Component
 *
 * Creates simple geometric points/dots on the map for marking coordinates
 *
 * Usage:
 * <gk-point lat="40.7128" lng="-74.0060" color="#ff0000" size="8"></gk-point>
 */

import { BaseElement } from '../base-element';
import { normalizeCoordinatesArray, isValidCoordinate } from '../../../utils/coordinates';
import type { Coordinate } from '../../../types';

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
  pointId?: string;
  pointName?: string;
}

export class PointElement extends BaseElement {
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
    'point-id',
    'point-name',
  ];

  private sourceId: string | null = null;
  private layerId: string | null = null;
  private shadowLayerId: string | null = null;
  private popupInstance: any = null;
  private selectionLayers: { selectionLayerId: string; shadowLayerId: string; selectionSourceId: string } | null = null;
  private clickHandler: ((e: any) => void) | null = null;
  private mapClickHandler: ((e: any) => void) | null = null;
  private clearHandler: ((event: Event) => void) | null = null;
  private clearPopupHandler: ((event: Event) => void) | null = null;
  private highlightCreatedTime: number | null = null;
  private popupCreatedTime: number | null = null;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  override async connectedCallback() {
    await super.connectedCallback();
    
    if (this.isInitialized) return;

    // Generate unique IDs
    const uuid = crypto.randomUUID();
    this.sourceId = `point-source-${uuid}`;
    this.layerId = `point-layer-${uuid}`;
    this.shadowLayerId = `point-shadow-${uuid}`;

    // Setup event listeners
    this.setupEventListeners();
    
    this.isInitialized = true;
  }

  protected override async onMapReady(): Promise<void> {
    await super.onMapReady();
    this.waitForStyleLoaded(() => this.addPoint());
  }

  private setupEventListeners(): void {
    // Clear popup handler
    this.clearPopupHandler = ((event: Event) => {
      const customEvent = event as CustomEvent;
      const { pointElement, pointId: excludePointId } = customEvent.detail || {};
      
      if (pointElement === this) return;
      
      const thisPointId = this.getAttribute('point-id');
      if (excludePointId && thisPointId && String(thisPointId) === String(excludePointId)) {
        return;
      }
      
      if (this.popupInstance) {
        this.popupInstance.remove();
        this.popupInstance = null;
      }
    });

    // Clear all selections handler
    this.clearHandler = ((event: Event) => {
      const customEvent = event as CustomEvent;
      const { pointElement, pointId: excludePointId } = customEvent.detail || {};
      
      if (pointElement === this) return;
      
      const thisPointId = this.getAttribute('point-id');
      if (excludePointId && thisPointId && String(thisPointId) === String(excludePointId)) {
        return;
      }
      
      const now = Date.now();
      if (this.highlightCreatedTime && (now - this.highlightCreatedTime) < 200) {
        return;
      }
      
      if (this.popupInstance) {
        if (!this.popupCreatedTime || (now - this.popupCreatedTime) > 100) {
          this.clearHighlight();
          this.popupInstance.remove();
          this.popupInstance = null;
        }
      } else {
        this.clearHighlight();
      }
    });

    document.addEventListener('gk-clear-all-selections', this.clearHandler);
    document.addEventListener('gk-clear-all-popups', this.clearPopupHandler);
  }

  private addPoint(): void {
    if (!this.map) return;

    const lat = parseFloat(this.getAttribute('lat') || '');
    const lng = parseFloat(this.getAttribute('lng') || '');

    // Skip if attributes haven't been set yet
    if (isNaN(lat) || isNaN(lng)) {
      return;
    }

    if (!isValidCoordinate([lat, lng])) {
      console.warn('Point: Invalid lat/lng coordinates', { lat, lng });
      return;
    }

    // Normalize coordinates
    const normalized = normalizeCoordinatesArray([[lng, lat]], 'lonlat', 'auto');
    const [normLng, normLat] = normalized[0];

    // Remove existing point
    this.removePoint();

    // Get point metadata
    const pointId = this.getAttribute('point-id');
    const pointName = this.getAttribute('point-name');

    // Create GeoJSON point data
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
            ...(pointId && { id: pointId, 'point-id': pointId }),
            ...(pointName && { 'point-name': pointName }),
          },
        },
      ],
    };

    this.createPointLayers(pointData);

    // Setup interactions if metadata available
    if (pointId || pointName) {
      this.setupInteractions();
    }

    // Dispatch event
    this.dispatchEvent(
      new CustomEvent('point-created', {
        detail: { lat: normLat, lng: normLng, element: this },
        bubbles: true,
      })
    );
  }

  private createPointLayers(pointData: GeoJSON.FeatureCollection): void {
    if (!this.map || !this.sourceId || !this.layerId) return;

    this.map.addSource(this.sourceId, {
      type: 'geojson',
      data: pointData,
    });

    // Add shadow layer if enabled
    if (this.shadow && this.shadowLayerId) {
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
    }

    // Add main point layer
    const paint: any = {
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

    this.map.addLayer({
      id: this.layerId,
      type: 'circle',
      source: this.sourceId,
      paint,
    });
  }

  private setupInteractions(): void {
    if (!this.map || !this.layerId) return;

    // Cursor handling
    this.map.on('mouseenter', this.layerId, () => {
      if (this.map) (this.map as any).getCanvas().style.cursor = 'pointer';
    });
    
    this.map.on('mouseleave', this.layerId, () => {
      if (this.map) (this.map as any).getCanvas().style.cursor = '';
    });

    // Click handling
    this.clickHandler = (e: any) => {
      if (e.originalEvent) {
        e.originalEvent.stopPropagation();
        e.originalEvent.stopImmediatePropagation();
      }

      const feature = e.features?.[0];
      if (!feature) return;

      const pointId = feature.properties?.['point-id'] || feature.properties?.id || this.getAttribute('point-id');
      const pointName = feature.properties?.['point-name'] || this.getAttribute('point-name');

      if (pointId || pointName) {
        this.handlePointSelection(feature, pointId, pointName, e.lngLat);
      }
    };

    this.map.on('click', this.layerId, this.clickHandler);
    this.map.on('touchend', this.layerId, this.clickHandler);

    // Map click for deselection
    this.mapClickHandler = (e: any) => {
      if (!this.map || !this.layerId) return;
      if (!this.map.getLayer(this.layerId)) return;

      const features = this.map.queryRenderedFeatures(e.point, { layers: [this.layerId] });
      if (features.length === 0) {
        this.clearHighlight();
        if (this.popupInstance) {
          this.popupInstance.remove();
          this.popupInstance = null;
        }

        this.dispatchEvent(
          new CustomEvent('gk-point-deselected', {
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

  private handlePointSelection(feature: any, pointId: string | null, pointName: string | null, lngLat: any): void {
    // Clear local selection
    if (this.popupInstance) {
      this.popupInstance.remove();
      this.popupInstance = null;
    }
    this.clearHighlight();

    // Highlight point
    if (feature.geometry?.coordinates) {
      this.highlightPoint(feature);
    }

    // Parse title from pointName
    let title = '';
    if (pointName) {
      const dashIndex = pointName.indexOf('-');
      if (dashIndex > 0) {
        title = pointName.substring(0, dashIndex).trim();
        title = title.replace(/,(\S)/g, ', $1');
      }
    }
    if (!title && pointId) {
      title = pointId;
    }

    // Dispatch selection event
    requestAnimationFrame(() => {
      this.dispatchEvent(
        new CustomEvent('gk-point-selected', {
          detail: { pointId, pointName, title, lngLat, map: this.map, pointElement: this },
          bubbles: true,
          cancelable: true,
        })
      );
    });
  }

  private highlightPoint(feature: GeoJSON.Feature): void {
    if (!this.map || !this.layerId || !this.sourceId) return;

    this.clearHighlight();

    const selectionLayerId = `${this.layerId}-selection`;
    const shadowLayerId = `${this.layerId}-selection-shadow`;
    const selectionSourceId = `${this.sourceId}-selection`;

    const selectionData: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: [JSON.parse(JSON.stringify(feature))],
    };

    try {
      if (this.map.getSource(selectionSourceId)) {
        this.map.removeSource(selectionSourceId);
      }

      this.map.addSource(selectionSourceId, {
        type: 'geojson',
        data: selectionData,
      });

      if (this.map.getLayer(shadowLayerId)) {
        this.map.removeLayer(shadowLayerId);
      }
      if (this.map.getLayer(selectionLayerId)) {
        this.map.removeLayer(selectionLayerId);
      }

      // Add shadow
      (this.map as any).addLayer(
        {
          id: shadowLayerId,
          type: 'circle',
          source: selectionSourceId,
          paint: {
            'circle-radius': this.getShadowRadiusExpression(),
            'circle-color': 'rgba(0, 0, 0, 0.4)',
            'circle-opacity': 0.6,
            'circle-blur': 3,
            'circle-stroke-width': 0,
          },
        },
        this.layerId
      );

      // Add white stroke
      (this.map as any).addLayer(
        {
          id: selectionLayerId,
          type: 'circle',
          source: selectionSourceId,
          paint: {
            'circle-radius': this.getZoomRadiusExpression(),
            'circle-color': 'transparent',
            'circle-opacity': 1,
            'circle-stroke-width': 2,
            'circle-stroke-color': '#ffffff',
            'circle-stroke-opacity': 1,
          },
        },
        this.layerId
      );

      this.selectionLayers = { selectionLayerId, shadowLayerId, selectionSourceId };
      this.highlightCreatedTime = Date.now();
    } catch (error) {
      console.error('Error highlighting point:', error);
      this.clearHighlight();
    }
  }

  private clearHighlight(): void {
    if (!this.map || !this.selectionLayers) return;

    const { selectionLayerId, shadowLayerId, selectionSourceId } = this.selectionLayers;

    if (this.map.getLayer(selectionLayerId)) this.map.removeLayer(selectionLayerId);
    if (this.map.getLayer(shadowLayerId)) this.map.removeLayer(shadowLayerId);
    if (this.map.getSource(selectionSourceId)) this.map.removeSource(selectionSourceId);

    this.selectionLayers = null;
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
      } catch (e) {
        // Ignore
      }
      this.clickHandler = null;
    }

    if (this.mapClickHandler) {
      try {
        this.map.off('click', this.mapClickHandler);
        this.map.off('touchend', this.mapClickHandler);
      } catch (e) {
        // Ignore
      }
      this.mapClickHandler = null;
    }

    if (this.layerId) {
      try {
        this.map.off('mouseenter', this.layerId);
        this.map.off('mouseleave', this.layerId);
      } catch (e) {
        // Ignore
      }
    }

    // Cleanup layers
    this.cleanupMapLayers([this.layerId, this.shadowLayerId].filter(Boolean) as string[], [this.sourceId].filter(Boolean) as string[]);
  }

  private getZoomRadiusExpression(): any[] {
    const scale = this.size / 6;
    return [
      'interpolate',
      ['exponential', 1.8],
      ['zoom'],
      3, Math.max(1, 2 * scale),
      5, Math.max(1, 3 * scale),
      7, Math.max(1, 5 * scale),
      9, Math.max(2, 8 * scale),
      11, Math.max(3, 12 * scale),
      13, Math.max(4, 18 * scale),
      15, Math.max(6, 26 * scale),
      17, Math.max(8, 36 * scale),
      19, Math.max(10, 48 * scale),
    ];
  }

  private getShadowRadiusExpression(): any[] {
    const scale = this.size / 6;
    return [
      'interpolate',
      ['exponential', 1.8],
      ['zoom'],
      3, Math.max(1, 3 * scale),
      5, Math.max(1, 4 * scale),
      7, Math.max(2, 7 * scale),
      9, Math.max(3, 11 * scale),
      11, Math.max(4, 16 * scale),
      13, Math.max(6, 24 * scale),
      15, Math.max(8, 34 * scale),
      17, Math.max(10, 46 * scale),
      19, Math.max(12, 60 * scale),
    ];
  }

  private updatePointStyle(): void {
    if (!this.map || !this.layerId) return;

    try {
      this.map.setPaintProperty(this.layerId, 'circle-radius', this.getZoomRadiusExpression());
      this.map.setPaintProperty(this.layerId, 'circle-color', this.color);
      this.map.setPaintProperty(this.layerId, 'circle-opacity', this.opacity);

      if (this.strokeWidth > 0) {
        this.map.setPaintProperty(this.layerId, 'circle-stroke-width', this.strokeWidth);
        this.map.setPaintProperty(this.layerId, 'circle-stroke-color', this.strokeColor);
        this.map.setPaintProperty(this.layerId, 'circle-stroke-opacity', this.strokeOpacity);
      } else {
        this.map.setPaintProperty(this.layerId, 'circle-stroke-width', 0);
      }
    } catch (error) {
      console.warn('Failed to update point style, recreating:', error);
      this.addPoint();
    }
  }

  override attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void {
    if (this.isInitialized && oldValue !== newValue) {
      if (['size', 'color', 'opacity', 'stroke-color', 'stroke-width', 'stroke-opacity'].includes(name)) {
        this.updatePointStyle();
      } else if (name === 'lat' || name === 'lng') {
        this.addPoint(); // Recreate for position changes
      } else if (name?.startsWith('shadow')) {
        this.addPoint(); // Recreate for shadow changes
      } else {
        this.addPoint();
      }
    }
  }

  override disconnectedCallback(): void {
    if (this.clearHandler) {
      document.removeEventListener('gk-clear-all-selections', this.clearHandler);
      document.removeEventListener('gk-clear-all-popups', this.clearPopupHandler!);
      this.clearHandler = null;
      this.clearPopupHandler = null;
    }
    this.removePoint();
    super.disconnectedCallback();
  }

  // Getters
  get color(): string {
    return this.getAttribute('color') || '#ff0000';
  }

  get size(): number {
    return parseInt(this.getAttribute('size') || '6') || 6;
  }

  get opacity(): number {
    return parseFloat(this.getAttribute('opacity') || '1.0') || 1.0;
  }

  get pointBlur(): number {
    return parseFloat(this.getAttribute('blur') || '0') || 0;
  }

  get strokeColor(): string {
    return this.getAttribute('stroke-color') || '#ffffff';
  }

  get strokeWidth(): number {
    const strokeWidth = this.getAttribute('stroke-width');
    if (strokeWidth === null || strokeWidth === undefined) return 1;
    const parsed = parseFloat(strokeWidth);
    return isNaN(parsed) ? 1 : parsed;
  }

  get strokeOpacity(): number {
    return parseFloat(this.getAttribute('stroke-opacity') || '0.8') || 0.8;
  }

  get shadow(): boolean {
    return this.hasAttribute('shadow') && this.getAttribute('shadow') !== 'false';
  }

  get shadowColor(): string {
    return this.getAttribute('shadow-color') || '#000000';
  }

  get shadowBlur(): number {
    return parseFloat(this.getAttribute('shadow-blur') || '0.8') || 0.8;
  }

  get shadowOpacity(): number {
    return parseFloat(this.getAttribute('shadow-opacity') || '0.4') || 0.4;
  }

  // Public API
  updatePosition(lat: number, lng: number): void {
    this.setAttribute('lat', lat.toString());
    this.setAttribute('lng', lng.toString());
  }

  updateStyle(color?: string, size?: number, opacity?: number): void {
    if (color !== undefined) this.setAttribute('color', color);
    if (size !== undefined) this.setAttribute('size', size.toString());
    if (opacity !== undefined) this.setAttribute('opacity', opacity.toString());
  }
}

// Register the custom element
if (!customElements.get('gk-point')) {
  customElements.define('mapi-point', PointElement);
}

