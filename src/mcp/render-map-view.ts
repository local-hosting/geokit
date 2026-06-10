import type { Bounds } from '@twinfile/geokit/types';
import type { MapMcpRenderOptions, MapMcpRenderResult, MapViewInput } from '../types/mcp-map.js';
import { resolveMapRegionFeature } from './resolve-region-feature.js';
import { resolveMapViewport } from './resolve-viewport.js';
import {
  buildMapMarkdownImage,
  buildStaticSnapshotUrl,
  DEFAULT_MAP_DIMENSIONS,
  DEFAULT_MAP_FIT_PADDING,
} from './static-map.js';

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
  const provider = options.provider;
  const apiKey = provider.apiKey.trim();
  if (!apiKey) {
    throw new Error('Map API key is required for map snapshots');
  }

  const style = input.style ?? provider.adapter.defaultStyle;
  const width = input.width ?? DEFAULT_MAP_DIMENSIONS.width;
  const height = input.height ?? DEFAULT_MAP_DIMENSIONS.height;
  const padding = DEFAULT_MAP_FIT_PADDING;
  const dimensions = { width, height };

  const regionFeature = await resolveMapRegionFeature(input, {
    cdnBaseUrl: options.cdnBaseUrl,
  });
  const overlays =
    regionFeature?.geometry != null
      ? provider.adapter.geometryToOverlays(regionFeature.geometry)
      : undefined;

  const fitGeography = hasGeographyInput(input) && input.zoom == null;
  const viewport = resolveMapViewport(input, {
    width,
    height,
    fitToBounds: fitGeography,
    padding,
  });

  const imageUrl = buildStaticSnapshotUrl({
    provider,
    viewport,
    style,
    dimensions,
    bounds: input.bounds?.length === 4 ? (input.bounds as Bounds) : undefined,
    overlays,
    fitGeography,
    padding,
  });

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
    provider: provider.id,
  };

  if (options.fetchImage) {
    const referer = options.referer?.trim() || provider.referer?.trim() || undefined;
    const res = await fetch(imageUrl, {
      headers: provider.adapter.staticFetchHeaders(referer),
    });
    if (!res.ok) {
      throw new Error(
        `Static map fetch failed: ${res.status} ${res.statusText}` +
          (res.status === 403
            ? ' (referrer-restricted key? set GEOKIT_MAP_REFERER to an allowed origin)'
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
