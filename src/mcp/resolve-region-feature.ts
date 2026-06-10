import {
  BOROUGH_COUNTY_ALIASES,
  fetchCountyShapeFeature,
  fetchStatePlaceFeature,
} from '@twinfile/geokit/cdn';
import type { MapViewInput } from '../types/mcp-map.js';
import type { ResolveMapViewInputOptions } from './resolve-map-input.js';

export async function resolveMapRegionFeature(
  input: MapViewInput,
  options?: ResolveMapViewInputOptions
): Promise<GeoJSON.Feature | null> {
  const fetchOptions = { baseUrl: options?.cdnBaseUrl, init: options?.fetchInit };

  if (input.countyFips?.trim()) {
    return fetchCountyShapeFeature(input.countyFips.trim(), fetchOptions);
  }

  if (input.state?.trim() && input.place?.trim()) {
    const state = input.state.trim().toLowerCase();
    const slug = input.place.trim().toLowerCase();

    const fromPlace = await fetchStatePlaceFeature(state, slug, fetchOptions);
    if (fromPlace) return fromPlace;

    const borough = BOROUGH_COUNTY_ALIASES[slug];
    if (borough && borough.state === state) {
      return fetchCountyShapeFeature(borough.countyFips, fetchOptions);
    }
  }

  return null;
}
