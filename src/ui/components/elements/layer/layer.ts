/**
 * Geokit Layer Component
 *
 * Generic MapLibre layer component for rendering GeoJSON features.
 * Supports all layer types (circle, fill, line, symbol, etc.) with
 * data-driven styling via paint/layout expressions.
 *
 * Multiple gk-layer elements can share the same source-id for efficiency.
 *
 * Interactive features:
 * - Set `interactive` to enable click/hover events
 * - Set `hover-state` to auto-manage feature-state for hover effects
 * - Set `cursor` to change cursor on hover (default: 'pointer' when interactive)
 *
 * Events emitted when interactive:
 * - `gk-layer-click`: { feature, lngLat, layerId, sourceId, originalEvent }
 * - `gk-layer-mouseenter`: { feature, lngLat, layerId, sourceId }
 * - `gk-layer-mouseleave`: { layerId, sourceId }
 *
 * Usage:
 * <gk-layer
 *   source-id="points"
 *   layer-id="site-points"
 *   type="circle"
 *   interactive
 *   hover-state
 *   :data="geojson"
 *   :paint="{ 'circle-color': ['get', 'color'], 'circle-radius': 6 }"
 * />
 *
 * Dataset mode (app registers mounts at bootstrap):
 * <gk-layer dataset="my-layer" mode="viewport" interactive />
 *
 * Vue / `:dataset` bindings conflict with HTMLElement.dataset — use layer-dataset instead:
 * <gk-layer layer-dataset="my-layer" mode="viewport" interactive />
 *
 * Auth headers: set getRequestInit on the element in JS (not in markup).
 */

import { MapChildElement } from '../../map-child-element';
import { findBeforeLayerId as findBeforeLayerIdFn } from './layer-order';
import { setupLayerInteractions, type LayerInteractionsState } from './layer-interactions';
export type {
  LayerClickEventDetail,
  LayerMouseEnterEventDetail,
  LayerMouseLeaveEventDetail,
} from './layer-interactions';
import {
  collectPassthroughDatasetAttrs,
  isPassthroughDatasetAttr,
} from './layer-dataset-attrs.js';
import {
  mountLayerDataset,
  normalizeLayerDatasetId,
  parseLayerDatasetSlugs,
  unmountLayerDataset,
  type LayerDatasetHandle,
  type LayerDatasetId,
  type LayerDatasetOptions,
  type LayerDatasetReadyDetail,
} from './layer-datasets';
import {
  datasetFillLayerId,
  stackGkOutlineLayersAboveDatasetFill,
} from '../../../utils/layer-stack';

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
  /** Enable click/hover events (emits gk-layer-click, gk-layer-mouseenter, gk-layer-mouseleave) */
  interactive?: boolean;
  /** Auto-manage feature-state for hover effects (requires promoteId to work) */
  hoverState?: boolean;
  /** Cursor to show on hover when interactive (default: 'pointer') */
  cursor?: string;
  /** Additional layers to include when querying features on click (for hit areas) */
  hitLayers?: string[];
}

/** Event detail for gk-layer-ready (dataset mode) */
export type LayerReadyEventDetail = LayerDatasetReadyDetail;

export class LayerElement extends MapChildElement {
  static observedAttributes = [
    'source-id',
    'layer-id',
    'type',
    'before-layer-id',
    'promote-id',
    'minzoom',
    'maxzoom',
    'interactive',
    'hover-state',
    'cursor',
    'dataset',
    'layer-dataset',
    'line-color',
    'line-width',
    'mode',
    'slugs',
    'highlight-slug',
    'fill-opacity',
    'fill-color',
    'color-mode',
    'outline-color',
  ];

  getRequestInit?: () => RequestInit;

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
  private _interactive?: boolean;
  private _hoverState?: boolean;
  private _cursor?: string;
  private _hitLayers?: string[];
  private _datasetHandle: LayerDatasetHandle | null = null;
  private _datasetMountGeneration = 0;
  private _deferredZoomUnsub: (() => void) | null = null;

  // Track if we created the source (vs reusing existing)
  private _ownSource = false;

