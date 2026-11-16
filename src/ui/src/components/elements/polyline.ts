/**
 * Geokit Polyline Component
 *
 * Displays line/path shapes on the map with customizable styling
 *
 * Usage:
 * <gk-polyline points="[[40.7,-74],[40.8,-74],[40.8,-73.9]]" color="#ff0000" width="3"></gk-polyline>
 */

import { MapChildElement } from '../map-child-element';
import { normalizeCoordinatesArray } from '@local-hosting/geokit/core/coordinates';
import { lineLengthMeters } from '@local-hosting/geokit/core';
import { getBounds } from '@local-hosting/geokit/core/bounds';
import { getCSSVariable } from '../../utils/theme';
import type { Bounds } from '@local-hosting/geokit/core/types';
import type { MapEvent } from '../../providers/types';

export interface PolylineOptions {
  points: number[][];
  color?: string;
  opacity?: number;
  width?: number;
  visible?: boolean;
  interactive?: boolean;
  dashArray?: number[];
}

export class PolylineElement extends MapChildElement {
  static observedAttributes = [
    'points',
    'color',
    'opacity',
    'width',
    'visible',
    'interactive',
    'dash-array',
  ];

  private sourceId: string | null = null;
  private layerId: string | null = null;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  protected override async onMapReady(): Promise<void> {
    await super.onMapReady();
    this.waitForStyleLoaded(() => this.createPolyline());
  }

  /** Re-add polyline layers after map style change only when overlays were dropped. */
  protected override onStyleLoad(): void {
    if (!this.map) return;
    if (
      this.sourceId &&
      this.layerId &&
      this.map.getSource?.(this.sourceId) &&
      this.map.getLayer?.(this.layerId)
    ) {
      return;
    }
    this.waitForStyleLoaded(() => this.createPolyline());
  }

  override async connectedCallback() {
    await super.connectedCallback();

    if (this.isInitialized) return;

    // Generate unique IDs
    this.sourceId = `polyline-source-${crypto.randomUUID()}`;
    this.layerId = `polyline-${crypto.randomUUID()}`;

    this.isInitialized = true;
  }

  private createPolyline(): void {
    if (!this.map || !this.visible || !this.points) return;

    try {
      // Parse points
      const coordinates = this.parsePoints();
      if (!coordinates || coordinates.length < 2) {
        console.warn('[gk-polyline] Need at least 2 points');
        return;
      }

      // Create GeoJSON
      const geojson: GeoJSON.FeatureCollection = {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: {
              type: 'LineString',
              coordinates,
            },
            properties: {
              id: this.id || 'polyline',
              color: this.color,
              width: this.width,
              opacity: this.opacity,
            },
          },
        ],
      };

      // Remove existing polyline
      this.removePolyline();

      // Create line layers
      this.createPolylineManually(geojson);

      // Set up interactivity if enabled
      if (this.interactive) {
        this.setupInteractivity();
      }

