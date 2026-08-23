/**
 * HERE Places API provider — Discover search.
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

const PROVIDER_NAME = 'HERE Places';
const DISCOVER_BASE = 'https://discover.search.hereapi.com/v1/discover';

type HereCategory = {
  id?: string;
  name?: string;
  primary?: boolean;
};

type HereDiscoverItem = {
  id?: string;
  title?: string;
  position?: { lat?: number; lng?: number };
  address?: { label?: string };
  categories?: HereCategory[];
};

type HereDiscoverResponse = {
  items?: HereDiscoverItem[];
};

export function buildHereDiscoverUrl(options: PlaceSearchOptions, apiKey: string, categories?: string[]): string {
  if (!options.ll && !options.query) {
    throw new Error('HERE Places API Provider: Either query or location (ll) is required');
  }

  const params = new URLSearchParams({ apiKey, limit: String(options.limit ?? 20) });

  if (options.query) {
    params.set('q', options.query);
  }

  if (options.ll) {
    const [lng, lat] = options.ll;
    if (options.radius) {
      params.set('in', `circle:${lat},${lng};r=${options.radius}`);
    } else {
      params.set('at', `${lat},${lng}`);
    }
  }

  if (categories?.length) {
    params.set('categories', categories.join(','));
  }

  return `${DISCOVER_BASE}?${params.toString()}`;
}

export function normalizeHereDiscoverItem(item: HereDiscoverItem): PlaceSearchResult | null {
  const lat = item.position?.lat;
  const lng = item.position?.lng;
  if (lat == null || lng == null || !item.id) {
    return null;
  }

  const primary = item.categories?.find((category) => category.primary) ?? item.categories?.[0];
  const categoryValue = primary?.name ?? primary?.id;

  return {
    id: item.id,
    name: item.title ?? 'Unnamed place',
    address: item.address?.label,
    location: [lng, lat],
    categories: categoryValue ? [categoryValue] : undefined,
    raw: item,
  };
}

export class HerePlacesAPIProvider extends BaseAPIProvider {
  private apiKey: string | null = null;
  private cache = new ProviderCache<PlaceSearchResult[]>({
    maxEntries: 1000,
    ttlMs: 30 * 60 * 1000,
    name: 'HerePlacesCache',
  });
  private queue = new RequestQueue({ maxConcurrent: 6, batchDelayMs: 50 });

  getName(): string {
    return 'here-places';
  }

  getCapabilities(): APICapability[] {
    return ['placeSearch'];
  }

  async initialize(config: MapProviderConfig): Promise<void> {
    if (config.apiKey) {
      this.apiKey = config.apiKey;
      return;
    }
    console.warn('[gk-api-here-places] No API key provided. API calls will not work.');
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
    const categories = resolvePlaceSearchCategories(options, 'here-places') ?? options.categories;
    const url = buildHereDiscoverUrl(options, this.apiKey!, categories);

    const response = await fetchWithRetry(() => fetch(url), PROVIDER_NAME);
    const payload = (await response.json()) as HereDiscoverResponse;

    const results = (payload.items ?? [])
      .map(normalizeHereDiscoverItem)
      .filter((result): result is PlaceSearchResult => result !== null)
      .map((result) => enrichPlaceSearchResult(result, 'here-places'));

    this.cache.set(cacheKey, results);
    return results;
  }

  private getCacheKey(options: PlaceSearchOptions): string {
    const parts = ['here'];
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
