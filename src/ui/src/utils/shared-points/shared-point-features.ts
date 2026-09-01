/**
 * Cached GeoJSON point feature builders for shared point layers.
 */

import type { Feature, FeatureCollection, Point } from 'geojson';

import { convert, GKPoint, GeoKind, isUsCrosswalkLoaded } from '@geokit/crosswalk';

import {
  POINT_DMA_PROPERTY,
  POINT_DMA_REGION_PROPERTY,
  type EnrichPointWithDmaOptions,
} from './point-dma';

export interface PointGeometry {
  type: 'Point';
  coordinates: [number, number];
}

export type CachedPointFeature = Feature<Point, Record<string, unknown>>;

export interface BuildCachedPointFeaturesOptions<T> {
  items: T[];
  getFeatureId: (item: T) => string | undefined;
  getGeometry: (item: T) => PointGeometry | null;
  getProperties: (item: T) => Record<string, unknown>;
  /** When true, reuse the cached feature object for this item. */
  isCacheValid?: (
    cached: CachedPointFeature,
    item: T,
    properties: Record<string, unknown>
  ) => boolean;
  /** Called when reusing a cached feature (e.g. refresh a normalized property). */
  onCacheHit?: (cached: CachedPointFeature, item: T) => void;
  /** Add Nielsen DMA + macro-region from coordinates when crosswalk is loaded. */
  enrichWithDma?: boolean | EnrichPointWithDmaOptions;
  /** Post-process properties after DMA enrichment (e.g. derive paint color). */
  finalizeProperties?: (
    item: T,
    properties: Record<string, unknown>,
    geometry: PointGeometry
  ) => Record<string, unknown>;
}

export interface CachedPointFeatureBuilderOptions {
  maxCacheSize?: number;
}

/**
 * Normalize Point geometry coordinates to [lng, lat] numbers.
 */
export function normalizePointCoordinates(
  feature: { geometry?: unknown } | null | undefined
): PointGeometry | null {
  const g = feature?.geometry as { type?: string; coordinates?: unknown } | undefined;
  if (!g || g.type !== 'Point') return null;
  const c = g.coordinates;
  if (!Array.isArray(c) || c.length < 2) return null;
  const lng = Number(c[0]);
  const lat = Number(c[1]);
  if (Number.isNaN(lng) || Number.isNaN(lat)) return null;
  return { type: 'Point', coordinates: [lng, lat] };
}

/**
 * Build a FeatureCollection while reusing cached feature objects keyed by id.
 * Reduces GC pressure when updating large point sets frequently.
 */
export class CachedPointFeatureBuilder {
  private readonly cache = new Map<string, CachedPointFeature>();
  private readonly maxCacheSize: number;

  constructor(options: CachedPointFeatureBuilderOptions = {}) {
    this.maxCacheSize = options.maxCacheSize ?? 4000;
  }

  build<T>(options: BuildCachedPointFeaturesOptions<T>): FeatureCollection<Point> {
    const {
      items,
      getFeatureId,
      getGeometry,
      getProperties,
      isCacheValid,
      onCacheHit,
      enrichWithDma,
      finalizeProperties,
    } = options;
    const features: CachedPointFeature[] = [];
    const seenIds = new Set<string>();

    for (const item of items) {
      const id = getFeatureId(item);
      if (!id) continue;
      seenIds.add(id);

      let properties = getProperties(item);
      const geometry = getGeometry(item);
      if (!geometry) continue;

      if (enrichWithDma) {
        const [lng, lat] = geometry.coordinates;
        const dmaOpts = enrichWithDma === true ? undefined : enrichWithDma;
        if (isUsCrosswalkLoaded()) {
          const dma = convert(GKPoint(lat, lng), GeoKind.DMA);
          if (dma) {
            const dmaKey = dmaOpts?.dmaKey ?? POINT_DMA_PROPERTY;
            const regionKey = dmaOpts?.regionKey ?? POINT_DMA_REGION_PROPERTY;
            properties = {
              ...properties,
              [dmaKey]: dma.slug,
              ...(dma.region ? { [regionKey]: dma.region } : {}),
            };
          }
        }
      }

      if (finalizeProperties) {
        properties = finalizeProperties(item, properties, geometry);
      }

      const cached = this.cache.get(id);
      if (cached && isCacheValid?.(cached, item, properties)) {
        onCacheHit?.(cached, item);
        features.push(cached);
        continue;
      }

      const feature: CachedPointFeature = {
        type: 'Feature',
        geometry,
        properties: { ...properties },
      };
      this.cache.set(id, feature);
      features.push(feature);
    }

    this.pruneCache(seenIds);
    return { type: 'FeatureCollection', features };
  }

  getCached(featureId: string): CachedPointFeature | undefined {
    return this.cache.get(featureId);
  }

  /** Set a property on a cached feature; pass null to delete the key. */
  updateCachedProperty(featureId: string, key: string, value: unknown | null): void {
    const cached = this.cache.get(featureId);
    if (!cached) return;
    if (value === null || value === undefined) {
      delete cached.properties[key];
    } else {
      cached.properties[key] = value;
    }
  }

  clear(): void {
    this.cache.clear();
  }

  private pruneCache(seenIds: Set<string>): void {
    if (this.cache.size > seenIds.size * 1.5) {
      for (const key of this.cache.keys()) {
        if (!seenIds.has(key)) this.cache.delete(key);
      }
    }

    if (this.cache.size <= this.maxCacheSize) return;

    let removed = 0;
    const toRemove = this.cache.size - this.maxCacheSize;
    for (const key of this.cache.keys()) {
      if (removed >= toRemove) break;
      if (!seenIds.has(key)) {
        this.cache.delete(key);
        removed++;
      }
    }

    while (this.cache.size > this.maxCacheSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey === undefined) break;
      this.cache.delete(firstKey);
    }
  }
}
