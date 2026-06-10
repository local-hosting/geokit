/**
 * gk-layer dataset registry — CDN geo presets (state, county, place, zip, dma).
 */

import { mountCountyDataset } from './layer-dataset-county';
import { mountPlaceDataset } from './layer-dataset-place';
import { mountStateDataset } from './layer-dataset-state';
import { mountZipDataset } from './layer-dataset-zip';
import type { AdminColorMode } from '../../../utils/admin-color-mode.js';
import { mountDmaDataset } from './layer-dataset-dma';

export type LayerDatasetId = 'state' | 'county' | 'dma' | 'place' | 'city' | 'zip';

export type LayerDatasetMode = 'viewport' | 'slugs';

export type LayerDatasetOptions = {
  cdnBase?: string;
  getRequestInit?: () => RequestInit;
  init?: RequestInit;
  lineColor?: string;
  lineWidth?: number | unknown[];
  beforeLayerId?: string;
  minzoom?: number;
  interactive?: boolean;
  visible?: boolean;
  /** Place preset — two-letter state code (e.g. tx). */
  state?: string;
  /** DMA only */
  mode?: LayerDatasetMode;
  slugs?: string[];
  highlightSlug?: string | null;
  fillOpacity?: number;
  fillColor?: string;
  outlineColor?: string;
  /** Nielsen georef region for DMA slug coloring (e.g. midwest). */
  dmaRegion?: string;
  /** outline (default), region tint (state), or dma tint (county/place). */
  colorMode?: AdminColorMode;
};

export type LayerDatasetMap = {
  getZoom?: () => number;
  getBounds?: () => {
    getWest: () => number;
    getSouth: () => number;
    getEast: () => number;
    getNorth: () => number;
  };
  getCenter?: () => { lat: number; lng: number };
  getSource?: (id: string) => { setData?: (data: GeoJSON.FeatureCollection) => void } | undefined;
  getLayer?: (id: string) => unknown;
  addSource?: (id: string, spec: Record<string, unknown>) => void;
  addLayer?: (layer: Record<string, unknown>, before?: string) => void;
  removeLayer?: (id: string) => void;
  removeSource?: (id: string) => void;
  setPaintProperty?: (layer: string, prop: string, value: unknown) => void;
  setFilter?: (layer: string, filter: unknown[] | null) => void;
  setFeatureState?: (
    target: { source: string; id: string | number },
    state: Record<string, unknown>
  ) => void;
  removeFeatureState?: (target?: { source: string; id?: string | number }) => void;
  on?: (event: string, handler: () => void) => void;
  off?: (event: string, handler: () => void) => void;
  once?: (event: string, handler: () => void) => void;
};

export type LayerDatasetContext = {
  map: LayerDatasetMap;
  element: HTMLElement;
  dataset: LayerDatasetId;
  options: LayerDatasetOptions;
  getRequestInit?: () => RequestInit;
};

export type LayerDatasetHandle = {
  sourceId: string;
  layerId: string;
  hitLayerIds?: string[];
  cleanup: () => void;
  update?: (partial: Partial<LayerDatasetOptions>) => void;
};

export type LayerDatasetReadyDetail = {
  dataset: LayerDatasetId;
  sourceId: string;
  layerId: string;
  featureCount?: number;
};

type LayerDatasetRunner = {
  mount: (ctx: LayerDatasetContext) => Promise<LayerDatasetHandle | null>;
};

const REGISTRY: Record<'state' | 'county' | 'dma' | 'place' | 'zip', LayerDatasetRunner> = {
  state: { mount: mountStateDataset },
  county: { mount: mountCountyDataset },
  dma: { mount: mountDmaDataset },
  place: { mount: mountPlaceDataset },
  zip: { mount: mountZipDataset },
};

export function isLayerDatasetId(value: string | null | undefined): value is LayerDatasetId {
  return (
    value === 'state' ||
    value === 'county' ||
    value === 'dma' ||
    value === 'place' ||
    value === 'city' ||
    value === 'zip'
  );
}

export function resolveLayerDatasetId(
  value: string | null | undefined
): 'state' | 'county' | 'dma' | 'place' | 'zip' | null {
  if (value === 'city') return 'place';
  if (
    value === 'state' ||
    value === 'county' ||
    value === 'dma' ||
    value === 'place' ||
    value === 'zip'
  ) {
    return value;
  }
  return null;
}

export function parseLayerDatasetSlugs(raw: string | null | undefined): string[] | undefined {
  if (!raw?.trim()) return undefined;
  const slugs = raw
    .split(',')
    .map((slug) => slug.trim().toLowerCase())
    .filter(Boolean);
  return slugs.length > 0 ? slugs : undefined;
}

export async function mountLayerDataset(
  ctx: LayerDatasetContext
): Promise<LayerDatasetHandle | null> {
  const resolved = resolveLayerDatasetId(ctx.dataset);
  if (!resolved) return null;
  const runner = REGISTRY[resolved];
  if (!runner) return null;
  return runner.mount({ ...ctx, dataset: resolved });
}

export function unmountLayerDataset(handle: LayerDatasetHandle | null | undefined): void {
  handle?.cleanup();
}
