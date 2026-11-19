/**
 * OpenStreetMap place search via Overpass API.
 *
 * Reference implementation for @local-hosting/geokit/osm.
 */

import { Service } from '@local-hosting/geokit/service';
import { type ServiceConfig, type ServiceCapability, type PlaceSearchOptions, type PlaceSearchResult } from '@local-hosting/geokit/service/types';
import { fetchWithRetry } from '@local-hosting/geokit/service';

const DEFAULT_OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

type OverpassElement = {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

type OverpassResponse = {
  elements?: OverpassElement[];
};

export interface OsmProviderConfig extends ServiceConfig {
  overpassUrl?: string;
}

export function parseOsmTag(tag: string): { key: string; value: string } | null {
  const separator = tag.indexOf('=');
  if (separator <= 0 || separator === tag.length - 1) {
    return null;
  }
  return {
    key: tag.slice(0, separator),
    value: tag.slice(separator + 1),
  };
}

export function buildOverpassPlaceSearchQuery(
  options: PlaceSearchOptions,
  tags: string[]
): string {
  if (!options.ll) {
    throw new Error('OSM place search requires location (ll)');
  }

  const [lng, lat] = options.ll;
  const radius = options.radius ?? 1000;
  const limit = options.limit ?? 20;
  const tagSelectors = tags
    .map((tag) => {
      const parsed = parseOsmTag(tag);
      if (!parsed) {
        return null;
      }
      return `["${parsed.key}"="${parsed.value}"]`;
    })
    .filter((selector): selector is string => selector !== null);

  if (tagSelectors.length === 0) {
    throw new Error('OSM place search requires categories');
  }

  const union = tagSelectors
    .flatMap((selector) => [
      `  node${selector}(around:${radius},${lat},${lng});`,
      `  way${selector}(around:${radius},${lat},${lng});`,
      `  relation${selector}(around:${radius},${lat},${lng});`,
    ])
    .join('\n');

  return `[out:json][timeout:25];
(
${union}
);
out center ${limit};`;
}

export function normalizeOverpassElement(element: OverpassElement): PlaceSearchResult | null {
  const lat = element.lat ?? element.center?.lat;
  const lon = element.lon ?? element.center?.lon;
  if (lat == null || lon == null) {
    return null;
  }

  const tags = element.tags ?? {};
  const categories = Object.entries(tags)
    .filter(([key]) => !key.startsWith('name') && key !== 'brand')
    .slice(0, 3)
    .map(([key, value]) => `${key}=${value}`);

  return {
    id: `osm:${element.type}/${element.id}`,
    name: tags.name ?? tags.brand ?? 'Unnamed place',
    location: [lon, lat],
    categories,
    address: tags['addr:full'] ?? tags['addr:street'],
    raw: element,
  };
}

export class OsmService extends Service {
  private overpassUrl = DEFAULT_OVERPASS_URL;

  getName(): string {
    return 'osm';
  }

  getCapabilities(): ServiceCapability[] {
    return ['placeSearch'];
  }

  async initialize(config: OsmProviderConfig): Promise<void> {
    if (config.overpassUrl) {
      this.overpassUrl = config.overpassUrl;
    }
  }

  async placeSearch(options: PlaceSearchOptions): Promise<PlaceSearchResult[]> {
    const categories = options.categories;
    if (!categories?.length) {
      throw new Error(
        'OSM place search requires categories'
      );
    }

    const query = buildOverpassPlaceSearchQuery(options, categories);
    const response = await fetchWithRetry(
      () =>
        fetch(this.overpassUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: `data=${encodeURIComponent(query)}`,
        }),
      'OSM Overpass'
    );

    const payload = (await response.json()) as OverpassResponse;
    const results = (payload.elements ?? [])
      .map(normalizeOverpassElement)
      .filter((result): result is PlaceSearchResult => result !== null);

    return results.slice(0, options.limit ?? results.length);
  }
}
