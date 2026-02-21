/**
 * LRU Cache Utility
 *
 * Reusable LRU cache with TTL, hit/miss tracking, stats,
 * and optional disk persistence for cross-run caching.
 */

import { LRUCache } from 'lru-cache';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

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
  /** Directory path for disk persistence. When set, entries survive process restarts. */
  diskPath?: string;
}

/**
 * Cache entry wrapper with data
 */
interface CacheEntry<T> {
  data: T;
}

/** Disk envelope includes a timestamp so TTL can be enforced across restarts. */
interface DiskEnvelope<T> {
  ts: number;
  data: T;
}

function diskKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex').slice(0, 16);
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
  private diskPath: string | undefined;
  private ttlMs: number;
  private diskDirReady = false;

  constructor(options: CacheOptions = {}) {
    const { maxEntries = 100, ttlMs = 10 * 60 * 1000, name = 'GeoCache', diskPath } = options;

    this.name = name;
    this.ttlMs = ttlMs;
    this.diskPath = diskPath;
    this.cache = new LRUCache<string, CacheEntry<T>>({
      max: maxEntries,
      ttl: ttlMs,
    });
  }

  private ensureDiskDir(): void {
    if (this.diskDirReady || !this.diskPath) return;
    if (!fs.existsSync(this.diskPath)) fs.mkdirSync(this.diskPath, { recursive: true });
    this.diskDirReady = true;
  }

  private diskFilePath(key: string): string | undefined {
    if (!this.diskPath) return undefined;
    return path.join(this.diskPath, `${diskKey(key)}.json`);
  }

  private readDisk(key: string): T | undefined {
    const fp = this.diskFilePath(key);
    if (!fp || !fs.existsSync(fp)) return undefined;
    try {
      const envelope = JSON.parse(fs.readFileSync(fp, 'utf-8')) as DiskEnvelope<T>;
      if (Date.now() - envelope.ts > this.ttlMs) return undefined;
      this.cache.set(key, { data: envelope.data });
      return envelope.data;
    } catch {
      return undefined;
    }
  }

  private writeDisk(key: string, data: T): void {
    const fp = this.diskFilePath(key);
    if (!fp) return;
    this.ensureDiskDir();
    const envelope: DiskEnvelope<T> = { ts: Date.now(), data };
    fs.writeFileSync(fp, JSON.stringify(envelope), 'utf-8');
  }

  /**
   * Get a cached value by key.
   * Checks in-memory LRU first, then falls back to disk if diskPath is configured.
   */
  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (entry) {
      this.hits++;
      return entry.data;
    }
    const diskData = this.readDisk(key);
    if (diskData !== undefined) {
      this.hits++;
      return diskData;
    }
    this.misses++;
    return undefined;
  }

  /**
   * Check if a key exists in cache (without affecting hit/miss stats)
   */
  has(key: string): boolean {
    if (this.cache.has(key)) return true;
    if (!this.diskPath) return false;
    const fp = this.diskFilePath(key);
    return !!fp && fs.existsSync(fp);
  }

  /**
   * Store a value in both in-memory LRU and (optionally) on disk.
   */
  set(key: string, data: T): void {
    this.cache.set(key, { data });
    this.writeDisk(key, data);
  }

  /**
   * Remove a specific key from cache and disk.
   */
  delete(key: string): boolean {
    const removed = this.cache.delete(key);
    const fp = this.diskFilePath(key);
    if (fp && fs.existsSync(fp)) fs.unlinkSync(fp);
    return removed;
  }

  /**
   * Clear all cached data, disk files, and reset stats.
   */
  clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
    if (this.diskPath && fs.existsSync(this.diskPath)) {
      for (const f of fs.readdirSync(this.diskPath)) {
        if (f.endsWith('.json')) fs.unlinkSync(path.join(this.diskPath, f));
      }
    }
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
