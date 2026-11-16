/**
 * Geokit Point Layer Component
 *
 * Shared point layer with optional glow behind. One source, one point layer, one optional glow layer.
 * Use with explicit setData(geojson) or with child gk-point elements (call syncFromChildren() to build data from them).
 *
 * Layer order: glow behind, point on top (managed inside this element).
 *
 * Events (when interactive): gk-layer-click, gk-layer-mouseenter, gk-layer-mouseleave
 * (same detail shape as gk-layer; layerId/sourceId refer to the point layer/source).
 */

import { MapChildElement } from '../../map-child-element';
import { debug } from '../../../utils/logger';
import { convert, GKPoint, GeoKind, isUsCrosswalkLoaded } from '@doppler-group/geokit/crosswalk';
import { POINT_DMA_PROPERTY, POINT_DMA_REGION_PROPERTY } from '../../../utils/shared-points/point-dma';
import type { MapEvent } from '../../../providers/types';
import {
  createSharedPointLayersFromPaint,
  ensureSharedPointGeoJsonSource,
  tearDownSharedPointLayers,
  updateSharedPointSourceData,
} from '../../../utils/shared-point-sync';
import {
  paintColorFromProperty,
  SHARED_POINT_GLOW_BLUR,
  SHARED_POINT_UNIFORM_GLOW_OPACITY,
} from '../../../utils/shared-point-paint';
import type {
  LayerClickEventDetail,
  LayerMouseEnterEventDetail,
  LayerMouseLeaveEventDetail,
} from '../layer/layer';

export interface PointLayerOptions {
  sourceId: string;
  pointLayerId: string;
  glowLayerId: string;
  promoteId?: string;
  /** Initial or explicit data; can also use setData() or syncFromChildren(). */
  data?: GeoJSON.FeatureCollection | GeoJSON.Feature | GeoJSON.Geometry;
  pointPaint?: Record<string, unknown>;
  /** When set, a glow layer is added behind the point layer. */
  glowPaint?: Record<string, unknown>;
  interactive?: boolean;
  hoverState?: boolean;
  cursor?: string;
  /** Layer IDs to include in hit test (e.g. [glowLayerId] for larger hover area). */
  hitLayers?: string[];
}


function asPaintExpression(value: unknown, fallback: unknown[]): unknown[] {
  if (Array.isArray(value)) return value as unknown[];
  if (typeof value === 'number' || typeof value === 'string') return ['literal', value];
  return fallback;
}

function toFeatureCollection(
  data: GeoJSON.FeatureCollection | GeoJSON.Feature | GeoJSON.Geometry
): GeoJSON.FeatureCollection {
  if (typeof data === 'object' && data !== null && 'features' in data) {
    return data as GeoJSON.FeatureCollection;
  }
  if (typeof data === 'object' && data !== null && 'type' in data && (data as GeoJSON.Feature).geometry) {
    return { type: 'FeatureCollection', features: [data as GeoJSON.Feature] };
  }
  return {
    type: 'FeatureCollection',
    features: [{ type: 'Feature', properties: {}, geometry: data as GeoJSON.Geometry }],
  };
}

function sanitizePaint(o: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(o)) {
    if (v != null) out[k] = v;
  }
  return out;
}

export class PointLayerElement extends MapChildElement {
  static get tagName(): string {
    return 'gk-point-layer';
  }

  private _sourceId?: string;
  private _pointLayerId?: string;
  private _glowLayerId?: string;
  private _promoteId = 'id';
  private _data?: GeoJSON.FeatureCollection | GeoJSON.Feature | GeoJSON.Geometry;
  private _pointPaint?: Record<string, unknown>;
  private _glowPaint?: Record<string, unknown>;
  private _interactive = true;
  private _hoverState = true;
  private _cursor = 'pointer';
  private _hitLayers?: string[];
  private _ownSource = false;

