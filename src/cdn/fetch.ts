import { isPublishedCellLayerId, resolvePublishedCellLayerId } from './cell-catalog-alias';
import { compactH3CellId } from '../utils/h3/cell-id';
import { resolveGlobeCdnBaseUrl } from './config';

export type GlobeCdnFetchOptions = {
  baseUrl?: string;
  init?: RequestInit;
};

export type GlobeCdnBytesDetail = {
  url: string;
  bytes: number;
};

export type GlobeCdnBytesObserver = (detail: GlobeCdnBytesDetail) => void;

const globeCdnBytesObservers = new Set<GlobeCdnBytesObserver>();

/** Host apps can observe JSON payload sizes from fetchGlobeCdnJson. */
export function registerGlobeCdnBytesObserver(observer: GlobeCdnBytesObserver): () => void {
  globeCdnBytesObservers.add(observer);
  return () => globeCdnBytesObservers.delete(observer);
}

function notifyGlobeCdnBytes(detail: GlobeCdnBytesDetail): void {
  for (const observer of globeCdnBytesObservers) {
    try {
      observer(detail);
    } catch {
      /* host observer must not break loader */
    }
  }
}

const CELL_BUNDLE_PATH = /^\/cell\/([^/]+)\.json$/;

let publishedCellIds: Set<string> | null | undefined;

export function syncPublishedCellLayerIds(ids: Set<string> | null): void {
  publishedCellIds = ids;
}

export function clearPublishedCellLayerIdsCache(): void {
  publishedCellIds = undefined;
}

export function parseCellBundleIdFromPath(pathOrUrl: string): string | null {
  try {
    const path = pathOrUrl.startsWith('http')
      ? new URL(pathOrUrl).pathname
      : (pathOrUrl.split('?')[0] ?? pathOrUrl);
    const match = path.match(CELL_BUNDLE_PATH);
    if (!match?.[1]) return null;
    return compactH3CellId(match[1]);
  } catch {
    return null;
  }
}

/** When false, callers should skip the network request for this cell bundle path. */
export function shouldFetchCellBundlePath(pathOrUrl: string): boolean {
  const cellId = parseCellBundleIdFromPath(pathOrUrl);
  if (!cellId) return true;
  if (publishedCellIds === undefined) return false;
  if (publishedCellIds === null || !publishedCellIds.size) return false;
  return isPublishedCellLayerId(cellId, publishedCellIds);
}

function rewriteCellBundlePath(pathOrUrl: string, publishedId: string): string {
  const cellId = parseCellBundleIdFromPath(pathOrUrl);
  if (!cellId || cellId === publishedId) return pathOrUrl;
  return pathOrUrl.replace(`/cell/${cellId}.json`, `/cell/${publishedId}.json`);
}

export function resolveGlobeCdnRequestUrl(pathOrUrl: string, base: string): string {
  if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) {
    return pathOrUrl;
  }
  // Same-origin dev proxy prefix — do not rebase onto the remote CDN origin.
  if (pathOrUrl.startsWith('/__globe-cdn')) {
    return pathOrUrl;
  }
  const clean = pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`;
  const trimmedBase = base.replace(/\/$/, '');
  if (!trimmedBase) return clean;
  return `${trimmedBase}${clean}`;
}

export function mergeGlobeCdnInit(init?: RequestInit): RequestInit {
  const headers = new Headers(init?.headers);
  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json');
  }
  return { ...init, headers };
}

export async function fetchGlobeCdn(
  pathOrUrl: string,
  options?: GlobeCdnFetchOptions
): Promise<Response> {
  const base = resolveGlobeCdnBaseUrl(options?.baseUrl);
  let url = resolveGlobeCdnRequestUrl(pathOrUrl, base);
  const cellId = parseCellBundleIdFromPath(url);
  if (cellId && publishedCellIds?.size) {
    const publishedId = resolvePublishedCellLayerId(cellId, publishedCellIds);
    if (!publishedId) {
      return new Response(null, { status: 404, statusText: 'Not in cell layer catalog' });
    }
    url = rewriteCellBundlePath(url, publishedId);
  } else if (!shouldFetchCellBundlePath(url)) {
    return new Response(null, { status: 404, statusText: 'Not in cell layer catalog' });
  }
  return fetch(url, mergeGlobeCdnInit(options?.init));
}

export async function fetchGlobeCdnJson<T>(
  pathOrUrl: string,
  options?: GlobeCdnFetchOptions
): Promise<T | null> {
  try {
    const res = await fetchGlobeCdn(pathOrUrl, options);
    if (!res.ok) return null;
    const contentType = res.headers.get('content-type') ?? '';
    if (contentType.includes('text/html')) return null;
    const text = await res.text();
    if (text.length > 0) {
      notifyGlobeCdnBytes({
        url: pathOrUrl,
        bytes: new TextEncoder().encode(text).byteLength,
      });
    }
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}
