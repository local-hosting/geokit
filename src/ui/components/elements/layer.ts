/**
 * Geokit Layer Component
 *
 * Generic MapLibre layer component for rendering GeoJSON features.
 * Supports all layer types (circle, fill, line, symbol, etc.) with
 * data-driven styling via paint/layout expressions.
 *
 * Multiple gk-layer elements can share the same source-id for efficiency.
 *
 * Usage:
 * <gk-layer
 *   source-id="venues"
 *   layer-id="venue-points"
 *   type="circle"
 *   :data="geojson"
 *   :paint="{ 'circle-color': ['get', 'color'], 'circle-radius': 6 }"
 * />
 */

import { MapChildElement } from '../map-child-element';

export type LayerType =
  | 'circle'
  | 'fill'
  | 'line'
  | 'symbol'
  | 'raster'
  | 'fill-extrusion'
  | 'heatmap'
  | 'hillshade';

export interface LayerOptions {
  /** Unique source identifier. Multiple layers can share the same source. */
  sourceId: string;
  /** Unique layer identifier */
  layerId: string;
  /** MapLibre layer type */
  type: LayerType;
  /** GeoJSON data (only needed for first layer using this source) */
  data?: GeoJSON.FeatureCollection | GeoJSON.Feature | GeoJSON.Geometry;
  /** MapLibre paint properties */
  paint?: Record<string, unknown>;
  /** MapLibre layout properties */
  layout?: Record<string, unknown>;
  /** Layer filter expression */
  filter?: unknown[];
  /** Insert layer before this layer ID (for z-ordering) */
  beforeLayerId?: string;
  /** Feature ID property name for feature-state (default: 'id') */
  promoteId?: string;
  /** Minimum zoom level */
  minzoom?: number;
  /** Maximum zoom level */
  maxzoom?: number;
}

export class LayerElement extends MapChildElement {
  static observedAttributes = [
    'source-id',
    'layer-id',
    'type',
    'before-layer-id',
    'promote-id',
    'minzoom',
    'maxzoom',
  ];

  // Properties set via create() or attributes
  private _sourceId?: string;
  private _layerId?: string;
  private _type?: LayerType;
  private _data?: GeoJSON.FeatureCollection | GeoJSON.Feature | GeoJSON.Geometry;
  private _paint?: Record<string, unknown>;
  private _layout?: Record<string, unknown>;
  private _filter?: unknown[];
  private _beforeLayerId?: string;
  private _promoteId?: string;
  private _minzoom?: number;
  private _maxzoom?: number;

  // Track if we created the source (vs reusing existing)
  private _ownSource = false;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  protected applyCreateOptions(options: LayerOptions): void {
    this._sourceId = options.sourceId;
    this._layerId = options.layerId;
    this._type = options.type;
    if (options.data) this._data = options.data;
    if (options.paint) this._paint = options.paint;
    if (options.layout) this._layout = options.layout;
    if (options.filter) this._filter = options.filter;
    if (options.beforeLayerId) this._beforeLayerId = options.beforeLayerId;
    if (options.promoteId) this._promoteId = options.promoteId;
    if (options.minzoom !== undefined) this._minzoom = options.minzoom;
    if (options.maxzoom !== undefined) this._maxzoom = options.maxzoom;
  }

  override async connectedCallback() {
    try {
      // Apply options from create() factory method
      const createOptions = (this as any)._createOptions;
      if (createOptions) {
        this.applyCreateOptions(createOptions);
        (this as any)._createOptions = undefined;
      }

      this.addToParentMap();

      if (!this.isInitialized) {
        await super.connectedCallback();
      }
    } catch (error) {
      console.error('[gk-layer] Error in connectedCallback:', error);
      throw error;
    }
  }

  protected override async onMapReady(): Promise<void> {
    if (!this.map) return;
    this.addLayer();
  }

  // ==========================================================================
  // Getters (property first, then attribute)
  // ==========================================================================

