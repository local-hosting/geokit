/**
 * Place taxonomy resolver — optional bridge to @geokit/geotypes at app bootstrap.
 */

import type {
  GeotypeRef,
  PlaceSearchProvider,
  PlaceTaxonomyResolver,
  ResolvedGeotype,
} from './types/place-taxonomy.js';
import type { PlaceSearchOptions, PlaceSearchResult } from './providers/types.js';

export type {
  GeotypeRef,
  PlaceSearchProvider,
  PlaceTaxonomyResolver,
  ResolvedGeotype,
} from './types/place-taxonomy.js';

let resolver: PlaceTaxonomyResolver | null = null;

export function setPlaceTaxonomyResolver(next: PlaceTaxonomyResolver | null): void {
  resolver = next;
}

export function getPlaceTaxonomyResolver(): PlaceTaxonomyResolver | null {
  return resolver;
}

export function resolvePlaceSearchCategories(
  options: PlaceSearchOptions,
  provider: PlaceSearchProvider
): string[] | undefined {
  if (options.geotypes?.length) {
    if (!resolver) {
      throw new Error(
        'placeSearch geotypes require setPlaceTaxonomyResolver() — install @geokit/geotypes/geokit'
      );
    }
    const resolved = resolver.toProviderCategories(options.geotypes, provider);
    return resolved.length > 0 ? resolved : undefined;
  }
  return options.categories;
}

export function enrichPlaceSearchResult(
  result: PlaceSearchResult,
  provider: PlaceSearchProvider
): PlaceSearchResult {
  if (!resolver || !result.categories?.length) {
    return result;
  }

  for (const category of result.categories) {
    const slug = resolver.fromProviderCategory(category, provider);
    if (!slug) continue;
    const resolved = resolver.resolve(slug);
    return {
      ...result,
      geotype: slug,
      geotypeAcronym: resolved?.acronym,
    };
  }

  return result;
}
