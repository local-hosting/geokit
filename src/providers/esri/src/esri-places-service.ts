/**
 * Esri ArcGIS Places service — near-point search.
 */

import { CachedService } from '@doppler-group/geokit/service';
import { type ServiceConfig, type ServiceCapability, type PlaceSearchOptions, type PlaceSearchResult } from '@doppler-group/geokit/service/types';
import { fetchWithRetry } from '@doppler-group/geokit/service';
import {
  ESRI_PLACES_NEAR_POINT,
  type EsriPlaceRaw,
  type EsriPlacesNearPointResponse,
} from './types/esri-places';

const SERVICE_LABEL = 'Esri Places';
const ESRI_CATEGORY_ID_PATTERN = /^[0-9a-f]{24}$/i;

export function isEsriCategoryId(value: string): boolean {
  return ESRI_CATEGORY_ID_PATTERN.test(value);
}

export function esriPlacesHeaders(apiKey: string): HeadersInit {
  return { Authorization: `Bearer ${apiKey}` };
}

export function buildEsriNearPointUrl(options: PlaceSearchOptions, categories?: string[]): string {
  if (!options.ll) {
    throw new Error('Esri Places service: location (ll) is required');
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

export class EsriPlacesService extends CachedService<PlaceSearchResult[]> {
  constructor() {
    super({ cacheName: 'EsriPlacesCache' });
  }

  getName(): string {
    return 'esri-places';
  }

  getCapabilities(): ServiceCapability[] {
    return ['placeSearch'];
  }

  async initialize(config: ServiceConfig): Promise<void> {
    this.initCredentials(config, 'gk-esri-places');
  }

  async placeSearch(options: PlaceSearchOptions): Promise<PlaceSearchResult[]> {
    this.requireApiKey(`${SERVICE_LABEL} service`);
    return this.cachedPlaceSearch(options, 'esri', [], () => this.placeSearchInternal(options));
  }

  private async placeSearchInternal(options: PlaceSearchOptions): Promise<PlaceSearchResult[]> {
    const categories = options.categories;
    const url = buildEsriNearPointUrl(options, categories);

    const response = await fetchWithRetry(
      () => fetch(url, { headers: esriPlacesHeaders(this.apiKey!) }),
      SERVICE_LABEL
    );

    const payload = (await response.json()) as EsriPlacesNearPointResponse;

    return (payload.results ?? [])
      .map(normalizeEsriPlace)
      .filter((result): result is PlaceSearchResult => result !== null);
  }
}
