/**
 * County viewport loader — `/cell/{cellId}.json` (`layers.county`).
 */

import { createCellLayerLoader } from './cell-layers';
import type { CellLayerViewport } from '../utils/h3/viewport';
import type { GlobeCdnFetchOptions } from './fetch';

/** Minimum map zoom before county H3 shards load. */
export const COUNTY_H3_MIN_ZOOM = 5;

export type CountyH3ClusterLoaderOptions = GlobeCdnFetchOptions & {
  getRequestInit?: () => RequestInit;
};

/** r3 @ z5–11, r4 @ z12+ — county shapes publish at r3+ on CDN. */
export function countyH3ResolutionForZoom(zoom: number): number | null {
  if (zoom < COUNTY_H3_MIN_ZOOM) return null;
  if (zoom < 12) return 3;
  return 4;
}

export const COUNTY_H3_MAX_CELLS: Record<number, number> = {
  3: 24,
  4: 48,
};

function countyFipsId(feature: GeoJSON.Feature): string | null {
  const fips = String(
    (feature.properties as { fips?: string } | undefined)?.fips ?? feature.id ?? ''
  )
    .trim()
    .padStart(5, '0');
  return fips || null;
}

export function createCountyH3ClusterLoader(options: CountyH3ClusterLoaderOptions = {}) {
  const cellLoader = createCellLayerLoader(options);

  async function loadCountiesForViewport(
    viewport: CellLayerViewport,
    target: Map<string, GeoJSON.Feature>,
    loadOptions?: {
      onShardMerged?: (detail: { cellId: string; featureCount: number }) => void;
    }
  ) {
    return cellLoader.loadLayerForViewport({
      viewport,
      layer: 'county',
      target,
      getFeatureId: countyFipsId,
      onShardMerged: loadOptions?.onShardMerged,
    });
  }

  return { loadCountiesForViewport, countyH3ResolutionForZoom };
}

export function clearCountyH3ClusterCache(_baseUrl?: string): void {
  /* cell bundle cache lives in cell-layers */
}
