/**
 * LRU Cache Utility
 *
 * Reusable LRU cache with TTL, hit/miss tracking, and stats.
 * Used across API providers and other services for consistent caching.
 */

import { LRUCache } from 'lru-cache';

/**
 * Cache configuration options
 */
export interface CacheOptions {
  /** Maximum number of entries (default: 100) */
  maxEntries?: number;
  /** Time-to-live in milliseconds (default: 10 minutes) */
  ttlMs?: number;
  /** Name for logging/debugging (optional) */
  name?: string;
}

/**
 * Cache entry wrapper with data
 */
interface CacheEntry<T> {
  data: T;
}

/**
 * Cache statistics
 */
export interface CacheStats {
  size: number;
  hits: number;
  misses: number;
  hitRate: string;
}

/**
 * Generic LRU cache with TTL and hit/miss tracking
 *
 * @example
 * ```typescript
 * const cache = new GeoCache<DemographicsResult>({
 *   maxEntries: 100,
 *   ttlMs: 30 * 60 * 1000, // 30 minutes
 * });
 *
 * cache.set('key', data);
 * const result = cache.get('key');
 * ```
 */
export class GeoCache<T> {
  private cache: LRUCache<string, CacheEntry<T>>;
  private hits = 0;
  private misses = 0;
  private name: string;

  constructor(options: CacheOptions = {}) {
    const { maxEntries = 100, ttlMs = 10 * 60 * 1000, name = 'GeoCache' } = options;

    this.name = name;
    this.cache = new LRUCache<string, CacheEntry<T>>({
      max: maxEntries,
      ttl: ttlMs,
    });
  }

  /**
   * Get a cached value by key
   * Returns undefined if not found or expired
   */
  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (entry) {
      this.hits++;
      return entry.data;
    }
    this.misses++;
    return undefined;
  }

  /**
   * Check if a key exists in cache (without affecting hit/miss stats)
   */
  has(key: string): boolean {
    return this.cache.has(key);
  }

  /**
   * Store a value in the cache
   */
  set(key: string, data: T): void {
    this.cache.set(key, { data });
  }

  /**
   * Remove a specific key from the cache
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Clear all cached data and reset stats
   */
  clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const total = this.hits + this.misses;
    return {
      size: this.cache.size,
      hits: this.hits,
      misses: this.misses,
      hitRate: total > 0 ? ((this.hits / total) * 100).toFixed(1) + '%' : '0%',
    };
  }

  /**
   * Current cache size
   */
  get size(): number {
    return this.cache.size;
  }

  /**
   * Get the cache name (for debugging)
   */
  getName(): string {
    return this.name;
  }
}

// ============================================================================
// Cache Key Utilities
// ============================================================================

/**
 * Round coordinates to specified decimal places for cache key generation
 * This improves cache hit rates by grouping nearby coordinates
 *
 * @param value - Coordinate value
 * @param decimals - Decimal places (4 = ~11m precision, 3 = ~111m precision)
 */
export function roundForCacheKey(value: number, decimals: number): string {
  return value.toFixed(decimals);
}

/**
 * Generate a cache key from coordinate-based options
 * Commonly used pattern across isochrone and place search providers
 *
 * @example
 * ```typescript
 * const key = coordinateCacheKey(40.7128, -74.006, ['driving', 15]);
 * // Returns: "40.7128,-74.0060:driving:15"
 * ```
 */
export function coordinateCacheKey(
  lat: number,
  lng: number,
  extras: (string | number)[] = [],
  precision = 4
): string {
  const roundedLat = roundForCacheKey(lat, precision);
  const roundedLng = roundForCacheKey(lng, precision);
  const extraParts = extras.map((e) => String(e)).join(':');
  return extraParts ? `${roundedLat},${roundedLng}:${extraParts}` : `${roundedLat},${roundedLng}`;
}

// ============================================================================
// Legacy Exports (for backward compatibility)
// ============================================================================

/** @deprecated Use CacheOptions instead */
export type ProviderCacheOptions = CacheOptions;

/** @deprecated Use GeoCache instead */
export const ProviderCache = GeoCache;
