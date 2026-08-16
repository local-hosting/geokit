import { isH3IndexLoaded, loadH3ZipIndex, loadH3ZipIndexFromUrl } from './zipcode.js';

/** Default URL when using initializeZipIndex without an argument (override in apps). */
const DEFAULT_INDEX_URL = '/data/zip-h3-index.json';

let initPromise: Promise<void> | null = null;

/**
 * Initialize the H3-to-ZIP index by loading from URL.
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

/** Load the H3-to-ZIP index from a pre-fetched object (CDN, lockers, or local JSON). */
export function loadZipIndexData(indexData: Record<string, string[]>): void {
  loadH3ZipIndex(indexData);
}

export { isH3IndexLoaded };
