import { resolveGlobeCdnBaseUrl } from './config';

export function globeCdnOriginFromBaseUrl(baseUrl?: string): string | null {
  const resolved = resolveGlobeCdnBaseUrl(baseUrl);
  if (!resolved) return null;
  return new URL(resolved).origin;
}

/** Safari can stall on cross-origin HTTPS preconnect from http://localhost. */
export function shouldInjectCrossOriginPreconnect(
  isProd: boolean,
  locationProtocol: string
): boolean {
  if (typeof window === 'undefined') return false;
  if (!isProd && locationProtocol === 'http:') return false;
  return true;
}

export function injectGlobeCdnPreconnect(baseUrl?: string): void {
  const origin = globeCdnOriginFromBaseUrl(baseUrl);
  if (!origin || typeof document === 'undefined') return;
  if (document.querySelector(`link[rel="preconnect"][href="${origin}"]`)) return;

  const link = document.createElement('link');
  link.rel = 'preconnect';
  link.href = origin;
  link.crossOrigin = '';
  document.head.appendChild(link);
}
