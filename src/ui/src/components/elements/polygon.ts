/**
 * Polygon Component
 *
 * Displays polygon shapes on the map
 *
 * Usage:
 * <gk-polygon points="[[40.7,-74],[40.8,-74],[40.8,-73.9]]" fill-color="#ff0000"></gk-polygon>
 */

import { MapChildElement } from '../map-child-element';
import { normalizeCoordinatesArray } from '@local-hosting/geokit/core/coordinates';
import { simplifyPolygonRingToMaxPoints } from '@local-hosting/geokit/core/simplify';
import { createGeokitLogger } from '@local-hosting/geokit/core';
import { getCSSVariable } from '../../utils/theme';
import { buildChoroplethFillPaint, type FillAntialiasMap } from '../../utils/choropleth-fill-paint';
import type { LatLon } from '@local-hosting/geokit/core/types';

const { debug } = createGeokitLogger('polygon');

export interface PolygonOptions {
  points: number[][]; // Array of [lat, lng] coordinates
  fillColor?: string;
  fillOpacity?: number;
  strokeColor?: string;
  strokeWidth?: number;
  strokeOpacity?: number;
  visible?: boolean;
  interactive?: boolean;
  /** Layer ID to insert polygon before (ensures z-ordering). If not provided, auto-detects first circle layer. */
  beforeLayerId?: string;
}

export class PolygonElement extends MapChildElement {
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

  // Store options as properties (works in JSDOM without setAttribute issues)
  private _propPoints?: number[][];
  private _propFillColor?: string;
  private _propFillOpacity?: number;
  private _propStrokeColor?: string;
  private _propStrokeWidth?: number;
  private _propStrokeOpacity?: number;
  private _propVisible?: boolean;
  private _propInteractive?: boolean;
  private _propBeforeLayerId?: string;

  /**
   * Apply stored create options as properties (not attributes)
   * This avoids JSDOM's buggy setAttribute for custom elements
   */
  protected applyCreateOptions(options: PolygonOptions): void {
    // Store as properties - methods will read from these
    this._propPoints = options.points;
    if (options.fillColor) this._propFillColor = options.fillColor;
    if (options.fillOpacity !== undefined) this._propFillOpacity = options.fillOpacity;
    if (options.strokeColor) this._propStrokeColor = options.strokeColor;
    if (options.strokeWidth !== undefined) this._propStrokeWidth = options.strokeWidth;
    if (options.strokeOpacity !== undefined) this._propStrokeOpacity = options.strokeOpacity;
    if (options.visible !== undefined) this._propVisible = options.visible;
    if (options.interactive !== undefined) this._propInteractive = options.interactive;
    if (options.beforeLayerId) this._propBeforeLayerId = options.beforeLayerId;
  }

  async connectedCallback(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    // Apply options from create() factory method as attributes
    const createOptions = (this as any)._createOptions;
    if (createOptions) {
      this.applyCreateOptions(createOptions);
      (this as any)._createOptions = undefined;
    }

    // Generate unique IDs
    this.sourceId = `polygon-source-${crypto.randomUUID()}`;
    this.layerId = `polygon-fill-${crypto.randomUUID()}`;
    this.strokeLayerId = `polygon-stroke-${crypto.randomUUID()}`;

    // Find parent map
    this.addToParentMap();

    // Call super to ensure base initialization
    if (!this.isInitialized) {
      await super.connectedCallback();
    }
  }

  protected override async onMapReady(): Promise<void> {
    // NOTE: We intentionally do NOT call super.onMapReady() here because:
    // 1. The base class guard prevents re-processing the same map instance
    // 2. But polygons NEED to re-render when maps unfreeze (new WebGL context)
    // 3. We have our own duplicate detection via getLayer() check below

    if (!this.map) {
      return;
    }

    // Style is already ready (waited in waitForMapStyleReady), so create immediately
    // Create synchronously to avoid staggered rendering when many polygons are added
    // Host map shell fragment batching already prevents blocking the main thread
    // Check if polygon layer already exists (might have been created during wait)
    if (this.map.getLayer?.(this.layerId)) {
      return; // Already created
    }

    try {
      this.createPolygon();
    } catch (error) {
      console.error(`[gk-polygon] layer ${this.layerId} Error creating polygon:`, error);
    }
  }

