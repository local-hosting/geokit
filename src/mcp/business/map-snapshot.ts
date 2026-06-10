import type { ResolvedMapStaticProvider } from '../../types/map-static-provider.js';
import type { BusinessMapSnapshot } from '../../types/mcp-business.js';
import { buildMapHostUrl } from '../open-map.js';
import {
  buildMapMarkdownImage,
  buildStaticSnapshotUrl,
  DEFAULT_MAP_DIMENSIONS,
  DEFAULT_MAP_FIT_PADDING,
} from '../static-map.js';
import { resolveMapViewport } from '../resolve-viewport.js';

export async function renderBusinessMap(args: {
  provider: ResolvedMapStaticProvider;
  lat: number;
  lng: number;
  bounds?: [number, number, number, number];
  label?: string;
  zoom?: number;
  overlays?: string[];
  fetchImage?: boolean;
  includeHostUrl?: boolean;
  hostBaseUrl?: string;
  theme?: 'light' | 'dark';
}): Promise<BusinessMapSnapshot> {
  const provider = args.provider;
  const width = DEFAULT_MAP_DIMENSIONS.width;
  const height = DEFAULT_MAP_DIMENSIONS.height;
  const padding = DEFAULT_MAP_FIT_PADDING;
  const overlays = args.overlays ?? [];
  const hasOverlays = overlays.length > 0;
  const frameRegion = args.bounds != null;
  const fitGeography = hasOverlays || frameRegion;

  const fitToBounds = frameRegion;
  const viewport = resolveMapViewport(
    fitToBounds
      ? { bounds: args.bounds, zoom: args.zoom }
      : { lat: args.lat, lng: args.lng, zoom: args.zoom },
    {
      width,
      height,
      fitToBounds,
      padding,
    }
  );

  const imageUrl = buildStaticSnapshotUrl({
    provider,
    viewport,
    dimensions: { width, height },
    bounds: hasOverlays ? undefined : args.bounds,
    overlays: hasOverlays ? overlays : undefined,
    fitGeography,
    padding,
  });

  const markdownImage = buildMapMarkdownImage({
    imageUrl,
    label: args.label,
    viewport,
  });

  let imageBase64: string | undefined;
  let mimeType: string | undefined;

  if (args.fetchImage) {
    const referer = provider.referer?.trim() || undefined;
    const res = await fetch(imageUrl, {
      headers: provider.adapter.staticFetchHeaders(referer),
    });
    if (!res.ok) {
      throw new Error(`Map image fetch failed: ${res.status} ${res.statusText}`);
    }
    const buffer = Buffer.from(await res.arrayBuffer());
    imageBase64 = buffer.toString('base64');
    mimeType = res.headers.get('content-type') ?? 'image/png';
  }

  const hostUrl =
    args.includeHostUrl && args.hostBaseUrl
      ? buildMapHostUrl({
          hostBaseUrl: args.hostBaseUrl,
          viewport,
          style: provider.adapter.defaultStyle,
          theme: args.theme,
          provider: provider.id,
        })
      : undefined;

  const summary = frameRegion
    ? args.label
      ? `Map of ${args.label}.`
      : 'Regional map view.'
    : args.label
      ? `Map centered on ${args.label}.`
      : `Map centered at ${args.lat.toFixed(4)}, ${args.lng.toFixed(4)}.`;

  const markdown = [
    args.label ? `### ${args.label}` : undefined,
    summary,
    markdownImage,
    hostUrl ? `**Interactive map:** ${hostUrl}` : undefined,
  ]
    .filter(Boolean)
    .join('\n\n');

  return {
    summary,
    markdown,
    imageUrl,
    imageBase64,
    mimeType,
    hostUrl,
    lat: viewport.lat,
    lng: viewport.lng,
    zoom: viewport.zoom,
  };
}

export function businessMapContent(snapshot: BusinessMapSnapshot): {
  text: string;
  imageBase64?: string;
  mimeType?: string;
} {
  return {
    text: snapshot.markdown,
    imageBase64: snapshot.imageBase64,
    mimeType: snapshot.mimeType,
  };
}
