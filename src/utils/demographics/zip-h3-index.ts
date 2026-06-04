/**
 * H3-to-ZIP Index Loader
 *
 * Lazy-loads the H3-to-ZIP crosswalk instead of embedding it (~690KB).
 * Apps typically fetch the index from Globe CDN or Loro pack and call
 * `loadZipIndexData` / `loadH3ZipIndex` — see `@twinfile/cdn/client`.
 *
 * Usage:
 *   import { initializeZipIndex, loadZipIndexData } from '@twinfile/geokit';
 *
 *   // Preferred: data already fetched (CDN, lockers, pipeline artifact)
 *   loadZipIndexData(h3ToZips);
 *
 *   // Or load from a URL your app hosts
 *   await initializeZipIndex('/us/indexes/zip-h3-index.json');
 */

import { loadH3ZipIndex, loadH3ZipIndexFromUrl, isH3IndexLoaded } from './zipcode';

/** Default URL when using initializeZipIndex without an argument (override in apps). */
const DEFAULT_INDEX_URL = '/data/zip-h3-index.json';

let initPromise: Promise<void> | null = null;

/**
 * Initialize the H3-to-ZIP index by loading from URL.
 *
 * @param url - URL to load the index from (default: /data/zip-h3-index.json)
 */
export async function initializeZipIndex(url: string = DEFAULT_INDEX_URL): Promise<void> {
  if (isH3IndexLoaded()) {
    return;
  }

  if (initPromise) {
    return initPromise;
  }

  initPromise = loadH3ZipIndexFromUrl(url)
    .catch((error) => {
      console.warn('[H3 Index] Failed to load index:', error);
    })
    .finally(() => {
      initPromise = null;
    });

  return initPromise;
}

/**
 * Load the H3-to-ZIP index from a pre-fetched object (CDN, lockers, or local JSON).
 */
export function loadZipIndexData(indexData: Record<string, string[]>): void {
  loadH3ZipIndex(indexData);
}

export { isH3IndexLoaded } from './zipcode';