  private _clickHandler: ((e: MapEvent) => void) | null = null;
  private _mouseMoveHandler: ((e: MapEvent) => void) | null = null;
  private _mouseLeaveHandler: (() => void) | null = null;
  private _hoveredFeatureId: string | number | null = null;
  private _currentHoveredFeatureId: string | number | null = null;
  private _unloadHandler: (() => void) | null = null;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  protected applyCreateOptions(options: PointLayerOptions): void {
    this._sourceId = options.sourceId;
    this._pointLayerId = options.pointLayerId;
    this._glowLayerId = options.glowLayerId;
    if (options.promoteId) this._promoteId = options.promoteId;
    if (options.data) this._data = options.data;
    if (options.pointPaint) this._pointPaint = options.pointPaint;
    if (options.glowPaint) this._glowPaint = options.glowPaint;
    if (options.interactive !== undefined) this._interactive = options.interactive;
    if (options.hoverState !== undefined) this._hoverState = options.hoverState;
    if (options.cursor) this._cursor = options.cursor;
    if (options.hitLayers) this._hitLayers = options.hitLayers;
  }

  private _childrenSyncHandler = (): void => {
    this.syncFromChildren();
  };

  override async connectedCallback(): Promise<void> {
    const createOptions = (this as any)._createOptions;
    if (createOptions) {
      this.applyCreateOptions(createOptions);
      (this as any)._createOptions = undefined;
    }
    this.addToParentMap();
    this.addEventListener('gk-point-data-changed', this._childrenSyncHandler);
    if (!this.isInitialized) {
      await super.connectedCallback();
    }
  }

  override disconnectedCallback(): void {
    this.removeEventListener('gk-point-data-changed', this._childrenSyncHandler);
    this.removeLayers();
    super.disconnectedCallback();
  }

  protected override async onMapReady(): Promise<void> {
    if (!this.map) return;
    void this.addLayers();
  }

  protected override onStyleLoad(): void {
    if (!this.map) return;
    debug.log('[PointLayer] onStyleLoad', {
      sourceId: this.sourceId,
      pointLayerId: this.pointLayerId,
    });
    if (
      this.sourceId &&
      this.pointLayerId &&
      this.map.getSource?.(this.sourceId) &&
      this.map.getLayer?.(this.pointLayerId)
    ) {
      return;
    }
    void this.addLayers();
  }

  private get sourceId(): string {
    return this._sourceId ?? this.safeGetAttribute('source-id') ?? '';
  }

  private get pointLayerId(): string {
    return this._pointLayerId ?? this.safeGetAttribute('point-layer-id') ?? '';
  }

  private get glowLayerId(): string {
    return this._glowLayerId ?? this.safeGetAttribute('glow-layer-id') ?? '';
  }

  private get promoteId(): string {
    return this._promoteId ?? this.safeGetAttribute('promote-id') ?? 'id';
  }

  private get queryLayers(): string[] {
    const layers = [this.pointLayerId];
    if (this._hitLayers?.length) layers.push(...this._hitLayers);
    return layers.filter(Boolean);
  }

