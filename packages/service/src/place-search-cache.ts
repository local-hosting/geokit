/**
 * Shared cache-key builder for placeSearch providers.
 */

import type { PlaceSearchOptions } from './services/types.js';
import { coordinateCacheKey } from './services/cache.js';

export function buildPlaceSearchCacheKey(
  options: PlaceSearchOptions,
  prefix: string,
  extraParts: string[] = []
): string {
  const parts: string[] = [prefix];

  if (options.query) {
    parts.push(`q:${options.query}`);
  }
  if (options.ll) {
    parts.push(`ll:${coordinateCacheKey(options.ll[1], options.ll[0], [], 3)}`);
  }
  if (options.radius) {
    parts.push(`r:${options.radius}`);
  }
  if (options.geotypes?.length) {
    parts.push(`gt:${options.geotypes.join(',')}`);
  } else if (options.categories?.length) {
    parts.push(`cat:${options.categories.join(',')}`);
  }
  if (options.limit) {
    parts.push(`lim:${options.limit}`);
  }

  parts.push(...extraParts);
  return parts.join(':');
}
