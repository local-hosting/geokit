/**
 * Deterministic Nielsen DMA colors and MapLibre paint expressions.
 */

export const DMA_H2_UNASSIGNED_SLUG = '__grid__';
export const DMA_H2_GRID_FILL = '#4a5568';
export const DMA_FALLBACK_NEUTRAL = '#666666';

const REGION_BASE_HUES: Record<string, number> = {
  west: 0,
  northwest: 200,
  'texas-la': 40,
  midwest: 270,
  'great-lakes': 120,
  southeast: 320,
  'mid-south': 160,
  northeast: 50,
  ny: 230,
  nyc: 230,
  south: 90,
  unknown: 0,
};

const REGION_HUE_SPAN = 32;

export function hslToHex(h: number, s: number, l: number): string {
  h /= 360;
  s /= 100;
  l /= 100;

  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h * 12) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, '0');
  };

  return `#${f(0)}${f(8)}${f(4)}`;
}

export function getRegionColor(region: string | undefined | null): string {
  const normalizedRegion = (region || 'unknown').toLowerCase();
  const hue = REGION_BASE_HUES[normalizedRegion] ?? REGION_BASE_HUES.unknown!;
  return hslToHex(hue, 75, 65);
}

export type DmaColorOptions = {
  darkVariant?: boolean;
  fallbackNeutral?: string;
};

/** Deterministic DMA fill color from slug + georef region. */
export function getDMAColor(
  slug: string | undefined | null,
  region = 'unknown',
  options: DmaColorOptions = {}
): string {
  const fallback = options.fallbackNeutral ?? DMA_FALLBACK_NEUTRAL;
  if (!slug) return fallback;

  const slugNorm = String(slug).toLowerCase().trim();
  if (slugNorm === 'mixed') return '#8b949e';

  const normalizedRegion = (region || 'unknown').toLowerCase();
  const baseHue = REGION_BASE_HUES[normalizedRegion] ?? REGION_BASE_HUES.unknown!;

  let hash = 2166136261;
  for (let i = 0; i < slug.length; i++) {
    hash ^= slug.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x85ebca6b);
  hash ^= hash >>> 13;
  hash = Math.imul(hash, 0xc2b2ae35);
  hash ^= hash >>> 16;
  hash = hash >>> 0;

  let hue: number;
  if (normalizedRegion === 'unknown') {
    hue = hash % 360;
  } else {
    const offset = (hash % (REGION_HUE_SPAN * 100)) / 100 - REGION_HUE_SPAN / 2;
    hue = (baseHue + offset + 360) % 360;
  }

  const saturation = 60 + ((hash >>> 8) % 30);
  const lightness = options.darkVariant ? 38 + ((hash >>> 16) % 14) : 55 + ((hash >>> 16) % 20);

  return hslToHex(hue, saturation, lightness);
}

export type DmaMarketColorInput = {
  slug: string;
  region?: string;
};

function normalizeDmaSlug(slug: string): string {
  return slug.trim().toLowerCase();
}

export function buildDmaRegionColorExpression(fallback = DMA_FALLBACK_NEUTRAL): unknown[] {
  const match: unknown[] = ['match', ['get', 'region']];
  for (const region of Object.keys(REGION_BASE_HUES)) {
    if (region === 'unknown') continue;
    match.push(region, getRegionColor(region));
  }
  match.push(fallback);
  return match;
}

export type AdminColorProperty = 'slug' | 'dmaSlug' | 'region';

export const ADMIN_DMA_FILL_OPACITY = 0.12;
export const ADMIN_REGION_FILL_OPACITY = 0.08;

