/**
 * Esri ArcGIS Places API provider — near-point search.
 */

import {
  BaseAPIProvider,
  type APICapability,
  type MapProviderConfig,
  type PlaceSearchOptions,
  type PlaceSearchResult,
} from '@geokit/api/types';
import { ProviderCache, coordinateCacheKey, RequestQueue, requireAPIKey, fetchWithRetry } from '@geokit/api';
import {
  enrichPlaceSearchResult,
  resolvePlaceSearchCategories,
} from '@geokit/api/place-taxonomy';
import {
  ESRI_PLACES_NEAR_POINT,
  type EsriPlaceRaw,
  type EsriPlacesNearPointResponse,
} from './types/esri-places.js';

const PROVIDER_NAME = 'Esri Places';
const ESRI_CATEGORY_ID_PATTERN = /^[0-9a-f]{24}$/i;

export function isEsriCategoryId(value: string): boolean {
  return ESRI_CATEGORY_ID_PATTERN.test(value);
}

export function esriPlacesHeaders(apiKey: string): HeadersInit {
  return {
    Authorization: `Bearer ${apiKey}`,
  };
}

export function buildEsriNearPointUrl(
  options: PlaceSearchOptions,
  categories?: string[]
): string {
  if (!options.ll) {
    throw new Error('Esri Places API Provider: location (ll) is required');
  }

  const [x, y] = options.ll;
  const params = new URLSearchParams({
    f: 'json',
    x: String(x),
    y: String(y),
    radius: String(options.radius ?? 1500),
    pageSize: String(Math.min(options.limit ?? 20, 20)),
  });

  if (options.query) {
    params.set('searchText', options.query);
  }

  const categoryIds = categories?.filter(isEsriCategoryId) ?? [];
  const labelFilters = categories?.filter((value) => !isEsriCategoryId(value)) ?? [];

  if (categoryIds.length > 0) {
    params.set('categoryIds', categoryIds.join(','));
  }

  if (labelFilters.length > 0 && !options.query) {
    params.set('searchText', labelFilters[0]!);
  }

  return `${ESRI_PLACES_NEAR_POINT}?${params.toString()}`;
}

export function normalizeEsriPlace(item: EsriPlaceRaw): PlaceSearchResult | null {
  const x = item.location?.x;
  const y = item.location?.y;
  if (x == null || y == null || !item.placeId) {
    return null;
  }

  const categories = item.categories
    ?.map((category) => category.categoryId ?? category.label)
    .filter((value): value is string => Boolean(value));

  return {
    id: item.placeId,
    name: item.name ?? 'Unnamed place',
    location: [x, y],
    categories: categories?.length ? categories : undefined,
    distance: item.distance,
    raw: item,
  };
}

export class EsriPlacesAPIProvider extends BaseAPIProvider {
  private apiKey: string | null = null;
  private cache = new ProviderCache<PlaceSearchResult[]>({
    maxEntries: 1000,
    ttlMs: 30 * 60 * 1000,
    name: 'EsriPlacesCache',
  });
  private queue = new RequestQueue({ maxConcurrent: 6, batchDelayMs: 50 });

  getName(): string {
    return 'esri-places';
  }

  getCapabilities(): APICapability[] {
    return ['placeSearch'];
  }

  async initialize(config: MapProviderConfig): Promise<void> {
    if (config.apiKey) {
      this.apiKey = config.apiKey;
      return;
    }
    console.warn('[gk-api-esri-places] No API key provided. API calls will not work.');
  }

  async placeSearch(options: PlaceSearchOptions): Promise<PlaceSearchResult[]> {
    requireAPIKey(this.apiKey, `${PROVIDER_NAME} API Provider`);

    const cacheKey = this.getCacheKey(options);
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    return this.queue.enqueue(() => this.placeSearchInternal(options, cacheKey));
  }

  private async placeSearchInternal(
    options: PlaceSearchOptions,
    cacheKey: string
  ): Promise<PlaceSearchResult[]> {
    const categories = resolvePlaceSearchCategories(options, 'esri-places') ?? options.categories;
    const url = buildEsriNearPointUrl(options, categories);

    const response = await fetchWithRetry(
      () =>
        fetch(url, {
          headers: esriPlacesHeaders(this.apiKey!),
        }),
      PROVIDER_NAME
    );

    const payload = (await response.json()) as EsriPlacesNearPointResponse;

    const results = (payload.results ?? [])
      .map(normalizeEsriPlace)
      .filter((result): result is PlaceSearchResult => result !== null)
      .map((result) => enrichPlaceSearchResult(result, 'esri-places'));

    this.cache.set(cacheKey, results);
    return results;
  }

  private getCacheKey(options: PlaceSearchOptions): string {
    const parts = ['esri'];
    if (options.query) parts.push(`q:${options.query}`);
    if (options.ll) {
      parts.push(`ll:${coordinateCacheKey(options.ll[1], options.ll[0], [], 3)}`);
    }
    if (options.radius) parts.push(`r:${options.radius}`);
    if (options.geotypes?.length) parts.push(`gt:${options.geotypes.join(',')}`);
    else if (options.categories?.length) parts.push(`cat:${options.categories.join(',')}`);
    if (options.limit) parts.push(`lim:${options.limit}`);
    return parts.join(':');
  }
}