  private async addLayers(): Promise<void> {
    const map = this.map as any;
    if (!map) return;

    const sourceId = this.sourceId;
    const pointLayerId = this.pointLayerId;
    const glowLayerId = this.glowLayerId;
    if (!sourceId || !pointLayerId) {
      debug.log('[PointLayer] addLayers skipped: missing sourceId or pointLayerId', {
        sourceId,
        pointLayerId,
      });
      return;
    }

    const createOptions = (this as any)._createOptions;
    if (createOptions) {
      this.applyCreateOptions(createOptions);
      (this as any)._createOptions = undefined;
    }

    this.removeLayers();

    const data = this._data ?? { type: 'FeatureCollection' as const, features: [] };
    const featureCollection = toFeatureCollection(data);
    const featureCount = featureCollection.features?.length ?? 0;
    debug.log('[PointLayer] addLayers', { sourceId, pointLayerId, glowLayerId, featureCount });

    const pointPaint = this._pointPaint
      ? sanitizePaint(this._pointPaint as Record<string, unknown>)
      : { 'circle-radius': 6, 'circle-color': '#333', 'circle-opacity': 1 };
    const glowPaint = this._glowPaint
      ? sanitizePaint(this._glowPaint as Record<string, unknown>)
      : undefined;

    if (!map.getSource?.(sourceId)) {
      ensureSharedPointGeoJsonSource(map, sourceId, featureCollection, this.promoteId);
      this._ownSource = true;
      debug.log('[PointLayer] source ADD', { sourceId });
    } else if (this._data) {
      await updateSharedPointSourceData(map, sourceId, featureCollection);
      debug.log('[PointLayer] source setData (existing source)', { sourceId, featureCount });
    }

    const resolvedGlowLayerId = glowLayerId || `${pointLayerId}-glow`;
    const mapProvider = this.closest('gk-map')?.getAttribute?.('provider') ?? null;

    await createSharedPointLayersFromPaint({
      map,
      ids: { sourceId, glowLayerId: resolvedGlowLayerId, pointLayerId },
      geojson: featureCollection,
      paint: {
        ids: { sourceId, glowLayerId: resolvedGlowLayerId, pointLayerId },
        pointColorExpression: asPaintExpression(pointPaint['circle-color'], ['literal', '#333']),
        pointRadiusExpression: asPaintExpression(pointPaint['circle-radius'], ['literal', 6]),
        glowColorExpression: glowPaint?.['circle-color']
          ? asPaintExpression(glowPaint['circle-color'], paintColorFromProperty())
          : paintColorFromProperty(),
        glowOpacity:
          typeof glowPaint?.['circle-opacity'] === 'number'
            ? (glowPaint['circle-opacity'] as number)
            : SHARED_POINT_UNIFORM_GLOW_OPACITY,
      },
      mapProvider,
      useMapTilerPointHelper: mapProvider === 'maptiler',
      useFeatureStateHover: this._hoverState,
      layerSetWaitMs: 0,
      glowBlur:
        typeof glowPaint?.['circle-blur'] === 'number'
          ? (glowPaint['circle-blur'] as number)
          : SHARED_POINT_GLOW_BLUR,
    });

    if (!this._hitLayers?.length) {
      this._hitLayers = [resolvedGlowLayerId, pointLayerId];
    }

    if (this._interactive) this.setupInteractions();

    if (
      !this._data ||
      (typeof this._data === 'object' &&
        'features' in this._data &&
        (this._data as GeoJSON.FeatureCollection).features?.length === 0)
    ) {
      const points = this.querySelectorAll?.('gk-point');
      if (points?.length) this.syncFromChildren();
    }
  }

  private removeLayers(): void {
    this.removeInteractions();
    const map = this.map as any;
    if (!map) return;

    const sourceId = this.sourceId;
    const pointLayerId = this.pointLayerId;
    const glowLayerId = this.glowLayerId || (pointLayerId ? `${pointLayerId}-glow` : '');
    if (sourceId && pointLayerId && glowLayerId) {
      tearDownSharedPointLayers(map, { sourceId, glowLayerId, pointLayerId });
    }
    this._ownSource = false;
  }