  get sourceId(): string {
    return this._sourceId ?? this.safeGetAttribute('source-id') ?? '';
  }

  get layerId(): string {
    return this._layerId ?? this.safeGetAttribute('layer-id') ?? '';
  }

  get layerType(): LayerType {
    return this._type ?? (this.safeGetAttribute('type') as LayerType) ?? 'circle';
  }

  get beforeLayerId(): string | undefined {
    return this._beforeLayerId ?? this.safeGetAttribute('before-layer-id') ?? undefined;
  }

  get promoteId(): string {
    return this._promoteId ?? this.safeGetAttribute('promote-id') ?? 'id';
  }

  get minzoom(): number | undefined {
    if (this._minzoom !== undefined) return this._minzoom;
    const attr = this.safeGetAttribute('minzoom');
    return attr ? parseFloat(attr) : undefined;
  }

  get maxzoom(): number | undefined {
    if (this._maxzoom !== undefined) return this._maxzoom;
    const attr = this.safeGetAttribute('maxzoom');
    return attr ? parseFloat(attr) : undefined;
  }

  // ==========================================================================
  // Layer Management
  // ==========================================================================

  private addLayer(): void {
    const map = this.map as any;
    if (!map) return;

    const sourceId = this.sourceId;
    const layerId = this.layerId;
    const type = this.layerType;

    if (!sourceId || !layerId) {
      console.warn('[gk-layer] Missing source-id or layer-id');
      return;
    }

    // Remove existing layer if present
    this.removeLayer();

    // Create source if it doesn't exist and we have data
    if (!map.getSource?.(sourceId)) {
      if (this._data) {
        try {
          map.addSource(sourceId, {
            type: 'geojson',
            data: this._data,
            promoteId: this.promoteId,
          });
          this._ownSource = true;
        } catch (error) {
          console.error(`[gk-layer] Failed to add source ${sourceId}:`, error);
          return;
        }
      } else {
        console.warn(`[gk-layer] Source ${sourceId} does not exist and no data provided`);
        return;
      }
    }

    // Build layer config
    const layerConfig: any = {
      id: layerId,
      type,
      source: sourceId,
    };

    if (this._paint) layerConfig.paint = this._paint;
    if (this._layout) layerConfig.layout = this._layout;
    if (this._filter) layerConfig.filter = this._filter;
    if (this.minzoom !== undefined) layerConfig.minzoom = this.minzoom;
    if (this.maxzoom !== undefined) layerConfig.maxzoom = this.maxzoom;

    // Add layer
    try {
      const beforeId = this.findBeforeLayerId();
      if (beforeId) {
        map.addLayer(layerConfig, beforeId);
      } else {
        map.addLayer(layerConfig);
      }
    } catch (error) {
      console.error(`[gk-layer] Failed to add layer ${layerId}:`, error);
    }
  }

  private findBeforeLayerId(): string | undefined {
    const map = this.map as any;
    if (!map || !this._beforeLayerId) return undefined;

    // Check if specified beforeLayerId exists
    if (map.getLayer?.(this._beforeLayerId)) {
      return this._beforeLayerId;
    }

    return undefined;
  }

  private removeLayer(): void {
    const map = this.map as any;
    if (!map) return;

    const layerId = this.layerId;
    const sourceId = this.sourceId;

    // Remove layer
    if (layerId && map.getLayer?.(layerId)) {
      try {
        map.removeLayer(layerId);
      } catch {
        // Ignore
      }
    }

    // Remove source only if we created it and no other layers use it
    if (sourceId && this._ownSource && map.getSource?.(sourceId)) {
      // Check if any other layers use this source
      const style = map.getStyle?.();
      const layers = style?.layers as any[] | undefined;
      const layersUsingSource = layers?.filter((l: any) => l.source === sourceId);

      if (!layersUsingSource?.length) {
        try {
          map.removeSource(sourceId);
        } catch {
          // Ignore
        }
        this._ownSource = false;
      }
    }
  }

