/**
 * Geokit H3 Component
 *
 * Displays H3 hexagon cells on the map
 *
 * Usage:
 * <gk-h3 lat="40.7128" lng="-74.0060" resolution="8"></gk-h3>
 * <gk-h3 h3-index="8828308281fffff"></gk-h3>
 * <gk-h3 lat="40.7128" lng="-74.0060" ring-k="2"></gk-h3>
 */

import { MapChildElement } from '../map-child-element';
import { coordinatesToH3, h3DiskToFeatureCollection, h3GetResolution } from '@doppler-group/geokit/h3';
import { getCSSVariable } from '../../utils/theme';

/** Light fill when hovering a cell whose base opacity is 0 (outline-only grids). */
const H3_HOVER_FILL_OPACITY = 0.05;

function h3HoverFillOpacity(baseOpacity: number): number {
  return baseOpacity <= 0
    ? H3_HOVER_FILL_OPACITY
    : Math.min(baseOpacity + 0.18, 0.55);
}

export interface H3Options {
  lat?: number;
  lng?: number;
  h3Index?: string;
  resolution?: number;
  color?: string;
  opacity?: number;
  strokeColor?: string;
  strokeWidth?: number;
  ringK?: number;
  ringOpacity?: number;
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
    'ring-k',
    'ring-opacity',
    'visible',
    'interactive',
  ];

  private sourceId: string | null = null;
  private lineLayerId: string | null = null;
  private fillLayerId: string | null = null;
  private currentH3Index: string | null = null;
  private currentRingK: number | null = null;
  private interactiveBound = false;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  protected override async onMapReady(): Promise<void> {
    await super.onMapReady();
    if (!this.map) return;
    requestAnimationFrame(() => this.renderH3());
  }

  /** Re-add H3 layers after map style change (e.g. theme toggle). */
  protected override onStyleLoad(): void {
    if (!this.map) return;
    requestAnimationFrame(() => this.renderH3());
  }

  private ensureLayerIds(): void {
    if (this.sourceId) return;
    this.sourceId = `h3-cell-${crypto.randomUUID()}`;
    this.lineLayerId = `h3-cell-line-${crypto.randomUUID()}`;
    this.fillLayerId = `h3-cell-fill-${crypto.randomUUID()}`;
  }

  override async connectedCallback() {
    // Generate layer ids before super — BaseElement.connectedCallback sets isInitialized.
    this.ensureLayerIds();

    await super.connectedCallback();

    if (this.map) {
      requestAnimationFrame(() => this.renderH3());
    }
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
          h3Index = coordinatesToH3(resolution)([lat, lng]);
        } catch (error) {
          console.warn('[gk-h3] Failed to create H3 index from coordinates:', error);
          return;
        }
      }
    }

    if (!h3Index) {
      console.warn('[gk-h3] No valid coordinates or H3 index provided');
      return;
    }

    const ringK = this.ringK;

    if (h3Index === this.currentH3Index && ringK === this.currentRingK) return;

    this.currentH3Index = h3Index;
    this.currentRingK = ringK;

    const resolution = explicitH3 ? h3GetResolution(h3Index) : this.resolution;
    const geojson = h3DiskToFeatureCollection(h3Index, ringK, {
      properties: { resolution },
    });

    if (geojson.features.length === 0) {
      console.warn('[gk-h3] to feature collection returned no features');
      return;
    }

    this.removeH3();

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
            'fill-opacity': this.fillOpacityPaint(),
          },
        });
      }

      // Add line layer
      if (this.lineLayerId && this.strokeWidth > 0) {
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

      if (this.interactive && this.fillLayerId) {
        this.bindFillInteractivity(this.fillLayerId);
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

  private fillOpacityPaint(): number | unknown[] {
    const ringK = this.ringK;
    return ringK > 0
      ? ([
          'case',
          ['boolean', ['get', 'isCenter'], false],
          this.opacity,
          this.ringOpacity,
        ] as unknown[])
      : this.opacity;
  }

  private bindFillInteractivity(layerId: string): void {
    if (!this.map || this.interactiveBound) return;
    this.interactiveBound = true;
    this.setupLayerInteractivity(layerId, 'h3');

    const baseFillOpacity = this.fillOpacityPaint();
    const hoverFillOpacity =
      this.ringK > 0
        ? h3HoverFillOpacity(Math.max(this.opacity, this.ringOpacity))
        : h3HoverFillOpacity(this.opacity);

    this.map.on('mouseenter', layerId, () => {
      if (this.fillLayerId) {
        this.map?.setPaintProperty?.(this.fillLayerId, 'fill-opacity', hoverFillOpacity);
      }
    });
    this.map.on('mouseleave', layerId, () => {
      if (this.fillLayerId) {
        this.map?.setPaintProperty?.(this.fillLayerId, 'fill-opacity', baseFillOpacity);
      }
    });
  }

  private unbindFillInteractivity(layerId: string | null): void {
    if (!this.map || !layerId || !this.interactiveBound) return;
    this.removeLayerInteractivity(layerId);
    this.interactiveBound = false;
  }

  private removeH3(): void {
    if (!this.map) return;

    this.unbindFillInteractivity(this.fillLayerId);

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
      } else if (name === 'interactive') {
        this.removeH3();
        requestAnimationFrame(() => this.renderH3());
      } else {
        requestAnimationFrame(() => this.renderH3());
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
    return this.getAttribute('color') || getCSSVariable(this.mapElement, '--gk-h3-color', '');
  }

  get opacity(): number {
    const attr = this.getAttribute('opacity');
    if (attr != null && attr !== '') {
      const parsed = parseFloat(attr);
      if (Number.isFinite(parsed)) return parsed;
    }
    return 0.3;
  }

  get strokeColor(): string {
    return (
      this.getAttribute('stroke-color') ||
      getCSSVariable(this.mapElement, '--gk-h3-stroke-color', '')
    );
  }

  get strokeWidth(): number {
    const attr = this.getAttribute('stroke-width');
    if (attr != null && attr !== '') {
      const parsed = parseFloat(attr);
      if (Number.isFinite(parsed)) return parsed;
    }
    return 2;
  }

  get ringK(): number {
    const parsed = parseInt(this.getAttribute('ring-k') || '0', 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  }

  get ringOpacity(): number {
    const attr = this.getAttribute('ring-opacity');
    if (attr != null && attr !== '') {
      const parsed = parseFloat(attr);
      if (Number.isFinite(parsed)) return parsed;
    }
    return this.opacity;
  }

  get visible(): boolean {
    return this.getAttribute('visible') !== 'false';
  }

  get interactive(): boolean {
    return this.getAttribute('interactive') === 'true';
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
