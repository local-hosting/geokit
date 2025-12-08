/**
 * Polygon Component
 * 
 * Displays polygon shapes on the map
 * 
 * Usage:
 * <mapi-polygon points="[[40.7,-74],[40.8,-74],[40.8,-73.9]]" fill-color="#ff0000"></mapi-polygon>
 */

import { BaseElement } from '../base-element';
import { normalizeCoordinatesArray } from '../../../utils/coordinates';

export class PolygonElement extends BaseElement {
  static observedAttributes = [
    'points',
    'fill-color',
    'stroke-color',
    'fill-opacity',
    'stroke-opacity',
    'stroke-width',
    'visible',
    'interactive',
  ];

  private sourceId: string = '';
  private layerId: string = '';
  private strokeLayerId: string = '';

  async connectedCallback(): Promise<void> {
    if (this.isInitialized) return;

    // Generate unique IDs
    this.sourceId = `polygon-source-${crypto.randomUUID()}`;
    this.layerId = `polygon-fill-${crypto.randomUUID()}`;
    this.strokeLayerId = `polygon-stroke-${crypto.randomUUID()}`;

    // Find parent map
    this.addToParentMap();
    this.isInitialized = true;
  }

  protected async onMapReady(): Promise<void> {
    await super.onMapReady();
    this.createPolygon();
  }

  private createPolygon(): void {
    if (!this.map || this.getAttribute('visible') === 'false') return;

    // Parse points
    const pointsAttr = this.getAttribute('points');
    if (!pointsAttr) {
      console.warn('Polygon: points attribute is required');
      return;
    }

    let coordinates: number[][];
    try {
      coordinates = JSON.parse(pointsAttr);
      // Normalize using geokit
      coordinates = normalizeCoordinatesArray(coordinates);
    } catch (error) {
      console.error('Polygon: Invalid points format', error);
      return;
    }

    // Ensure polygon is closed
    if (coordinates.length > 0) {
      const first = coordinates[0];
      const last = coordinates[coordinates.length - 1];
      if (first[0] !== last[0] || first[1] !== last[1]) {
        coordinates.push([...first]);
      }
    }

    // Create GeoJSON
    const geojson = {
      type: 'Feature' as const,
      geometry: {
        type: 'Polygon' as const,
        coordinates: [coordinates],
      },
      properties: {},
    };

    // Remove existing layers
    this.cleanupMapLayers([this.layerId, this.strokeLayerId], [this.sourceId]);

    // Add source
    this.map.addSource(this.sourceId, {
      type: 'geojson',
      data: geojson,
    });

    // Add fill layer
    this.map.addLayer({
      id: this.layerId,
      type: 'fill',
      source: this.sourceId,
      paint: {
        'fill-color': this.getAttribute('fill-color') || '#3FB1CE',
        'fill-opacity': parseFloat(this.getAttribute('fill-opacity') || '0.5'),
      },
    });

    // Add stroke layer
    this.map.addLayer({
      id: this.strokeLayerId,
      type: 'line',
      source: this.sourceId,
      paint: {
        'line-color': this.getAttribute('stroke-color') || '#000000',
        'line-width': parseFloat(this.getAttribute('stroke-width') || '2'),
        'line-opacity': parseFloat(this.getAttribute('stroke-opacity') || '1'),
      },
    });

    // Set up interactivity
    if (this.getAttribute('interactive') === 'true') {
      this.setupLayerInteractivity(this.layerId, 'polygon');
    }

    // Dispatch created event
    this.dispatchEvent(
      new CustomEvent('polygon-created', {
        detail: { sourceId: this.sourceId, layerId: this.layerId },
        bubbles: true,
      })
    );
  }

  protected handleAttributeChange(name: string, oldValue: string | null, newValue: string | null): void {
    if (!this.map) return;

    switch (name) {
      case 'points':
        this.createPolygon();
        break;
      case 'visible':
        this.toggleLayerVisibility([this.layerId, this.strokeLayerId], () => this.createPolygon());
        break;
      case 'fill-color':
      case 'fill-opacity':
        this.updateFillStyle();
        break;
      case 'stroke-color':
      case 'stroke-width':
      case 'stroke-opacity':
        this.updateStrokeStyle();
        break;
      case 'interactive':
        if (newValue === 'true') {
          this.setupLayerInteractivity(this.layerId, 'polygon');
        } else {
          this.removeLayerInteractivity(this.layerId);
        }
        break;
    }
  }

  private updateFillStyle(): void {
    this.updatePaintProperties(this.layerId, {
      'fill-color': this.getAttribute('fill-color') || '#3FB1CE',
      'fill-opacity': parseFloat(this.getAttribute('fill-opacity') || '0.5'),
    });
  }

  private updateStrokeStyle(): void {
    this.updatePaintProperties(this.strokeLayerId, {
      'line-color': this.getAttribute('stroke-color') || '#000000',
      'line-width': parseFloat(this.getAttribute('stroke-width') || '2'),
      'line-opacity': parseFloat(this.getAttribute('stroke-opacity') || '1'),
    });
  }

  protected onMapUnload(): void {
    super.onMapUnload();
    this.cleanupMapLayers([this.layerId, this.strokeLayerId], [this.sourceId]);
  }

  disconnectedCallback(): void {
    if (this.map) {
      this.removeLayerInteractivity(this.layerId);
      this.cleanupMapLayers([this.layerId, this.strokeLayerId], [this.sourceId]);
    }
    super.disconnectedCallback();
  }

  // Public API
  public getBounds(): any {
    const pointsAttr = this.getAttribute('points');
    if (!pointsAttr) return null;

    try {
      const coordinates = JSON.parse(pointsAttr);
      return this.calculateBounds(coordinates);
    } catch {
      return null;
    }
  }

  public fitBounds(options?: any): void {
    const bounds = this.getBounds();
    if (bounds && this.map) {
      this.map.fitBounds([
        [bounds.minLng, bounds.minLat],
        [bounds.maxLng, bounds.maxLat],
      ], options);
    }
  }
}

// Register custom element
if (!customElements.get('mapi-polygon')) {
  customElements.define('mapi-polygon', PolygonElement);
}

