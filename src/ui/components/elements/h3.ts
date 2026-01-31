/**
 * Geokit H3 Component
 *
 * Displays H3 hexagon cells on the map
 *
 * Usage:
 * <gk-h3 lat="40.7128" lng="-74.0060" resolution="8"></gk-h3>
 * <gk-h3 h3-index="8828308281fffff"></gk-h3>
 */

import { MapChildElement } from '../map-child-element';
import { coordinatesToH3, h3ToBoundary } from '../../../utils/h3';

export interface H3Options {
  lat?: number;
  lng?: number;
  h3Index?: string;
  resolution?: number;
  color?: string;
  opacity?: number;
  strokeColor?: string;
  strokeWidth?: number;
}

export class H3Element extends MapChildElement {
  static observedAttributes = [
    'lat',
    'lng',
    'h3-index',
    'resolution',
    'color',
    'opacity',
    'stroke-color',
    'stroke-width',
    'visible',
  ];

  private sourceId: string | null = null;
  private lineLayerId: string | null = null;
  private fillLayerId: string | null = null;
  private currentH3Index: string | null = null;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  protected override async onMapReady(): Promise<void> {
    await super.onMapReady();
    this.waitForStyleLoaded(() => this.renderH3());
  }

  override async connectedCallback() {
    await super.connectedCallback();

    if (this.isInitialized) return;

    // Generate unique IDs
    this.sourceId = `h3-cell-${crypto.randomUUID()}`;
    this.lineLayerId = `h3-cell-line-${crypto.randomUUID()}`;
    this.fillLayerId = `h3-cell-fill-${crypto.randomUUID()}`;

    this.isInitialized = true;
  }

  private renderH3(): void {
    if (!this.map || !this.visible) return;

    // Determine H3 index
    let h3Index: string | null = null;

    const explicitH3 = this.getAttribute('h3-index');
    if (explicitH3) {
      h3Index = explicitH3;
    } else {
      const lat = parseFloat(this.getAttribute('lat') || '');
      const lng = parseFloat(this.getAttribute('lng') || '');
      const resolution = this.resolution;

      if (!isNaN(lat) && !isNaN(lng)) {
        try {
          h3Index = coordinatesToH3(resolution)([lng, lat]);
        } catch (error) {
          console.warn('Failed to create H3 index from coordinates:', error);
          return;
        }
      }
    }

    if (!h3Index) {
      console.warn('H3: No valid coordinates or H3 index provided');
      return;
    }

    // Skip if same H3 index
    if (h3Index === this.currentH3Index) return;

    this.currentH3Index = h3Index;

    // Convert H3 to polygon boundary
    let boundary: number[][];
    try {
      boundary = h3ToBoundary(h3Index);
    } catch (error) {
      console.warn('Failed to convert H3 to boundary:', error);
      return;
    }

    if (!boundary || boundary.length === 0) {
      console.warn('H3 to boundary conversion returned empty result');
      return;
    }

    // Close the polygon by adding the first point at the end
    const polygon = [...boundary, boundary[0]];

    // Remove existing layers
    this.removeH3();

    // Create GeoJSON
    const geojson: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: {
            type: 'Polygon',
            coordinates: [polygon],
          },
          properties: {
            h3Index: h3Index,
            resolution: this.resolution,
          },
        },
      ],
    };

    // Add source
    if (this.map && this.sourceId) {
      this.map.addSource(this.sourceId, {
        type: 'geojson',
        data: geojson,
      });

      // Add fill layer
      if (this.fillLayerId) {
        this.map.addLayer({
          id: this.fillLayerId,
          type: 'fill',
          source: this.sourceId,
          paint: {
            'fill-color': this.color,
            'fill-opacity': this.opacity,
          },
        });
      }

      // Add line layer
      if (this.lineLayerId) {
        this.map.addLayer({
          id: this.lineLayerId,
          type: 'line',
          source: this.sourceId,
          paint: {
            'line-color': this.strokeColor,
            'line-width': this.strokeWidth,
          },
        });
      }

      // Dispatch event
      this.dispatchEvent(
        new CustomEvent('h3-created', {
          detail: { h3Index: h3Index, element: this },
          bubbles: true,
        })
      );
    }
  }

  private removeH3(): void {
    if (!this.map) return;

    this.cleanupMapLayers(
      [this.lineLayerId, this.fillLayerId].filter(Boolean) as string[],
      [this.sourceId].filter(Boolean) as string[]
    );
  }

  override attributeChangedCallback(
    name: string,
    oldValue: string | null,
    newValue: string | null
  ): void {
    if (this.isInitialized && oldValue !== newValue) {
      if (name === 'visible') {
        this.toggleVisibility();
      } else {
        this.waitForStyleLoaded(() => this.renderH3());
      }
    }
  }

  private toggleVisibility(): void {
    if (!this.map) return;

    const visibility = this.visible ? 'visible' : 'none';

    if (this.fillLayerId && this.map?.getLayer?.(this.fillLayerId)) {
      this.map?.setLayoutProperty?.(this.fillLayerId, 'visibility', visibility);
    }

    if (this.lineLayerId && this.map?.getLayer?.(this.lineLayerId)) {
      this.map?.setLayoutProperty?.(this.lineLayerId, 'visibility', visibility);
    }
  }

  override disconnectedCallback(): void {
    this.removeH3();
    super.disconnectedCallback();
  }

  // Getters
  get resolution(): number {
    return parseInt(this.getAttribute('resolution') || '8') || 8;
  }

  get color(): string {
    return this.getAttribute('color') || '#3FB1CE';
  }

  get opacity(): number {
    return parseFloat(this.getAttribute('opacity') || '0.3') || 0.3;
  }

  get strokeColor(): string {
    return this.getAttribute('stroke-color') || '#1B8AA8';
  }

  get strokeWidth(): number {
    return parseFloat(this.getAttribute('stroke-width') || '2') || 2;
  }

  get visible(): boolean {
    return this.getAttribute('visible') !== 'false';
  }

  // Public API
  setH3Index(h3Index: string): void {
    this.setAttribute('h3-index', h3Index);
  }

  setCoordinates(lat: number, lng: number, resolution?: number): void {
    this.setAttribute('lat', lat.toString());
    this.setAttribute('lng', lng.toString());
    if (resolution !== undefined) {
      this.setAttribute('resolution', resolution.toString());
    }
  }

  getH3Index(): string | null {
    return this.currentH3Index;
  }

  show(): void {
    this.setAttribute('visible', 'true');
  }

  hide(): void {
    this.setAttribute('visible', 'false');
  }
}

// Register the custom element
if (!customElements.get('gk-h3')) {
  customElements.define('gk-h3', H3Element);
}