  private setupInteractions(): void {
    const map = this.map as any;
    if (!map) return;

    const layerId = this.pointLayerId;
    const sourceId = this.sourceId;
    const queryLayers = this.queryLayers;

    const queryFeaturesAtPoint = (point: { x: number; y: number }): any[] => {
      try {
        return map.queryRenderedFeatures(point, { layers: queryLayers }) || [];
      } catch {
        return [];
      }
    };

    this._clickHandler = (e: MapEvent) => {
      if (!e.point) return;
      const features = queryFeaturesAtPoint(e.point);
      if (features.length === 0) return;
      const feature = features[0];
      const lngLat = e.lngLat ?? { lng: 0, lat: 0 };
      const featureId = feature.id as string | number | undefined;
      const geoJsonFeature: GeoJSON.Feature = {
        type: 'Feature',
        geometry: feature.geometry as GeoJSON.Geometry,
        properties: (feature.properties as Record<string, unknown>) || {},
        ...(featureId !== undefined && { id: featureId }),
      };
      const detail: LayerClickEventDetail = {
        feature: geoJsonFeature,
        lngLat: { lng: lngLat.lng, lat: lngLat.lat },
        layerId,
        sourceId,
        originalEvent: e.originalEvent as MouseEvent | TouchEvent,
      };
      this.dispatchEvent(
        new CustomEvent('gk-layer-click', { detail, bubbles: true, cancelable: true })
      );
    };

    this._mouseMoveHandler = (e: MapEvent) => {
      if (!e.point) return;
      const features = queryFeaturesAtPoint(e.point);
      const featureId =
        features.length > 0 ? (features[0].id as string | number | undefined) : undefined;
      if (featureId === this._currentHoveredFeatureId) return;
      const container = map.getCanvas?.();

      if (this._currentHoveredFeatureId !== null && featureId !== this._currentHoveredFeatureId) {
        if (container) container.style.cursor = '';
        if (this._hoverState && this._hoveredFeatureId !== null) {
          try {
            map.setFeatureState({ source: sourceId, id: this._hoveredFeatureId }, { hover: false });
          } catch {
            // ignore
          }
          this._hoveredFeatureId = null;
        }
        this.dispatchEvent(
          new CustomEvent('gk-layer-mouseleave', {
            detail: { layerId, sourceId } as LayerMouseLeaveEventDetail,
            bubbles: true,
          })
        );
      }

      if (featureId !== undefined && features.length > 0) {
        const feature = features[0];
        const lngLat = e.lngLat ?? { lng: 0, lat: 0 };
        if (container) container.style.cursor = this._cursor;
        if (this._hoverState) {
          this._hoveredFeatureId = featureId;
          try {
            map.setFeatureState({ source: sourceId, id: featureId }, { hover: true });
          } catch {
            // ignore
          }
        }
        const geoJsonFeature: GeoJSON.Feature = {
          type: 'Feature',
          geometry: feature.geometry as GeoJSON.Geometry,
          properties: (feature.properties as Record<string, unknown>) || {},
          ...(featureId !== undefined && { id: featureId }),
        };
        this.dispatchEvent(
          new CustomEvent('gk-layer-mouseenter', {
            detail: {
              feature: geoJsonFeature,
              lngLat: { lng: lngLat.lng, lat: lngLat.lat },
              layerId,
              sourceId,
            } as LayerMouseEnterEventDetail,
            bubbles: true,
          })
        );
      }
      this._currentHoveredFeatureId = featureId ?? null;
    };

    this._mouseLeaveHandler = () => {
      if (this._currentHoveredFeatureId === null) return;
      const container = map.getCanvas?.();
      if (container) container.style.cursor = '';
      if (this._hoverState && this._hoveredFeatureId !== null) {
        try {
          map.setFeatureState({ source: sourceId, id: this._hoveredFeatureId }, { hover: false });
        } catch {
          // ignore
        }
        this._hoveredFeatureId = null;
      }
      this.dispatchEvent(
        new CustomEvent('gk-layer-mouseleave', {
          detail: { layerId, sourceId } as LayerMouseLeaveEventDetail,
          bubbles: true,
        })
      );
      this._currentHoveredFeatureId = null;
    };

    map.on('click', this._clickHandler);
    map.on('mousemove', this._mouseMoveHandler);
    map.on('mouseleave', this._mouseLeaveHandler);
    this._unloadHandler = () => this.removeInteractions();
    this.addEventListener('gk-map-unload', this._unloadHandler);
  }

