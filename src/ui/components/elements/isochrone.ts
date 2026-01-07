/**
 * Geokit Isochrone Component
 *
 * Displays isochrone (travel time) polygons on the map
 *
 * Usage:
 * <gk-isochrone lat="40.7128" lng="-74.0060" time="15" mode="driving"></gk-isochrone>
 */

import { BaseElement } from '../base-element';
import { getProviderForCapability } from '../../../api/providers/registry';

export interface IsochroneOptions {
  lat: number;
  lng: number;
  time: number; // in minutes
  mode?: 'driving' | 'walking' | 'cycling';
  color?: string;
  opacity?: number;
  strokeColor?: string;
  strokeWidth?: number;
}

export class IsochroneElement extends BaseElement {
  static observedAttributes = [
    'lat',
    'lng',
    'time',
    'mode',
    'color',
    'opacity',
    'stroke-color',
    'stroke-width',
    'visible',
  ];

  private sourceId: string | null = null;
  private lineLayerId: string | null = null;
  private fillLayerId: string | null = null;
  private currentCacheKey: string | null = null;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  protected override async onMapReady(): Promise<void> {
    await super.onMapReady();
    this.waitForStyleLoaded(() => this.fetchAndRenderIsochrone());
  }

  override async connectedCallback() {
    await super.connectedCallback();

    if (this.isInitialized) return;

    // Generate unique IDs
    this.sourceId = `isochrone-${crypto.randomUUID()}`;
    this.lineLayerId = `isochrone-line-${crypto.randomUUID()}`;
    this.fillLayerId = `isochrone-fill-${crypto.randomUUID()}`;

    this.isInitialized = true;
  }

  private async fetchAndRenderIsochrone(): Promise<void> {
    if (!this.map || !this.visible) return;

    const lat = parseFloat(this.getAttribute('lat') || '');
    const lng = parseFloat(this.getAttribute('lng') || '');
    const time = this.time;
    const mode = this.mode;

    if (isNaN(lat) || isNaN(lng)) {
      console.warn('Isochrone: Invalid lat/lng coordinates');
      return;
    }

    // Create cache key
    const cacheKey = `${lat},${lng},${time},${mode}`;
    if (cacheKey === this.currentCacheKey) return; // Skip if same request

    this.currentCacheKey = cacheKey;

    // Get API provider that supports isochrone
    const provider = getProviderForCapability('isochrone');
    if (!provider) {
      console.warn('Isochrone: No API provider supports isochrone capability');
      return;
    }

    try {
      // Fetch isochrone data
      const result = await provider.fetchIsochrone?.({
        lat,
        lng,
        minutes: [time],
        mode,
      });

      if (!result || !result.features || result.features.length === 0) {
        console.warn('Isochrone: No features returned');
        return;
      }

      // Remove existing layers
      this.removeIsochrone();

      // Add source
      if (this.map && this.sourceId) {
        this.map.addSource(this.sourceId, {
          type: 'geojson',
          data: result,
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
          new CustomEvent('isochrone-loaded', {
            detail: { lat, lng, time, mode, data: result, element: this },
            bubbles: true,
          })
        );
      }
    } catch (error) {
      console.error('Failed to fetch isochrone:', error);
      this.dispatchEvent(
        new CustomEvent('isochrone-error', {
          detail: { error, element: this },
          bubbles: true,
        })
      );
    }
  }

  private removeIsochrone(): void {
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
        this.waitForStyleLoaded(() => this.fetchAndRenderIsochrone());
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
    this.removeIsochrone();
    super.disconnectedCallback();
  }

  // Getters
  get time(): number {
    return parseInt(this.getAttribute('time') || '15') || 15;
  }

  get mode(): 'driving' | 'walking' | 'cycling' {
    const mode = this.getAttribute('mode');
    if (mode === 'walking' || mode === 'cycling') return mode;
    return 'driving';
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
  async refresh(): Promise<void> {
    this.currentCacheKey = null; // Force refresh
    await this.waitForStyleLoaded(() => this.fetchAndRenderIsochrone());
  }

  show(): void {
    this.setAttribute('visible', 'true');
  }

  hide(): void {
    this.setAttribute('visible', 'false');
  }
}

// Register the custom element
if (!customElements.get('gk-isochrone')) {
  customElements.define('gk-isochrone', IsochroneElement);
}
