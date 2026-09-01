/**
 * Shared static map image dimension helpers for MCP provider adapters.
 */

import type { MapRenderDimensions } from '../types/static-map';

export function staticMapDimensions(dims?: Partial<MapRenderDimensions>): MapRenderDimensions {
  return {
    width: dims?.width ?? 600,
    height: dims?.height ?? 400,
    scale: dims?.scale ?? '',
    format: dims?.format ?? 'png',
  };
}

export function staticMapImageSuffix(dims: MapRenderDimensions): string {
  const scale = dims.scale ?? '';
  const format = dims.format ?? 'png';
  return `${dims.width}x${dims.height}${scale}.${format}`;
}

export function staticMapPaddingPx(dims: MapRenderDimensions, padding = 0.06): number {
  return Math.round(Math.max(dims.width, dims.height) * padding);
}

export function staticMapRefererHeaders(
  referer: string | undefined,
  options?: { includeOrigin?: boolean }
): HeadersInit | undefined {
  if (!referer) return undefined;
  const headers: Record<string, string> = { Referer: referer };
  if (options?.includeOrigin) {
    try {
      headers.Origin = new URL(referer).origin;
    } catch {
      // keep Referer only
    }
  }
  return headers;
}
