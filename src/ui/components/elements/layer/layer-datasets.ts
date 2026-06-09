/**
 * gk-layer dataset registry — CDN geo presets (state, county, dma).
 */

import { mountCountyDataset } from './layer-dataset-county';
import { mountStateDataset } from './layer-dataset-state';
import { mountDmaDataset } from './layer-dataset-dma';

export type LayerDatasetId = 'state' | 'county' | 'dma';

export type LayerDatasetMode = 'viewport' | 'slugs';

export type LayerDatasetOptions = {
  cdnBase?: string;
  lineColor?: string;
  lineWidth?: number | unknown[];
  beforeLayerId?: string;
  minzoom?: number;
  interactive?: boolean;
  visible?: boolean;
  /** DMA only */
  mode?: LayerDatasetMode;
  slugs?: string[];
  highlightSlug?: string | null;
  fillOpacity?: number;
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

const REGISTRY: Record<LayerDatasetId, LayerDatasetRunner> = {
  state: { mount: mountStateDataset },
  county: { mount: mountCountyDataset },
  dma: { mount: mountDmaDataset },
};

export function isLayerDatasetId(value: string | null | undefined): value is LayerDatasetId {
  return value === 'state' || value === 'county' || value === 'dma';
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
  const runner = REGISTRY[ctx.dataset];
  if (!runner) return null;
  return runner.mount(ctx);
}

export function unmountLayerDataset(handle: LayerDatasetHandle | null | undefined): void {
  handle?.cleanup();
}