  // Interaction state (shared with layer-interactions)
  private _interactionState: LayerInteractionsState = {
    currentHoveredFeatureId: null,
    hoveredFeatureId: null,
  };
  private _removeInteractions: (() => void) | null = null;

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
    if (options.interactive !== undefined) this._interactive = options.interactive;
    if (options.hoverState !== undefined) this._hoverState = options.hoverState;
    if (options.cursor) this._cursor = options.cursor;
    if (options.hitLayers) this._hitLayers = options.hitLayers;
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
    if (this.datasetId) {
      await this.scheduleDatasetMount();
    } else {
      this.addLayer();
    }
  }

  /** Re-add layer after map style change (e.g. theme toggle). */
  protected override onStyleLoad(): void {
    if (!this.map) return;
    if (this.datasetId) {
      void this.scheduleDatasetMount();
    } else {
      this.addLayer();
    }
  }

  private mapZoom(): number {
    const map = this.map as { getZoom?: () => number } | null | undefined;
    return map?.getZoom?.() ?? 0;
  }

  private clearDeferredZoomMount(): void {
    this._deferredZoomUnsub?.();
    this._deferredZoomUnsub = null;
  }

  private async scheduleDatasetMount(): Promise<void> {
    this.clearDeferredZoomMount();
    const min = this.minzoom;
    if (min != null && this.mapZoom() < min) {
      const map = this.map as {
        on?: (event: string, handler: () => void) => void;
        off?: (event: string, handler: () => void) => void;
      } | null;
      const tryMount = (): void => {
        if (this.mapZoom() >= min) {
          this.clearDeferredZoomMount();
          void this.mountDatasetLayer();
        }
      };
      map?.on?.('zoomend', tryMount);
      map?.on?.('moveend', tryMount);
      this._deferredZoomUnsub = () => {
        map?.off?.('zoomend', tryMount);
        map?.off?.('moveend', tryMount);
      };
      return;
    }
    await this.mountDatasetLayer();
  }

  // ==========================================================================
  // Getters (property first, then attribute)
  // ==========================================================================

  get datasetId(): LayerDatasetId | null {
    const raw = this.safeGetAttribute('layer-dataset') ?? this.safeGetAttribute('dataset');
    return normalizeLayerDatasetId(raw);
  }

  get sourceId(): string {
    if (this._datasetHandle) return this._datasetHandle.sourceId;
    return this._sourceId ?? this.safeGetAttribute('source-id') ?? '';
  }

  get layerId(): string {
    if (this._datasetHandle) return this._datasetHandle.layerId;
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

  set minzoom(value: number | string | null | undefined) {
    if (value == null || value === '') {
      this._minzoom = undefined;
      return;
    }
    const parsed = typeof value === 'number' ? value : parseFloat(String(value));
    this._minzoom = Number.isFinite(parsed) ? parsed : undefined;
  }

  get maxzoom(): number | undefined {
    if (this._maxzoom !== undefined) return this._maxzoom;
    const attr = this.safeGetAttribute('maxzoom');
    return attr ? parseFloat(attr) : undefined;
  }

  set maxzoom(value: number | string | null | undefined) {
    if (value == null || value === '') {
      this._maxzoom = undefined;
      return;
    }
    const parsed = typeof value === 'number' ? value : parseFloat(String(value));
    this._maxzoom = Number.isFinite(parsed) ? parsed : undefined;
  }

  get interactive(): boolean {
    if (this._interactive !== undefined) return this._interactive;
    const attr = this.safeGetAttribute('interactive');
    return attr !== null && attr !== 'false';
  }

  set interactive(value: boolean | string | null | undefined) {
    if (value == null || value === false || value === 'false') {
      this._interactive = false;
      return;
    }
    this._interactive =
      value === true || value === '' || value === 'true' || value === 'interactive';
  }

  get hoverState(): boolean {
    if (this._hoverState !== undefined) return this._hoverState;
    const attr = this.safeGetAttribute('hover-state');
    return attr !== null && attr !== 'false';
  }

  get cursor(): string {
    return this._cursor ?? this.safeGetAttribute('cursor') ?? 'pointer';
  }

  /** Get layers to query for features (includes hit layers if specified) */
  private get queryLayers(): string[] {
    const layers = [this.layerId];
    if (this._datasetHandle?.hitLayerIds?.length) {
      layers.push(...this._datasetHandle.hitLayerIds);
    } else if (this._hitLayers) {
      layers.push(...this._hitLayers);
    }
    return layers.filter(Boolean);
  }

  private buildDatasetOptions(): LayerDatasetOptions {
    const lineWidthRaw = this.safeGetAttribute('line-width');
    let lineWidth: number | unknown[] | undefined;
    if (lineWidthRaw) {
      try {
        lineWidth = JSON.parse(lineWidthRaw) as unknown[];
      } catch {
        const parsed = parseFloat(lineWidthRaw);
        if (Number.isFinite(parsed)) lineWidth = parsed;
      }
    }

    const fillOpacityRaw = this.safeGetAttribute('fill-opacity');
    const fillOpacity = fillOpacityRaw ? parseFloat(fillOpacityRaw) : undefined;

    const modeRaw = this.safeGetAttribute('mode');
    const mode = modeRaw === 'slugs' || modeRaw === 'viewport' ? modeRaw : undefined;

    const passthroughAttrs = collectPassthroughDatasetAttrs(this);

    return {
      baseUrl:
        this.safeGetAttribute('base-url') ?? undefined,
      lineColor: this.safeGetAttribute('line-color') ?? undefined,
      lineWidth,
      beforeLayerId: this.beforeLayerId,
      minzoom: this.minzoom,
      interactive: this.interactive,
      mode,
      slugs: parseLayerDatasetSlugs(this.safeGetAttribute('slugs')),
      highlightSlug: this.safeGetAttribute('highlight-slug') ?? undefined,
      fillOpacity: Number.isFinite(fillOpacity) ? fillOpacity : undefined,
      fillColor: this.safeGetAttribute('fill-color') ?? undefined,
      outlineColor: this.safeGetAttribute('outline-color') ?? undefined,
      attrs: Object.keys(passthroughAttrs).length > 0 ? passthroughAttrs : undefined,
    };
  }

  private dispatchDatasetReady(detail: LayerDatasetReadyDetail): void {
    this.dispatchEvent(new CustomEvent('gk-layer-ready', { detail, bubbles: true }));
  }

  /** Re-fetch and redraw registered dataset layers. */
  async reloadDataset(): Promise<void> {
    if (!this.datasetId || !this.map) return;
    await this.mountDatasetLayer();
  }

  private async mountDatasetLayer(): Promise<void> {
    const dataset = this.datasetId;
    if (!dataset || !this.map) return;

    const generation = ++this._datasetMountGeneration;
    this.removeDatasetLayer();

    const options = this.buildDatasetOptions();
    const handle = await mountLayerDataset({
      map: this.map as unknown as Parameters<typeof mountLayerDataset>[0]['map'],
      element: this,
      dataset,
      options,
      getRequestInit: this.getRequestInit,
    });

    if (generation !== this._datasetMountGeneration) {
      // Stale mount — do not call handle.cleanup(); layer ids are shared and a
      // newer mount may already own gk-dataset-* on the map.
      return;
    }

    if (!handle) {
      console.warn(`[gk-layer] dataset "${dataset}" mount returned no layers`);
      return;
    }

    this._datasetHandle = handle;
    this._hitLayers = handle.hitLayerIds;

    stackGkOutlineLayersAboveDatasetFill(
      this.map as Parameters<typeof stackGkOutlineLayersAboveDatasetFill>[0],
      datasetFillLayerId(dataset)
    );

    if (this.interactive) {
      this.setupInteractions();
    }

    this.dispatchDatasetReady({
      dataset,
      sourceId: handle.sourceId,
      layerId: handle.layerId,
    });
  }

  private removeDatasetLayer(): void {
    this.clearDeferredZoomMount();
    this.removeInteractions();
    unmountLayerDataset(this._datasetHandle);
    this._datasetHandle = null;
    this._hitLayers = undefined;
  }

  private applyDatasetOptionPatch(name: string): void {
    if (!this._datasetHandle?.update) return;
    const patch: Partial<LayerDatasetOptions> = {};

    if (name === 'highlight-slug') {
      patch.highlightSlug = this.safeGetAttribute('highlight-slug');
    } else if (name === 'fill-opacity') {
      const raw = this.safeGetAttribute('fill-opacity');
      const parsed = raw ? parseFloat(raw) : undefined;
      if (Number.isFinite(parsed)) patch.fillOpacity = parsed;
    } else if (name === 'line-color') {
      void this.mountDatasetLayer();
      return;
    }

    if (Object.keys(patch).length > 0) {
      this._datasetHandle.update(patch);
    }
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

    // Build layer config (omit null/undefined so MapTiler coalesceChanges does not throw)
    const layerConfig: Record<string, unknown> = {
      id: layerId,
      type,
      source: sourceId,
    };

    if (this._paint != null && typeof this._paint === 'object') {
      layerConfig.paint = this._sanitizeLayoutOrPaint(this._paint as Record<string, unknown>);
    }
    if (this._layout != null && typeof this._layout === 'object') {
      layerConfig.layout = this._sanitizeLayoutOrPaint(this._layout as Record<string, unknown>);
    }
    if (this._filter != null) layerConfig.filter = this._filter;
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

      // Setup interactions if enabled
      if (this.interactive) {
        this.setupInteractions();
      }
    } catch (error) {
      console.error(`[gk-layer] Failed to add layer ${layerId}:`, error);
    }
  }

  /**
   * Strip null/undefined from layout or paint so MapTiler coalesceChanges does not throw.
   */
  private _sanitizeLayoutOrPaint(o: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(o)) {
      if (v != null) out[k] = v;
    }
    return out;
  }

  private findBeforeLayerId(): string | undefined {
    return findBeforeLayerIdFn(this.map as any, {
      beforeLayerId: this._beforeLayerId,
      layerType: this.layerType,
    });
  }

  private removeLayer(): void {
    const map = this.map as any;
    if (!map) return;

    // Remove interactions first
    this.removeInteractions();

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
      // Clear feature state for this source before remove (avoids MapLibre coalesceChanges
      // seeing stale state when source is removed).
      if (this._interactionState.hoveredFeatureId != null && map.removeFeatureState) {
        try {
          map.removeFeatureState({
            source: sourceId,
            id: this._interactionState.hoveredFeatureId,
          });
        } catch {
          // Ignore
        }
        this._interactionState.hoveredFeatureId = null;
      }

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
  // Interactions
  // ==========================================================================

  private setupInteractions(): void {
    const map = this.map as any;
    if (!map) return;
    this._removeInteractions?.();
    this._removeInteractions = setupLayerInteractions({
      map,
      layerId: this.layerId,
      sourceId: this.sourceId,
      queryLayers: this.queryLayers,
      hoverState: this.hoverState,
      cursor: this.cursor,
      state: this._interactionState,
      dispatchClick: (detail) =>
        this.dispatchEvent(
          new CustomEvent('gk-layer-click', { detail, bubbles: true, cancelable: true })
        ),
      dispatchMouseEnter: (detail) =>
        this.dispatchEvent(new CustomEvent('gk-layer-mouseenter', { detail, bubbles: true })),
      dispatchMouseLeave: (detail) =>
        this.dispatchEvent(new CustomEvent('gk-layer-mouseleave', { detail, bubbles: true })),
      element: this,
    });
  }

  private removeInteractions(): void {
    this._removeInteractions?.();
    this._removeInteractions = null;
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
    if (!this.isInitialized || oldValue === newValue) return;

    if (this.datasetId) {
      const remountAttrs = [
        'dataset',
        'layer-dataset',
                'mode',
        'line-width',
        'minzoom',
        'slugs',
      ];
      const patchAttrs = [
        'highlight-slug',
        'fill-opacity',
        'fill-color',
        'color-mode',
        'outline-color',
        'line-color',
      ];
      if (remountAttrs.includes(name) || isPassthroughDatasetAttr(name)) {
        void this.mountDatasetLayer();
      } else if (patchAttrs.includes(name)) {
        this.applyDatasetOptionPatch(name);
      }
      return;
    }

    if (['source-id', 'layer-id', 'type'].includes(name)) {
      this.removeLayer();
      this.addLayer();
    }
  }

  override disconnectedCallback(): void {
    this.clearDeferredZoomMount();
    if (this.datasetId) {
      this.removeDatasetLayer();
    } else {
      this.removeLayer();
    }
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
