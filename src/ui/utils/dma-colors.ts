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

export function buildDmaSlugColorExpression(
  markets: readonly DmaMarketColorInput[],
  options?: {
    marketSlug?: string | null;
    solidColor?: string;
    fallbackNeutral?: string;
  }
): string | unknown[] {
  if (options?.solidColor) {
    return options.solidColor;
  }

  const fallback = options?.fallbackNeutral ?? DMA_FALLBACK_NEUTRAL;
  const match: unknown[] = ['match', ['get', 'slug']];
  const seen = new Set<string>();

  for (const item of markets) {
    const slug = normalizeDmaSlug(item.slug);
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);
    const region = item.region?.trim().toLowerCase() || 'unknown';
    match.push(slug, getDMAColor(slug, region, { fallbackNeutral: fallback }));
  }

  match.push(DMA_H2_UNASSIGNED_SLUG, DMA_H2_GRID_FILL);
  match.push(fallback);
  return match;
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