  /** Re-add polygon layers after map style change only when overlays were dropped. */
  protected override onStyleLoad(): void {
    if (!this.map) return;
    debug.log(' onStyleLoad', { layerId: this.layerId, sourceId: this.sourceId });
    if (
      this.sourceId &&
      this.layerId &&
      this.map.getSource?.(this.sourceId) &&
      this.map.getLayer?.(this.layerId)
    ) {
      return;
    }
    try {
      this.createPolygon();
    } catch (error) {
      console.error(`[gk-polygon] layer ${this.layerId} Error re-creating polygon after style load:`, error);
    }
  }

  /**
   * Find the layer ID to insert polygon layers before.
   * Priority: 1) explicit beforeLayerId option, 2) first circle layer found.
   * This ensures polygons render below points (markers, etc.).
   */
  private findFirstPointLayer(): string | undefined {
    // If explicit beforeLayerId was provided, verify it exists and use it
    if (this._propBeforeLayerId && this.map) {
      const mapWithGetLayer = this.map as { getLayer?: (id: string) => unknown };
      if (mapWithGetLayer.getLayer?.(this._propBeforeLayerId)) {
        return this._propBeforeLayerId;
      }
    }

    if (!this.map) return undefined;

    try {
      const getStyle = (
        this.map as { getStyle?: () => { layers?: Array<{ id?: string; type?: string }> } }
      ).getStyle;
      if (!getStyle) return undefined;

      const style = getStyle();
      if (!style || !style.layers) return undefined;

      // Look for the first circle layer (points, point dots, glow hit areas)
      // Circle layers are used for point layers and their glow/hitarea
      for (const layer of style.layers) {
        if (layer.type === 'circle') {
          return layer.id;
        }
      }
    } catch {
      // Silently fail - layers will be added at top
    }

    return undefined;
  }

