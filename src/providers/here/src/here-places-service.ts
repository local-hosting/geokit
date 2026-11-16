/**
 * HERE Places API provider — Discover search.
 */

import { Service } from '@doppler-group/geokit/service';
import { type ServiceConfig, type ServiceCapability, type PlaceSearchOptions, type PlaceSearchResult } from '@doppler-group/geokit/service/types';
import { ProviderCache, buildPlaceSearchCacheKey, RequestQueue, requireAPIKey, fetchWithRetry } from '@doppler-group/geokit/service';
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

export class HerePlacesService extends Service {
  private cache = new ProviderCache<PlaceSearchResult[]>({
    maxEntries: 1000,
    ttlMs: 30 * 60 * 1000,
    name: 'HerePlacesCache',
  });
  private queue = new RequestQueue({ maxConcurrent: 6, batchDelayMs: 50 });

  getName(): string {
    return 'here-places';
  }

  getCapabilities(): ServiceCapability[] {
    return ['placeSearch'];
  }

  async initialize(config: ServiceConfig): Promise<void> {
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
    const categories = options.categories;
    const url = buildHereDiscoverUrl(options, this.apiKey!, categories);

    const response = await fetchWithRetry(() => fetch(url), PROVIDER_NAME);
    const payload = (await response.json()) as HereDiscoverResponse;

    const results = (payload.items ?? [])
      .map(normalizeHereDiscoverItem)
      .filter((result): result is PlaceSearchResult => result !== null);

    this.cache.set(cacheKey, results);
    return results;
  }

  private getCacheKey(options: PlaceSearchOptions): string {
    return buildPlaceSearchCacheKey(options, 'here', []);
  }
}
