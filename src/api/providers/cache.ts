/**
 * Provider Cache (re-export from utils/cache)
 *
 * @deprecated Import from '../../utils/cache' directly for new code
 */

export {
  GeoCache as ProviderCache,
  type CacheOptions as ProviderCacheOptions,
  type CacheStats,
  roundForCacheKey,
  coordinateCacheKey,
} from '../../utils/cache';