  private removeInteractions(): void {
    if (this._unloadHandler) {
      this.removeEventListener('gk-map-unload', this._unloadHandler);
      this._unloadHandler = null;
    }
    const map = this.map as any;
    if (!map?.off) return;
    if (this._clickHandler) {
      try {
        map.off('click', this._clickHandler);
      } catch {
        // ignore
      }
      this._clickHandler = null;
    }
    if (this._mouseMoveHandler) {
      try {
        map.off('mousemove', this._mouseMoveHandler);
      } catch {
        // ignore
      }
      this._mouseMoveHandler = null;
    }
    if (this._mouseLeaveHandler) {
      try {
        map.off('mouseleave', this._mouseLeaveHandler);
      } catch {
        // ignore
      }
      this._mouseLeaveHandler = null;
    }
    if (this._hoveredFeatureId !== null) {
      try {
        map.setFeatureState(
          { source: this.sourceId, id: this._hoveredFeatureId },
          { hover: false }
        );
      } catch {
        // ignore
      }
      this._hoveredFeatureId = null;
    }
    this._currentHoveredFeatureId = null;
  }

  setData(data: GeoJSON.FeatureCollection | GeoJSON.Feature | GeoJSON.Geometry): void {
    this._data = data;
    const featureCount =
      typeof data === 'object' && data !== null && 'features' in data
        ? ((data as GeoJSON.FeatureCollection).features?.length ?? 0)
        : 1;
    debug.log('[PointLayer] setData', { sourceId: this.sourceId, featureCount });
    const map = this.map as any;
    if (!map) return;
    const source = map.getSource?.(this.sourceId);
    if (source && typeof (source as any).setData === 'function') {
      (source as any).setData(data);
    }
  }

  setPointPaintProperty(name: string, value: unknown): void {
    if (!this._pointPaint) this._pointPaint = {};
    this._pointPaint[name] = value;
    const map = this.map as any;
    if (map?.getLayer?.(this.pointLayerId)) {
      try {
        map.setPaintProperty(this.pointLayerId, name, value);
      } catch (error) {
        console.warn(`[gk-point-layer] Failed to set point paint ${name}:`, error);
      }
    }
  }

  setGlowPaintProperty(name: string, value: unknown): void {
    if (!this._glowPaint) this._glowPaint = {};
    this._glowPaint[name] = value;
    const map = this.map as any;
    if (map?.getLayer?.(this.glowLayerId)) {
      try {
        map.setPaintProperty(this.glowLayerId, name, value);
      } catch (error) {
        console.warn(`[gk-point-layer] Failed to set glow paint ${name}:`, error);
      }
    }
  }

  /**
   * Build GeoJSON from child gk-point elements and set as source data.
   * Call after adding/removing/updating gk-point children.
   */
  syncFromChildren(): void {
    const points = Array.from(this.querySelectorAll?.('gk-point') ?? []) as any[];
    const features: GeoJSON.Feature[] = [];
    const enrichDma = this.hasAttribute('enrich-dma');
    for (const el of points) {
      if (typeof el.getFeatureData === 'function') {
        const f = el.getFeatureData();
        if (!f) continue;
        if (enrichDma && f.geometry?.type === 'Point') {
          const coords = f.geometry.coordinates;
          if (Array.isArray(coords) && coords.length >= 2) {
            const lng = Number(coords[0]);
            const lat = Number(coords[1]);
            if (!Number.isNaN(lng) && !Number.isNaN(lat)) {
              let properties = f.properties ?? {};
              if (isUsCrosswalkLoaded()) {
                const dma = convert(GKPoint(lat, lng), GeoKind.DMA);
                if (dma) {
                  properties = {
                    ...properties,
                    [POINT_DMA_PROPERTY]: dma.slug,
                    ...(dma.region ? { [POINT_DMA_REGION_PROPERTY]: dma.region } : {}),
                  };
                }
              }
              f.properties = properties;
            }
          }
        }
        features.push(f);
      }
    }
    debug.log('[PointLayer] syncFromChildren', {
      childCount: points.length,
      featureCount: features.length,
    });
    this.setData({ type: 'FeatureCollection', features });
  }

  static create(options: PointLayerOptions): PointLayerElement {
    const el = document.createElement('gk-point-layer') as PointLayerElement;
    (el as any)._createOptions = options;
    return el;
  }
}

if (!customElements.get('gk-point-layer')) {
  customElements.define('gk-point-layer', PointLayerElement);
}
