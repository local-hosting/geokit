import type { MapStaticProviderId } from '../types/map-static-provider.js';
import type { MapStyleId } from '../types/mcp-map.js';
import { getDMAColor, getRegionColor } from '../ui/utils/dma-colors.js';
import type { MapHostRegionLayer } from '../types/mcp-map.js';
import type { MapRegionPathStyle } from './region-path.js';

/** Default MCP map chrome — matches static snapshot + interactive host. */
export const MCP_MAP_THEME = 'dark' as const;

export const MCP_MAP_STYLE_MAPTILER: MapStyleId = 'dataviz-dark';
export const MCP_MAP_STYLE_MAPBOX: MapStyleId = 'dark-v11';

/** Static path overlay for regional boundaries (hex encoded for MapTiler path URLs). */
export const MCP_REGION_OVERLAY_STYLE: MapRegionPathStyle = {
  fill: '%233b82f655',
  stroke: '%231d4ed8',
  width: 4,
};

/** Interactive gk-layer dma styling aligned with MCP_REGION_OVERLAY_STYLE. */
export const MCP_DMA_LAYER_FILL_COLOR = '#3b82f6';
export const MCP_DMA_LAYER_OUTLINE_COLOR = '#1d4ed8';
export const MCP_DMA_LAYER_FILL_OPACITY = 0.33;
export const MCP_DMA_LAYER_LINE_WIDTH = 4;

export function defaultMcpMapStyle(providerId: MapStaticProviderId): MapStyleId {
  return providerId === 'mapbox' ? MCP_MAP_STYLE_MAPBOX : MCP_MAP_STYLE_MAPTILER;
}

export function resolveMcpMapTheme(explicit?: unknown): 'light' | 'dark' {
  if (explicit === 'light') return 'light';
  if (explicit === 'dark') return 'dark';
  return MCP_MAP_THEME;
}

function hexToPathColor(hex: string, alphaHex = 'cc'): string {
  const normalized = hex.replace('#', '').trim();
  return `%23${normalized}${alphaHex}`;
}

/** Hex fill/stroke for interactive gk-layer and static path overlays. */
export function resolveMcpRegionHexColors(args?: {
  regionLayer?: MapHostRegionLayer;
  dmaSlug?: string;
  region?: string;
}): { fill: string; stroke: string } {
  const slug =
    args?.dmaSlug ?? (args?.regionLayer?.dataset === 'dma' ? args.regionLayer.slug : undefined);
  const region =
    args?.region ??
    (args?.regionLayer?.dataset === 'dma' ? args.regionLayer.region : undefined) ??
    'unknown';
  if (slug) {
    const hex = getDMAColor(slug, region, { darkVariant: true });
    return { fill: hex, stroke: hex };
  }
  return { fill: MCP_DMA_LAYER_FILL_COLOR, stroke: MCP_DMA_LAYER_OUTLINE_COLOR };
}

export function resolveMcpRegionPathStyle(args?: {
  regionLayer?: MapHostRegionLayer;
  dmaSlug?: string;
  region?: string;
}): MapRegionPathStyle {
  const slug =
    args?.dmaSlug ?? (args?.regionLayer?.dataset === 'dma' ? args.regionLayer.slug : undefined);
  const region =
    args?.region ??
    (args?.regionLayer?.dataset === 'dma' ? args.regionLayer.region : undefined) ??
    'unknown';
  const fillHex = slug ? getDMAColor(slug, region, { darkVariant: true }) : getRegionColor(region);
  const strokeHex = slug
    ? getDMAColor(slug, region, { darkVariant: true })
    : getRegionColor(region);
  return {
    fill: hexToPathColor(fillHex, '55'),
    stroke: hexToPathColor(strokeHex, 'ff'),
    width: MCP_REGION_OVERLAY_STYLE.width,
  };
}
