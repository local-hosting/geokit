import { resolveGlobeCdnBaseUrl } from './config';

export type GlobeCdnFetchOptions = {
  baseUrl?: string;
  init?: RequestInit;
};

/** Same-origin dev proxy prefix — same-origin only for this path. */
const DEV_PROXY_PREFIX = '/__globe-cdn';

export function resolveGlobeCdnRequestUrl(pathOrUrl: string, base: string): string {
  if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) {
    return pathOrUrl;
  }
  if (pathOrUrl.startsWith(DEV_PROXY_PREFIX)) {
    return pathOrUrl;
  }
  const clean = pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`;
  return `${base.replace(/\/$/, '')}${clean}`;
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
  const url = resolveGlobeCdnRequestUrl(pathOrUrl, base);
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
    return (await res.json()) as T;
  } catch {
    return null;
  }
}