  // ==========================================================================
  // Public API
  // ==========================================================================

  /**
   * Update the source data
   */
  setData(data: GeoJSON.FeatureCollection | GeoJSON.Feature | GeoJSON.Geometry): void {
    this._data = data;

    const map = this.map as any;
    if (!map) return;

    const source = map.getSource?.(this.sourceId);
    if (source && typeof source.setData === 'function') {
      source.setData(data);
    }
  }

  /**
   * Update a paint property
   */
  setPaintProperty(name: string, value: unknown): void {
    if (!this._paint) this._paint = {};
    this._paint[name] = value;

    const map = this.map as any;
    if (map?.getLayer?.(this.layerId)) {
      try {
        map.setPaintProperty(this.layerId, name, value);
      } catch (error) {
        console.warn(`[gk-layer] Failed to set paint property ${name}:`, error);
      }
    }
  }

  /**
   * Update a layout property
   */
  setLayoutProperty(name: string, value: unknown): void {
    if (!this._layout) this._layout = {};
    this._layout[name] = value;

    const map = this.map as any;
    if (map?.getLayer?.(this.layerId)) {
      try {
        map.setLayoutProperty(this.layerId, name, value);
      } catch (error) {
        console.warn(`[gk-layer] Failed to set layout property ${name}:`, error);
      }
    }
  }

  /**
   * Update the layer filter
   */
  setFilter(filter: unknown[] | null): void {
    this._filter = filter ?? undefined;

    const map = this.map as any;
    if (map?.getLayer?.(this.layerId)) {
      try {
        map.setFilter(this.layerId, filter);
      } catch (error) {
        console.warn('[gk-layer] Failed to set filter:', error);
      }
    }
  }

  /**
   * Set feature state (for hover/selection effects)
   */
  setFeatureState(featureId: string | number, state: Record<string, unknown>): void {
    const map = this.map as any;
    if (!map) return;

    try {
      map.setFeatureState({ source: this.sourceId, id: featureId }, state);
    } catch (error) {
      console.warn('[gk-layer] Failed to set feature state:', error);
    }
  }

  /**
   * Remove feature state
   */
  removeFeatureState(featureId?: string | number): void {
    const map = this.map as any;
    if (!map) return;

    try {
      if (featureId !== undefined) {
        map.removeFeatureState({ source: this.sourceId, id: featureId });
      } else {
        map.removeFeatureState({ source: this.sourceId });
      }
    } catch {
      // Ignore
    }
  }

  /**
   * Show the layer
   */
  show(): void {
    this.setLayoutProperty('visibility', 'visible');
  }

  /**
   * Hide the layer
   */
  hide(): void {
    this.setLayoutProperty('visibility', 'none');
  }

  /**
   * Check if layer is visible
   */
  isVisible(): boolean {
    const map = this.map as any;
    if (!map?.getLayer?.(this.layerId)) return false;
    const visibility = map.getLayoutProperty?.(this.layerId, 'visibility');
    return visibility !== 'none';
  }

  // ==========================================================================
  // Lifecycle
  // ==========================================================================

  override attributeChangedCallback(
    name: string,
    oldValue: string | null,
    newValue: string | null
  ): void {
    if (this.isInitialized && oldValue !== newValue) {
      // Recreate layer on significant changes
      if (['source-id', 'layer-id', 'type'].includes(name)) {
        this.removeLayer();
        this.addLayer();
      }
    }
  }

  override disconnectedCallback(): void {
    this.removeLayer();
    super.disconnectedCallback();
  }

  // ==========================================================================
  // Factory
  // ==========================================================================

  /**
   * Factory method to create and configure a layer element
   */
  static create(options: LayerOptions): LayerElement {
    const layer = document.createElement('gk-layer') as LayerElement;
    (layer as any)._createOptions = options;
    return layer;
  }
}

// Register the custom element
if (!customElements.get('gk-layer')) {
  customElements.define('gk-layer', LayerElement);
}
