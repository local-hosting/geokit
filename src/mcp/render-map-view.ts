import type { Bounds } from '@twinfile/geokit/types';
import type { MapMcpRenderOptions, MapMcpRenderResult, MapViewInput } from '../types/mcp-map.js';
import { geometryToMaptilerPaths } from './maptiler-region-path.js';
import { resolveMapRegionFeature } from './resolve-region-feature.js';
import { resolveMapViewport } from './resolve-viewport.js';
import {
  buildMapMarkdownImage,
  buildMapTilerAutoStaticUrl,
  buildMapTilerBoundsStaticUrl,
  buildMapTilerStaticUrl,
  DEFAULT_MAP_DIMENSIONS,
  DEFAULT_MAP_FIT_PADDING,
  DEFAULT_MAP_STYLE,
} from './static-map.js';

function maptilerStaticFetchHeaders(referer: string | undefined): HeadersInit | undefined {
  if (!referer) return undefined;
  const headers: Record<string, string> = { Referer: referer };
  try {
    headers.Origin = new URL(referer).origin;
  } catch {
    // keep Referer only
  }
  return headers;
}

function hasGeographyInput(input: MapViewInput): boolean {
  return Boolean(
    input.countyFips?.trim() ||
      (input.state?.trim() && input.place?.trim()) ||
      input.bounds?.length === 4
  );
}

export async function renderMapViewForMcp(
  input: MapViewInput,
  options: MapMcpRenderOptions
): Promise<MapMcpRenderResult> {
  const maptilerKey = options.maptilerKey?.trim();
  if (!maptilerKey) {
    throw new Error('MAPTILER_KEY is required for map snapshots');
  }

  const style = input.style ?? DEFAULT_MAP_STYLE;
  const width = input.width ?? DEFAULT_MAP_DIMENSIONS.width;
  const height = input.height ?? DEFAULT_MAP_DIMENSIONS.height;
  const padding = DEFAULT_MAP_FIT_PADDING;
  const dimensions = { width, height };

  const regionFeature = await resolveMapRegionFeature(input, {
    cdnBaseUrl: options.cdnBaseUrl,
  });
  const paths =
    regionFeature?.geometry != null ? geometryToMaptilerPaths(regionFeature.geometry) : undefined;

  const fitGeography = hasGeographyInput(input) && input.zoom == null;
  const viewport = resolveMapViewport(input, {
    width,
    height,
    fitToBounds: fitGeography,
    padding,
  });

  let imageUrl: string;
  if (paths?.length && fitGeography) {
    imageUrl = buildMapTilerAutoStaticUrl({
      style,
      dimensions,
      apiKey: maptilerKey,
      paths,
      padding,
    });
  } else if (input.bounds?.length === 4 && fitGeography) {
    imageUrl = buildMapTilerBoundsStaticUrl({
      bounds: input.bounds as Bounds,
      style,
      dimensions,
      apiKey: maptilerKey,
      paths,
      padding,
    });
  } else {
    imageUrl = buildMapTilerStaticUrl({
      viewport,
      style,
      dimensions,
      apiKey: maptilerKey,
      paths,
    });
  }

  const markdown = [
    input.label ? `### ${input.label}` : undefined,
    buildMapMarkdownImage({ imageUrl, label: input.label, viewport }),
    `Center: ${viewport.lat.toFixed(5)}, ${viewport.lng.toFixed(5)} · zoom ${viewport.zoom}`,
  ]
    .filter(Boolean)
    .join('\n\n');

  const result: MapMcpRenderResult = {
    viewport,
    style,
    width,
    height,
    imageUrl,
    markdown,
  };

  if (options.fetchImage) {
    const referer = options.referer?.trim() || undefined;
    const res = await fetch(imageUrl, {
      headers: maptilerStaticFetchHeaders(referer),
    });
    if (!res.ok) {
      throw new Error(
        `MapTiler static map fetch failed: ${res.status} ${res.statusText}` +
          (res.status === 403
            ? ' (referrer-restricted key? set MAPTILER_REFERER to an allowed origin)'
            : '')
      );
    }
    const buffer = Buffer.from(await res.arrayBuffer());
    result.imageBase64 = buffer.toString('base64');
    result.mimeType = res.headers.get('content-type') ?? 'image/png';
    result.markdown = [
      input.label ? `### ${input.label}` : undefined,
      `Center: ${viewport.lat.toFixed(5)}, ${viewport.lng.toFixed(5)} · zoom ${viewport.zoom}`,
    ]
      .filter(Boolean)
      .join('\n\n');
  }

  return result;
}
