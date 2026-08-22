/**
 * LRU Cache Utility
 *
 * In-memory LRU with TTL and hit/miss tracking (browser + Node safe).
 */

import { LRUCache } from 'lru-cache';

export interface CacheOptions {
  maxEntries?: number;
  ttlMs?: number;
  name?: string;
  /** @deprecated Disk persistence removed — in-memory only for browser bundles */
  diskPath?: string;
}

interface CacheEntry<T> {
  data: T;
}

export interface CacheStats {
  size: number;
  hits: number;
  misses: number;
  hitRate: string;
}

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

  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (entry) {
      this.hits++;
      return entry.data;
    }
    this.misses++;
    return undefined;
  }

  has(key: string): boolean {
    return this.cache.has(key);
  }

  set(key: string, data: T): void {
    this.cache.set(key, { data });
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }

  getStats(): CacheStats {
    const total = this.hits + this.misses;
    return {
      size: this.cache.size,
      hits: this.hits,
      misses: this.misses,
      hitRate: total > 0 ? ((this.hits / total) * 100).toFixed(1) + '%' : '0%',
    };
  }

  get size(): number {
    return this.cache.size;
  }

  getName(): string {
    return this.name;
  }
}

export function roundForCacheKey(value: number, decimals: number): string {
  return value.toFixed(decimals);
}

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

/** @deprecated Use CacheOptions instead */
export type ProviderCacheOptions = CacheOptions;

/** @deprecated Use GeoCache instead */
export const ProviderCache = GeoCache;
