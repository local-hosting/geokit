/**
 * Polygon Component
 *
 * Displays polygon shapes on the map
 *
 * Usage:
 * <mapi-polygon points="[[40.7,-74],[40.8,-74],[40.8,-73.9]]" fill-color="#ff0000"></mapi-polygon>
 */

import { MapChildElement } from '../map-child-element';
import { normalizeCoordinatesArray } from '../../../utils/coordinates';
import { simplifyPolygonRingToMaxPoints } from '../../../utils/simplify';
import type { LatLon } from '../../../types';

export interface PolygonOptions {
  points: number[][]; // Array of [lat, lng] coordinates
  fillColor?: string;
  fillOpacity?: number;
  strokeColor?: string;
  strokeWidth?: number;
  strokeOpacity?: number;
  visible?: boolean;
  interactive?: boolean;
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
  private _styleWaitSetup: boolean = false;

  // Store options as properties (works in JSDOM without setAttribute issues)
  private _propPoints?: number[][];
  private _propFillColor?: string;
  private _propFillOpacity?: number;
  private _propStrokeColor?: string;
  private _propStrokeWidth?: number;
  private _propStrokeOpacity?: number;
  private _propVisible?: boolean;
  private _propInteractive?: boolean;

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
  }

  async connectedCallback(): Promise<void> {
    if (this.isInitialized) {
      console.log(
        `[Polygon] connectedCallback called but already initialized, layerId: ${this.layerId}`
      );
      return;
    }

    console.log('[Polygon] connectedCallback called - initializing new polygon element');

    // Apply options from create() factory method as attributes
    // This ensures attributes are set after element is connected (works in JSDOM/Happy-DOM)
    const createOptions = (this as any)._createOptions;
    if (createOptions) {
      console.log('[Polygon] Applying create options:', {
        hasPoints: !!createOptions.points,
        pointCount: createOptions.points?.length || 0,
        visible: createOptions.visible,
        fillColor: createOptions.fillColor,
        fillOpacity: createOptions.fillOpacity,
      });
      this.applyCreateOptions(createOptions);
      // Clear stored options
      (this as any)._createOptions = undefined;
    } else {
      console.log('[Polygon] No create options found, will read from attributes');
    }

    // Generate unique IDs
    this.sourceId = `polygon-source-${crypto.randomUUID()}`;
    this.layerId = `polygon-fill-${crypto.randomUUID()}`;
    this.strokeLayerId = `polygon-stroke-${crypto.randomUUID()}`;
    console.log(`[Polygon] Generated IDs - sourceId: ${this.sourceId}, layerId: ${this.layerId}`);

    // Find parent map
    this.addToParentMap();

    // Call super to ensure base initialization
    if (!this.isInitialized) {
      await super.connectedCallback();
    }

    console.log(`[Polygon] connectedCallback completed, isInitialized: ${this.isInitialized}`);
  }

  protected async onMapReady(): Promise<void> {
    // Polygons don't need to wait for idle - just need map and style loaded
    if (!this.map) {
      console.warn('[Polygon] onMapReady called but no map instance');
      return;
    }

    console.log(
      `[Polygon] onMapReady called for ${this.layerId || 'new polygon'}, map exists:`,
      !!this.map
    );

    // Function to attempt creating the polygon
    const tryCreatePolygon = (source: string) => {
      if (!this.map) {
        console.warn(`[Polygon] tryCreatePolygon(${source}) called but no map instance`);
        return;
      }

      // Check if polygon layer already exists
      const hasLayer = this.map.getLayer?.(this.layerId);
      if (hasLayer) {
        console.log(
          `[Polygon] Layer ${this.layerId} already exists, skipping creation (source: ${source})`
        );
        return;
      }

      console.log(
        `[Polygon] Attempting to create polygon (source: ${source}), layerId: ${this.layerId}`
      );

      // Check if we have points
      const pointsFromProp = this._propPoints;
      const pointsAttr = pointsFromProp
        ? JSON.stringify(pointsFromProp)
        : this.safeGetAttribute('points');
      const hasPoints = !!pointsAttr;
      console.log(
        `[Polygon] Has points: ${hasPoints}, from prop: ${!!pointsFromProp}, from attr: ${!!this.safeGetAttribute('points')}`
      );

      // Check visibility
      const visible = this._propVisible ?? this.safeGetAttribute('visible');
      console.log(
        `[Polygon] Visibility: ${visible}, from prop: ${this._propVisible}, from attr: ${this.safeGetAttribute('visible')}`
      );

      // Try to create the polygon
      try {
        this.createPolygon();
        // Check if layer was created
        const layerCreated = this.map.getLayer?.(this.layerId);
        console.log(
          `[Polygon] createPolygon() completed, layer exists: ${!!layerCreated} (source: ${source})`
        );
      } catch (error) {
        console.error(
          `[Polygon] Error creating polygon after map ready (source: ${source}):`,
          error
        );
      }
    };

    // Wait for style to be loaded
    // waitForStyleLoaded already handles the case where style is already loaded
    // Only set up once per onMapReady call to prevent duplicate callbacks
    if (!this._styleWaitSetup) {
      console.log('[Polygon] Setting up waitForStyleLoaded callback');
      this._styleWaitSetup = true;
      this.waitForStyleLoaded(() => {
        console.log('[Polygon] waitForStyleLoaded callback fired');
        this._styleWaitSetup = false; // Reset after callback fires
        tryCreatePolygon('waitForStyleLoaded');
      });
    } else {
      console.log('[Polygon] waitForStyleLoaded already set up, skipping duplicate setup');
    }

    // Set up a fallback timeout only if style is not loaded
    // This ensures polygon is created even if style.load event doesn't fire
    const map = this.map as any;
    const isStyleLoaded = map.isStyleLoaded && map.isStyleLoaded();
    console.log(`[Polygon] Style loaded check: ${isStyleLoaded}`);
    if (!isStyleLoaded) {
      console.log('[Polygon] Style not loaded, setting up 3s fallback timeout');
      setTimeout(() => {
        if (this.map && !this.map.getLayer?.(this.layerId)) {
          // Layer still doesn't exist, try creating anyway
          console.log('[Polygon] Fallback timeout fired, attempting creation');
          tryCreatePolygon('fallback-timeout');
        } else {
          console.log('[Polygon] Fallback timeout fired but layer already exists or map is gone');
        }
      }, 3000); // Wait up to 3 seconds
    }
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

    console.log(
      `[Polygon] createPolygon() called for layerId: ${this.layerId}, sourceId: ${this.sourceId}`
    );

    // Check visible - read from property first
    const visible = this._propVisible ?? this.safeGetAttribute('visible');
    if (visible === false || visible === 'false') {
      console.log(
        `[Polygon] Skipping creation - visible is false (prop: ${this._propVisible}, attr: ${this.safeGetAttribute('visible')})`
      );
      return;
    }

    // Parse points - read from property first
    const pointsFromProp = this._propPoints;
    const pointsAttr = pointsFromProp
      ? JSON.stringify(pointsFromProp)
      : this.safeGetAttribute('points');
    if (!pointsAttr) {
      console.warn(
        `[Polygon] points attribute is required for ${this.sourceId}, prop: ${!!pointsFromProp}, attr: ${!!this.safeGetAttribute('points')}`
      );
      return;
    }

    const pointCount = pointsFromProp ? pointsFromProp.length : JSON.parse(pointsAttr)?.length || 0;
    console.log(`[Polygon] Creating polygon with ${pointCount} points`);

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

      // Find the first point layer to insert polygon layers before it
      // This ensures polygons render below points
      const beforeId = this.findFirstPointLayer();

      // Add fill layer - read from properties first
      const fillColor = this._propFillColor ?? this.safeGetAttribute('fill-color') ?? '#3FB1CE';
      const fillOpacity =
        this._propFillOpacity ?? parseFloat(this.safeGetAttribute('fill-opacity') || '0.5');
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

      // Add stroke layer (after fill layer) - read from properties first
      const strokeColor =
        this._propStrokeColor ?? this.safeGetAttribute('stroke-color') ?? '#000000';
      const strokeWidth =
        this._propStrokeWidth ?? parseFloat(this.safeGetAttribute('stroke-width') || '2');
      const strokeOpacity =
        this._propStrokeOpacity ?? parseFloat(this.safeGetAttribute('stroke-opacity') || '1');
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
      throw error; // Re-throw to help with debugging
    }

    console.log(
      `[Polygon] Successfully created polygon layers: ${this.layerId}, ${this.strokeLayerId}`
    );

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
      'fill-color': this._propFillColor ?? this.safeGetAttribute('fill-color') ?? '#3FB1CE',
      'fill-opacity':
        this._propFillOpacity ?? parseFloat(this.safeGetAttribute('fill-opacity') || '0.5'),
    });
  }

  private updateStrokeStyle(): void {
    this.updatePaintProperties(this.strokeLayerId, {
      'line-color': this._propStrokeColor ?? this.safeGetAttribute('stroke-color') ?? '#000000',
      'line-width':
        this._propStrokeWidth ?? parseFloat(this.safeGetAttribute('stroke-width') || '2'),
      'line-opacity':
        this._propStrokeOpacity ?? parseFloat(this.safeGetAttribute('stroke-opacity') || '1'),
    });
  }

  protected onMapUnload(): void {
    console.log(
      `[Polygon] onMapUnload called for layerId: ${this.layerId}, sourceId: ${this.sourceId}`
    );
    super.onMapUnload();
    this.cleanupMapLayers([this.layerId, this.strokeLayerId], [this.sourceId]);
    this._styleWaitSetup = false; // Reset flag on unload
    console.log(`[Polygon] Cleaned up layers after unload: ${this.layerId}, ${this.strokeLayerId}`);
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
    const {
      fillColor = '#3b82f6',
      fillOpacity = 0.1,
      strokeColor = '#3b82f6',
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
      if (!outerRing) {
        console.warn('Polygon has no outer ring');
        return;
      }

      // Convert [lng, lat] to [lat, lng] format
      let points: LatLon[] = outerRing.map(([lng, lat]) => [lat, lng]);

      // Always simplify if polygon has too many points to prevent 65535 vertex limit errors
      // Use the provided maxPoints or default to 50
      const targetMaxPoints = opts.maxPoints ?? maxPoints;
      if (points.length > targetMaxPoints) {
        points = simplifyPolygonRingToMaxPoints(targetMaxPoints)(points);
      }

      // Skip if too few points
      if (points.length < 3) {
        console.warn('Skipping polygon ring with fewer than 3 points');
        return;
      }

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
    } else {
      console.warn('Unsupported geometry type for polygon:', geometry.type);
    }

    return polygons;
  }
}

// Register custom element
if (!customElements.get('gk-polygon')) {
  customElements.define('gk-polygon', PolygonElement);
}
