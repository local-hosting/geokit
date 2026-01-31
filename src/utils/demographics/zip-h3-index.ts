/**
 * H3-to-ZIP Index Loader
 *
 * Provides lazy loading for the H3-to-ZIP index instead of embedding it.
 * This reduces bundle size by ~690KB.
 *
 * Usage:
 *   import { initializeZipIndex } from '@twinfile/geokit';
 *
 *   // Option 1: Load from default CDN path
 *   await initializeZipIndex();
 *
 *   // Option 2: Load from custom URL
 *   await initializeZipIndex('/custom/path/zip-h3-index.json');
 */

import { loadH3ZipIndex, loadH3ZipIndexFromUrl, isH3IndexLoaded } from './zipcode';

// Default URL for the index (can be overridden)
const DEFAULT_INDEX_URL = '/data/zip-h3-index.json';

// Track initialization state
let initPromise: Promise<void> | null = null;

/**
 * Initialize the H3-to-ZIP index by loading from URL
 *
 * This is a lazy-loading alternative to embedding the 690KB index in the bundle.
 * The index is loaded once and cached in memory.
 *
 * @param url - URL to load the index from (default: /data/zip-h3-index.json)
 * @returns Promise that resolves when index is loaded
 *
 * @example
 * ```typescript
 * // Load from default path
 * await initializeZipIndex();
 *
 * // Load from custom path
 * await initializeZipIndex('/assets/zip-h3-index.json');
 * ```
 */
export async function initializeZipIndex(url: string = DEFAULT_INDEX_URL): Promise<void> {
  // Already loaded
  if (isH3IndexLoaded()) {
    return;
  }

  // Return existing promise if load is in progress
  if (initPromise) {
    return initPromise;
  }

  initPromise = loadH3ZipIndexFromUrl(url)
    .catch((error) => {
      console.warn('[H3 Index] Failed to load index:', error);
      // Don't throw - allow fallback to API-based lookups
    })
    .finally(() => {
      initPromise = null;
    });

  return initPromise;
}

/**
 * Load the H3-to-ZIP index from a pre-fetched data object
 * Useful when you've already fetched the data or want to bundle it differently
 *
 * @param indexData - The H3 cell to ZIP code mapping
 */
export function loadZipIndexData(indexData: Record<string, string[]>): void {
  loadH3ZipIndex(indexData);
}

// Re-export for convenience
export { isH3IndexLoaded } from './zipcode';
