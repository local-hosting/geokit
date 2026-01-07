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

    // connectedCallback called

    // Find parent map
    this.addToParentMap();

    // Call super to ensure base initialization
    if (!this.isInitialized) {
      await super.connectedCallback();
    }
  }

  protected async onMapReady(): Promise<void> {
    await super.onMapReady();
    this.waitForStyleLoaded(() => {
      this.createPolygon();
    });
  }

  /**
   * Find the first point layer to insert polygon layers before it
   * This ensures polygons render below points
   */
  private findFirstPointLayer(): string | undefined {
    if (!this.map) return undefined;

    try {
      const getStyle = (
        this.map as { getStyle?: () => { layers?: Array<{ id?: string; type?: string }> } }
      ).getStyle;
      if (!getStyle) return undefined;

      const style = getStyle();
      if (!style || !style.layers) return undefined;

      // Look for the first point/circle layer
      for (const layer of style.layers) {
        if (layer.type === 'circle' && layer.id?.startsWith('point-')) {
          return layer.id;
        }
      }
    } catch {
      // Silently fail - layers will be added at top
    }

    return undefined;
  }

  private createPolygon(): void {
    if (!this.map) {
      console.warn('[Polygon] Cannot create: no map');
      return;
    }

    if (this.getAttribute('visible') === 'false') {
      return;
    }

    // Parse points
    const pointsAttr = this.getAttribute('points');
    if (!pointsAttr) {
      console.warn(`[Polygon] points attribute is required for ${this.sourceId}`);
      return;
    }

    let coordinates: number[][];
    try {
      coordinates = JSON.parse(pointsAttr);
      // Normalize to [lat, lng] format first
      coordinates = normalizeCoordinatesArray(coordinates, 'latlon', 'auto');
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

    // Convert [lat, lng] to [lng, lat] for GeoJSON format
    const geoJsonCoordinates = coordinates.map(([lat, lng]) => [lng, lat]);

    // Create GeoJSON
    const geojson = {
      type: 'Feature' as const,
      geometry: {
        type: 'Polygon' as const,
        coordinates: [geoJsonCoordinates],
      },
      properties: {},
    };

    // Remove existing layers
    this.cleanupMapLayers([this.layerId, this.strokeLayerId], [this.sourceId]);

    try {
      // Add source
      this.map.addSource(this.sourceId, {
        type: 'geojson',
        data: geojson,
      });

      // Find the first point layer to insert polygon layers before it
      // This ensures polygons render below points
      const beforeId = this.findFirstPointLayer();

      // Add fill layer
      const fillColor = this.getAttribute('fill-color') || '#3FB1CE';
      const fillOpacity = parseFloat(this.getAttribute('fill-opacity') || '0.5');
      this.map.addLayer(
        {
          id: this.layerId,
          type: 'fill',
          source: this.sourceId,
          paint: {
            'fill-color': fillColor,
            'fill-opacity': fillOpacity,
          },
        },
        beforeId
      );

      // Add stroke layer (after fill layer)
      const strokeColor = this.getAttribute('stroke-color') || '#000000';
      const strokeWidth = parseFloat(this.getAttribute('stroke-width') || '2');
      const strokeOpacity = parseFloat(this.getAttribute('stroke-opacity') || '1');
      this.map.addLayer(
        {
          id: this.strokeLayerId,
          type: 'line',
          source: this.sourceId,
          paint: {
            'line-color': strokeColor,
            'line-width': strokeWidth,
            'line-opacity': strokeOpacity,
          },
        },
        beforeId
      );
    } catch (error) {
      console.error(`[Polygon] Error creating polygon ${this.sourceId}:`, error);
    }

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

  protected handleAttributeChange(
    name: string,
    oldValue: string | null,
    newValue: string | null
  ): void {
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
  public getBounds(): { minLng: number; minLat: number; maxLng: number; maxLat: number } | null {
    const pointsAttr = this.getAttribute('points');
    if (!pointsAttr) return null;

    try {
      const coordinates = JSON.parse(pointsAttr);
      return this.calculateBounds(coordinates);
    } catch {
      return null;
    }
  }

  public fitBounds(options?: unknown): void {
    const bounds = this.getBounds();
    if (bounds && this.map) {
      const fitBounds = (
        this.map as {
          fitBounds?: (bounds: [[number, number], [number, number]], options?: unknown) => void;
        }
      ).fitBounds;
      if (fitBounds) {
        fitBounds(
          [
            [bounds.minLng, bounds.minLat],
            [bounds.maxLng, bounds.maxLat],
          ],
          options
        );
      }
    }
  }
}

// Register custom element
if (!customElements.get('mapi-polygon')) {
  customElements.define('mapi-polygon', PolygonElement);
}
