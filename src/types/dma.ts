import type { ViewportBounds } from '../utils/h3/viewport';

/** West, south, east, north — WGS84 degrees. */
export type DmaRegionBbox = [west: number, south: number, east: number, north: number];

export type DmaRegionClusterIndexEntry = {
  regionId: string;
  url: string;
  marketCount: number;
  bytes?: number;
  markets?: string[];
  /** Shard footprint for viewport intersection (CDN index v1+). */
  bbox?: DmaRegionBbox;
};

export type DmaRegionClusterIndex = {
  version: 1;
  regions: string;
  resolution: number;
  entries: DmaRegionClusterIndexEntry[];
  h3CellRegions: Record<string, string>;
};

export type DmaCatalogEntry = {
  slug: string;
  region: string;
};

export type ViewportRegionResolveOptions = {
  bounds?: ViewportBounds;
  centerLat?: number;
  centerLng?: number;
};

export type DmaMarketCellsIndex = {
  marketCells: Record<string, string[]>;
  cellToDma: Map<string, string>;
  dmaSlugs: string[];
};

/** GeoJSON slug for viewport H3 cells with no marketCells DMA assignment. */
export const H3_DMA_UNASSIGNED_SLUG = '__grid__';

export type { ViewportBounds };