  private createPolygon(): void {
    if (!this.map) return;

    // Check visible - read from property first
    const visible = this._propVisible ?? this.safeGetAttribute('visible');
    if (visible === false || visible === 'false') {
      // If we were previously visible and became hidden, ensure layers/sources are removed.
      // This prevents "stuck outlines" when consumers toggle visibility instead of removing
      // the element from the DOM.
      this.removeLayerInteractivity(this.layerId);
      this.cleanupMapLayers([this.layerId, this.strokeLayerId], [this.sourceId]);
      debug.log(' createPolygon: cleared (not visible)', { layerId: this.layerId });
      return;
    }

    // Parse points - read from property first
    const pointsFromProp = this._propPoints;
    const pointsAttr = pointsFromProp
      ? JSON.stringify(pointsFromProp)
      : this.safeGetAttribute('points');
    if (!pointsAttr) {
      debug.warn(' points attribute is required');
      return;
    }
    debug.log(' createPolygon', { layerId: this.layerId, sourceId: this.sourceId });

    let coordinates: number[][];
    try {
      coordinates = JSON.parse(pointsAttr);
      // Normalize to [lat, lng] format first
      coordinates = normalizeCoordinatesArray(coordinates, 'latlon', 'auto');
    } catch (error) {
      debug.warn(' Invalid points format', error);
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

    // Simplify polygon if it has too many vertices to prevent 65535 vertex limit errors
    // Use a conservative maxPoints of 50 to ensure we stay well below the limit
    const MAX_POINTS = 50;
    if (coordinates.length > MAX_POINTS) {
      // Cast to LatLon[] since normalizeCoordinatesArray ensures [lat, lng] format
      const simplified = simplifyPolygonRingToMaxPoints(MAX_POINTS)(coordinates as LatLon[]);
      coordinates = simplified;
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
      debug.log(' source ADD', { sourceId: this.sourceId });

      // Find insertion point: insert before points
      // This ensures: polygons (below) < points (top)
      const beforeId = this.findFirstPointLayer();

      // Add fill layer - read from properties first, then CSS variables
      const fillColor =
        this._propFillColor ??
        this.safeGetAttribute('fill-color') ??
        getCSSVariable(this.mapElement, '--gk-polygon-fill-color', '');
      const fillOpacity =
        this._propFillOpacity ?? parseFloat(this.safeGetAttribute('fill-opacity') || '0.5');
      const fillSpec = {
        id: this.layerId,
        type: 'fill',
        source: this.sourceId,
        paint: buildChoroplethFillPaint(this.map as FillAntialiasMap, {
          'fill-color': fillColor,
          'fill-opacity': fillOpacity,
        }),
      };
      if (beforeId != null) {
        this.map.addLayer(fillSpec, beforeId);
      } else {
        this.map.addLayer(fillSpec);
      }
      debug.log(' fill layer ADD', {
        layerId: this.layerId,
        beforeLayerId: beforeId ?? undefined,
      });

      // Add stroke layer (after fill layer) - read from properties first
      // Skip stroke layer entirely if strokeWidth is 0 to avoid hairline rendering artifacts
      const strokeWidth =
        this._propStrokeWidth ?? parseFloat(this.safeGetAttribute('stroke-width') || '2');

      if (strokeWidth > 0) {
        // Prefer explicit stroke-color; otherwise fall back to fill-color so the outline
        // matches the polygon's theme color by default (helps apps keep pill/outline colors in sync).
        const strokeColor =
          this._propStrokeColor ??
          this.safeGetAttribute('stroke-color') ??
          fillColor ??
          getCSSVariable(this.mapElement, '--gk-polygon-stroke-color', '');
        const strokeOpacity =
          this._propStrokeOpacity ?? parseFloat(this.safeGetAttribute('stroke-opacity') || '1');
        const strokeSpec = {
          id: this.strokeLayerId,
          type: 'line',
          source: this.sourceId,
          paint: {
            'line-color': strokeColor,
            'line-width': strokeWidth,
            'line-opacity': strokeOpacity,
          },
        };
        if (beforeId != null) {
          this.map.addLayer(strokeSpec, beforeId);
        } else {
          this.map.addLayer(strokeSpec);
        }
        debug.log(' stroke layer ADD', {
          strokeLayerId: this.strokeLayerId,
          beforeLayerId: beforeId ?? undefined,
        });
      } else {
        debug.log(' stroke layer SKIP (strokeWidth 0)', {
          strokeLayerId: this.strokeLayerId,
        });
      }
    } catch (error) {
      console.error(`[gk-polygon] Error creating polygon ${this.sourceId}:`, error);
      throw error; // Re-throw to help with debugging
    }

    // Set up interactivity - read from property first
    const interactive = this._propInteractive ?? this.safeGetAttribute('interactive');
    if (interactive === true || interactive === 'true') {
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
        // When hidden, fully remove layers/sources so outlines can't remain on the map.
        // When shown again, recreate from current attributes/properties.
        if (newValue === 'false') {
          this.removeLayerInteractivity(this.layerId);
          this.cleanupMapLayers([this.layerId, this.strokeLayerId], [this.sourceId]);
        } else {
          this.createPolygon();
        }
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

  public updateFillStyle(): void {
    this.updatePaintProperties(this.layerId, {
      'fill-color':
        this._propFillColor ??
        this.safeGetAttribute('fill-color') ??
        getCSSVariable(this.mapElement, '--gk-polygon-fill-color', ''),
      'fill-opacity':
        this._propFillOpacity ?? parseFloat(this.safeGetAttribute('fill-opacity') || '0.5'),
    });
  }

  private updateStrokeStyle(): void {
    const fillColor =
      this._propFillColor ??
      this.safeGetAttribute('fill-color') ??
      getCSSVariable(this.mapElement, '--gk-polygon-fill-color', '');
    this.updatePaintProperties(this.strokeLayerId, {
      'line-color':
        this._propStrokeColor ??
        this.safeGetAttribute('stroke-color') ??
        fillColor ??
        getCSSVariable(this.mapElement, '--gk-polygon-stroke-color', ''),
      'line-width':
        this._propStrokeWidth ?? parseFloat(this.safeGetAttribute('stroke-width') || '2'),
      'line-opacity':
        this._propStrokeOpacity ?? parseFloat(this.safeGetAttribute('stroke-opacity') || '1'),
    });
  }

  protected override onMapUnload(): void {
    debug.log(' onMapUnload (removing layers)', {
      layerId: this.layerId,
      strokeLayerId: this.strokeLayerId,
      sourceId: this.sourceId,
    });
    // Clean up layers BEFORE calling super (which sets this.map = null)
    this.cleanupMapLayers([this.layerId, this.strokeLayerId], [this.sourceId]);
    super.onMapUnload();
  }

  disconnectedCallback(): void {
    if (this.map) {
      debug.log(' disconnectedCallback (removing layers)', {
        layerId: this.layerId,
        strokeLayerId: this.strokeLayerId,
        sourceId: this.sourceId,
      });
      this.removeLayerInteractivity(this.layerId);
      this.cleanupMapLayers([this.layerId, this.strokeLayerId], [this.sourceId]);
    }
    super.disconnectedCallback();
  }

  // Public API
  public getBounds(): { minLng: number; minLat: number; maxLng: number; maxLat: number } | null {
    // Read from property first
    const pointsFromProp = this._propPoints;
    const pointsAttr = pointsFromProp
      ? JSON.stringify(pointsFromProp)
      : this.safeGetAttribute('points');
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

  /**
   * Factory method to create and configure a polygon element
   * @param options - Polygon configuration options
   * @returns Configured polygon element
   */
  static create(options: PolygonOptions): PolygonElement {
    const polygon = document.createElement('gk-polygon') as PolygonElement;

    // Store options to set as attributes when element is connected to DOM
    // This avoids JSDOM/Happy-DOM limitations where attributes can't be set before connection
    (polygon as any)._createOptions = options;

    return polygon;
  }

  /**
   * Create polygon elements from GeoJSON Feature or Geometry
   * @param geojson - GeoJSON Feature or Geometry with Polygon/MultiPolygon
   * @param options - Optional styling options
   * @returns Array of configured polygon elements
   */
  static createFromGeoJSON(
    geojson: GeoJSON.Feature | GeoJSON.Geometry,
    options: {
      fillColor?: string;
      fillOpacity?: number;
      strokeColor?: string;
      strokeWidth?: number;
      strokeOpacity?: number;
      visible?: boolean;
      simplify?: boolean;
      maxPoints?: number;
    } = {}
  ): PolygonElement[] {
    // Read defaults from CSS variables (falls back to hardcoded if not set)
    const defaultFillColor = getCSSVariable(
      document.documentElement,
      '--gk-polygon-fill-color',
      ''
    );
    const defaultStrokeColor = getCSSVariable(
      document.documentElement,
      '--gk-polygon-stroke-color',
      ''
    );

    const {
      fillColor = defaultFillColor,
      fillOpacity = 0.1,
      strokeColor = defaultStrokeColor,
      strokeWidth = 2,
      strokeOpacity = 1,
      visible = true,
      simplify: _simplify = true, // Always simplify large polygons, kept for API compatibility
      maxPoints = 50, // Reduced default from 100 to prevent 65535 vertex limit errors
    } = options;

    const polygons: PolygonElement[] = [];

    // Extract geometry from Feature or use directly
    const geometry = 'geometry' in geojson ? geojson.geometry : geojson;

    const addPolygonRings = (coordinates: number[][][], opts: typeof options): void => {
      // Only process the first ring (outer boundary)
      // Subsequent rings are holes, which gk-polygon doesn't support yet
      const outerRing = coordinates[0];
      if (!outerRing) return;

      // Convert [lng, lat] to [lat, lng] format
      let points: LatLon[] = outerRing.map(([lng, lat]) => [lat, lng]);

      // Always simplify if polygon has too many points to prevent 65535 vertex limit errors
      const targetMaxPoints = opts.maxPoints ?? maxPoints;
      if (points.length > targetMaxPoints) {
        points = simplifyPolygonRingToMaxPoints(targetMaxPoints)(points);
      }

      // Skip if too few points
      if (points.length < 3) return;

      // Convert to array format for gk-polygon
      const pointArray = points.map(([lat, lng]) => [lat, lng]);

      const polygon = PolygonElement.create({
        points: pointArray,
        fillColor: opts.fillColor || fillColor,
        fillOpacity: opts.fillOpacity ?? fillOpacity,
        strokeColor: opts.strokeColor || strokeColor,
        strokeWidth: opts.strokeWidth ?? strokeWidth,
        strokeOpacity: opts.strokeOpacity ?? strokeOpacity,
        visible: opts.visible ?? visible,
      });

      polygons.push(polygon);
    };

    if (geometry.type === 'Polygon') {
      addPolygonRings(geometry.coordinates, options);
    } else if (geometry.type === 'MultiPolygon') {
      geometry.coordinates.forEach((polygonCoords) => {
        addPolygonRings(polygonCoords, options);
      });
    }

    return polygons;
  }
}

// Register custom element
if (!customElements.get('gk-polygon')) {
  customElements.define('gk-polygon', PolygonElement);
}