      // Dispatch event
      this.dispatchEvent(
        new CustomEvent('polyline-created', {
          detail: {
            coordinates,
            element: this,
            sourceId: this.sourceId,
            layerId: this.layerId,
          },
          bubbles: true,
        })
      );
    } catch (error) {
      console.warn('[gk-polyline] Failed to create polyline:', error);
    }
  }

  private createPolylineManually(geojson: GeoJSON.FeatureCollection): void {
    if (!this.map || !this.sourceId || !this.layerId) return;

    // Add source
    this.map.addSource(this.sourceId, {
      type: 'geojson',
      data: geojson,
      lineMetrics: true, // Enable line metrics for gradients
    });

    // Prepare paint properties
    const paintProperties: Record<string, unknown> = {
      'line-color': this.color,
      'line-opacity': this.opacity,
      'line-width': this.width,
    };

    // Add dash array if specified
    if (this.dashArray) {
      paintProperties['line-dasharray'] = this.parseDashArray();
    }

    // Add line layer
    this.map.addLayer({
      id: this.layerId,
      type: 'line',
      source: this.sourceId,
      paint: paintProperties,
      layout: {
        'line-join': 'round',
        'line-cap': 'round',
      },
    });
  }

  private parsePoints(): number[][] | null {
    if (!this.points) return null;

    try {
      // Parse coordinate input
      let coordinates: number[][] | GeoJSON.Position[];
      if (typeof this.points === 'string') {
        coordinates = JSON.parse(this.points);
      } else if (Array.isArray(this.points)) {
        coordinates = this.points;
      } else {
        return null;
      }

      if (!coordinates || !Array.isArray(coordinates)) return null;

      // Normalize coordinates to GeoJSON [lng, lat] format
      return normalizeCoordinatesArray(coordinates, 'lonlat', 'auto') as number[][];
    } catch (error) {
      console.warn('[gk-polyline] Failed to parse polyline points:', error);
      return null;
    }
  }

  private parseDashArray(): number[] | null {
    if (!this.dashArray) return null;

    try {
      if (typeof this.dashArray === 'string') {
        // Parse comma-separated string or JSON array
        if (this.dashArray.includes('[')) {
          return JSON.parse(this.dashArray);
        } else {
          return this.dashArray.split(',').map((v) => parseFloat(v.trim()));
        }
      } else if (Array.isArray(this.dashArray)) {
        return this.dashArray;
      }
      return null;
    } catch (error) {
      console.warn('[gk-polyline] Failed to parse dash array:', error);
      return null;
    }
  }

  private setupInteractivity(): void {
    if (!this.map || !this.layerId) return;

    // Cursor handling
    this.map.on('mouseenter', this.layerId, () => {
      const canvas = this.map?.getCanvas?.();
      if (canvas) {
        canvas.style.cursor = 'pointer';
      }
    });

    this.map.on('mouseleave', this.layerId, () => {
      const canvas = this.map?.getCanvas?.();
      if (canvas) {
        canvas.style.cursor = '';
      }
    });

    // Click handling
    this.map.on('click', this.layerId, (e: MapEvent) => {
      this.dispatchEvent(
        new CustomEvent('polyline-click', {
          detail: { lngLat: e.lngLat, element: this },
          bubbles: true,
        })
      );
    });
  }

  private removeInteractivity(): void {
    if (!this.map || !this.layerId) return;

    try {
      this.map.off('mouseenter', this.layerId);
      this.map.off('mouseleave', this.layerId);
      this.map.off('click', this.layerId);
    } catch {
      // Ignore
    }
  }

  private removePolyline(): void {
    if (!this.map) return;

    // Remove interactivity
    if (this.interactive) {
      this.removeInteractivity();
    }

    // Cleanup layers
    this.cleanupMapLayers(
      [this.layerId].filter(Boolean) as string[],
      [this.sourceId].filter(Boolean) as string[]
    );
  }

  private updateStyle(): void {
    if (!this.map || !this.layerId) return;
    if (!this.map?.getLayer?.(this.layerId)) return;

    try {
      this.map?.setPaintProperty?.(this.layerId, 'line-color', this.color);
      this.map?.setPaintProperty?.(this.layerId, 'line-opacity', this.opacity);
      this.map?.setPaintProperty?.(this.layerId, 'line-width', this.width);

      const dashArray = this.parseDashArray();
      this.map?.setPaintProperty?.(this.layerId, 'line-dasharray', dashArray);
    } catch {
      // Silently fail if style update fails
    }
  }

  private toggleVisibility(): void {
    if (!this.map || !this.layerId) return;

    try {
      this.map?.setLayoutProperty?.(this.layerId, 'visibility', this.visible ? 'visible' : 'none');
    } catch (error) {
      console.warn('[gk-polyline] Failed to toggle polyline visibility:', error);
    }
  }

  private updateInteractivity(): void {
    this.removeInteractivity();

    if (this.interactive) {
      this.setupInteractivity();
    }
  }

  override attributeChangedCallback(
    name: string,
    oldValue: string | null,
    newValue: string | null
  ): void {
    if (!this.map || oldValue === newValue) return;

    switch (name) {
      case 'points':
        this.waitForStyleLoaded(() => this.createPolyline());
        break;
      case 'color':
      case 'opacity':
      case 'width':
      case 'dash-array':
        this.updateStyle();
        break;
      case 'visible':
        this.toggleVisibility();
        break;
      case 'interactive':
        this.updateInteractivity();
        break;
    }
  }

  override disconnectedCallback(): void {
    this.removePolyline();
    super.disconnectedCallback();
  }

  // Getters and setters
  get points(): string | null {
    return this.getAttribute('points');
  }

  set points(value: string | number[][] | null) {
    if (value === null) {
      this.removeAttribute('points');
    } else {
      this.setAttribute('points', typeof value === 'string' ? value : JSON.stringify(value));
    }
  }

  get color(): string {
    return this.getAttribute('color') || getCSSVariable(this.mapElement, '--gk-polyline-color', '');
  }

  set color(value: string) {
    this.setAttribute('color', value);
  }

  get opacity(): number {
    return parseFloat(this.getAttribute('opacity') || '1.0') || 1.0;
  }

  set opacity(value: number) {
    this.setAttribute('opacity', value.toString());
  }

  get width(): number {
    return parseFloat(this.getAttribute('width') || '2') || 2;
  }

  set width(value: number) {
    this.setAttribute('width', value.toString());
  }

  get visible(): boolean {
    return this.getAttribute('visible') !== 'false';
  }

  set visible(value: boolean) {
    this.setAttribute('visible', value.toString());
  }

  get interactive(): boolean {
    return this.getAttribute('interactive') === 'true';
  }

  set interactive(value: boolean) {
    this.setAttribute('interactive', value.toString());
  }

  get dashArray(): string | null {
    return this.getAttribute('dash-array');
  }

  set dashArray(value: string | number[] | null) {
    if (value === null) {
      this.removeAttribute('dash-array');
    } else {
      this.setAttribute('dash-array', typeof value === 'string' ? value : JSON.stringify(value));
    }
  }

  // Public API
  getCoordinates(): number[][] | null {
    return this.parsePoints();
  }

  setCoordinates(points: number[][]): void {
    this.points = points;
  }

  getBounds(): Bounds | null {
    const coordinates = this.parsePoints();
    if (!coordinates) return null;

    try {
      return getBounds(coordinates);
    } catch {
      return null;
    }
  }

  getLength(): number {
    const coordinates = this.parsePoints();
    if (!coordinates || !Array.isArray(coordinates) || coordinates.length < 2) {
      return 0;
    }

    try {
      return lineLengthMeters(coordinates);
    } catch {
      return 0;
    }
  }

  show(): void {
    this.visible = true;
  }

  hide(): void {
    this.visible = false;
  }
}

// Register the custom element
if (!customElements.get('gk-polyline')) {
  customElements.define('gk-polyline', PolylineElement);
}
