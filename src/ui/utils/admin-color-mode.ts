/**
 * Admin outline choropleth modes — DMA-tinted county/place, regional state fill.
 */

import { dmaRegionIndexUrl } from '../../cdn/paths.js';
import { fetchGlobeCdnJson } from '../../cdn/fetch.js';
import { fetchDmaMarketCatalog } from '../../cdn/dma-catalog.js';
import { dmaCatalogEntriesFromRegionIndex } from '../../cdn/dma-regions.js';
import type { DmaRegionClusterIndex } from '../../types/dma.js';
import {
  ADMIN_DMA_FILL_OPACITY,
  ADMIN_REGION_FILL_OPACITY,
  buildAdminDmaSlugColorExpression,
  buildAdminRegionColorExpression,
  type DmaMarketColorInput,
} from './dma-colors.js';

export type AdminColorMode = 'outline' | 'region' | 'dma';

export function parseAdminColorMode(raw: string | null | undefined): AdminColorMode | undefined {
  if (raw === 'outline' || raw === 'region' || raw === 'dma') return raw;
  return undefined;
}

export function defaultAdminColorMode(
  dataset: 'state' | 'county' | 'place' | 'city' | 'zip'
): AdminColorMode | undefined {
  if (dataset === 'state') return 'region';
  if (dataset === 'county' || dataset === 'place' || dataset === 'city') return 'dma';
  return undefined;
}

export type AdminFillPaint = {
  fillColor: string | unknown[];
  fillOpacity: number;
};

export async function fetchDmaColorCatalog(options: {
  cdnBase?: string;
  init?: RequestInit;
}): Promise<DmaMarketColorInput[]> {
  const url = dmaRegionIndexUrl(options.cdnBase ?? '');
  try {
    const index = await fetchGlobeCdnJson<DmaRegionClusterIndex>(url, options);
    if (index?.entries?.length) {
      return dmaCatalogEntriesFromRegionIndex(index).map(({ slug, region }) => ({ slug, region }));
    }
  } catch {
    /* fall through to market catalog */
  }

  const market = await fetchDmaMarketCatalog({ baseUrl: options.cdnBase, init: options.init });
  if (!market?.entries?.length) return [];
  return market.entries.map((entry) => ({
    slug: entry.slug.trim().toLowerCase(),
    region: entry.region?.trim().toLowerCase() || 'unknown',
  }));
}

export async function resolveAdminFillPaint(args: {
  colorMode?: AdminColorMode;
  fillOpacity?: number;
  cdnBase?: string;
  getRequestInit?: () => RequestInit;
}): Promise<AdminFillPaint | null> {
  const mode = args.colorMode ?? 'outline';
  if (mode === 'outline') return null;

  if (mode === 'region') {
    return {
      fillColor: buildAdminRegionColorExpression(),
      fillOpacity: args.fillOpacity ?? ADMIN_REGION_FILL_OPACITY,
    };
  }

  const catalog = await fetchDmaColorCatalog({
    cdnBase: args.cdnBase,
    init: args.getRequestInit?.(),
  });

  return {
    fillColor:
      catalog.length > 0
        ? buildAdminDmaSlugColorExpression(catalog)
        : buildAdminRegionColorExpression(),
    fillOpacity: args.fillOpacity ?? ADMIN_DMA_FILL_OPACITY,
  };
}
