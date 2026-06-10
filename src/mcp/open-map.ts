import type { MapStyleId, MapViewport } from '../types/mcp-map.js';

export const DEFAULT_MAP_HOST_URL = 'http://localhost:3002';

/** Path served by `yarn map-host` (Vite root: host/mcp/). */
export const MAP_HOST_PATH = '/index.html';

export function resolveMapHostBaseUrl(): string {
  const fromEnv =
    process.env.MAP_HOST_URL?.trim() ||
    process.env.GEOKIT_MAP_HOST_URL?.trim() ||
    DEFAULT_MAP_HOST_URL;
  return fromEnv.replace(/\/$/, '');
}

export function buildMapHostUrl(args: {
  hostBaseUrl?: string;
  viewport: MapViewport;
  style?: MapStyleId;
  theme?: 'light' | 'dark';
  provider?: string;
}): string {
  const base = (args.hostBaseUrl ?? resolveMapHostBaseUrl()).replace(/\/$/, '');
  const url = new URL(`${base}${MAP_HOST_PATH}`);
  url.searchParams.set('lat', String(args.viewport.lat));
  url.searchParams.set('lng', String(args.viewport.lng));
  url.searchParams.set('zoom', String(args.viewport.zoom));
  if (args.style) {
    url.searchParams.set('style', args.style);
  }
  if (args.theme) {
    url.searchParams.set('theme', args.theme);
  }
  if (args.provider) {
    url.searchParams.set('provider', args.provider);
  }
  return url.toString();
}