function buildPropertyMatchColorExpression(
  property: AdminColorProperty,
  markets: readonly DmaMarketColorInput[],
  options?: {
    marketSlug?: string | null;
    solidColor?: string;
    fallbackNeutral?: string;
    valueForMarket?: (slug: string, region: string) => string;
  }
): string | unknown[] {
  if (options?.solidColor) return options.solidColor;

  const fallback = options?.fallbackNeutral ?? DMA_FALLBACK_NEUTRAL;
  const match: unknown[] = ['match', ['get', property]];
  const seenKeys = new Set<string>();

  for (const item of markets) {
    const slug = normalizeDmaSlug(item.slug);
    if (!slug) continue;
    const region = item.region?.trim().toLowerCase() || 'unknown';
    const key = property === 'region' ? region : slug;
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);
    const color = options?.valueForMarket
      ? options.valueForMarket(slug, region)
      : property === 'region'
        ? getRegionColor(region)
        : getDMAColor(slug, region, { fallbackNeutral: fallback });
    match.push(key, color);
  }

  if (property === 'slug') {
    match.push(DMA_H2_UNASSIGNED_SLUG, DMA_H2_GRID_FILL);
  }
  match.push(fallback);
  return match;
}

/** MapLibre fill expression keyed on feature dmaSlug (county/place shards). */
export function buildAdminDmaSlugColorExpression(
  markets: readonly DmaMarketColorInput[],
  options?: { fallbackNeutral?: string; solidColor?: string }
): string | unknown[] {
  return buildPropertyMatchColorExpression('dmaSlug', markets, options);
}

/** MapLibre fill expression keyed on feature georef region (state shards). */
export function buildAdminRegionColorExpression(fallback = DMA_FALLBACK_NEUTRAL): unknown[] {
  return buildDmaRegionColorExpression(fallback);
}

export function buildDmaSlugColorExpression(
  markets: readonly DmaMarketColorInput[],
  options?: {
    marketSlug?: string | null;
    solidColor?: string;
    fallbackNeutral?: string;
  }
): string | unknown[] {
  return buildPropertyMatchColorExpression('slug', markets, options);
}

export function buildDmaFillOpacityExpression(
  show: boolean,
  options: {
    assignedOpacity: number;
    highlightOpacity: number;
    unassignedOpacity: number;
  }
): number | unknown[] {
  if (!show) return 0;
  return [
    'case',
    ['==', ['get', 'slug'], DMA_H2_UNASSIGNED_SLUG],
    options.unassignedOpacity,
    ['boolean', ['feature-state', 'highlight'], false],
    options.highlightOpacity,
    options.assignedOpacity,
  ];
}

const DEFAULT_DMA_HIGHLIGHT_LINE_OPACITY = 0.85;

/** Hide internal MultiPolygon rings; stroke only highlighted markets unless caller sets line-color. */
export function buildDmaLineOpacityExpression(options: {
  showAllOutlines: boolean;
  highlightOpacity?: number;
}): number | unknown[] {
  if (options.showAllOutlines) return 1;
  const highlightOpacity = options.highlightOpacity ?? DEFAULT_DMA_HIGHLIGHT_LINE_OPACITY;
  return ['case', ['boolean', ['feature-state', 'highlight'], false], highlightOpacity, 0];
}

/** Fill-layer outline on highlight — avoids a line layer that traces every county ring. */
export function buildDmaHighlightOutlineColorExpression(marketColor: unknown): unknown[] {
  return [
    'case',
    ['boolean', ['feature-state', 'highlight'], false],
    marketColor,
    'rgba(0, 0, 0, 0)',
  ];
}

export function createDMAColorMap(
  markets: readonly (string | DmaMarketColorInput)[]
): Map<string, string> {
  const colorMap = new Map<string, string>();
  for (const market of markets) {
    const slug = typeof market === 'string' ? market : market.slug;
    const region = typeof market === 'string' ? 'unknown' : market.region || 'unknown';
    colorMap.set(slug, getDMAColor(slug, region));
  }
  return colorMap;
}

/** Golden-angle palette for charts or legends (not region-anchored DMA fills). */
export function generateDMAColorPalette(dmaCount: number): string[] {
  const colors: string[] = [];
  const goldenAngle = 137.508;
  let hue = 0;

  for (let i = 0; i < dmaCount; i++) {
    const saturation = 70 + (i % 4) * 7;
    const lightness = 55 + (i % 5) * 5;
    colors.push(hslToHex(hue, saturation, lightness));
    hue = (hue + goldenAngle) % 360;
  }

  return colors;
}
