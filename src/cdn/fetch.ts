import { resolveGlobeCdnBaseUrl } from './config';

export type GlobeCdnFetchOptions = {
  baseUrl?: string;
  init?: RequestInit;
};

export function resolveGlobeCdnRequestUrl(pathOrUrl: string, base: string): string {
  if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) {
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
