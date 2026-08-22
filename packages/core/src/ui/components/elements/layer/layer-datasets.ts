/**
 * gk-layer dataset registry — host app registers mounts via registerLayerDatasetMount() at boot.
 */

import { resolveLayerDatasetMount } from '../../../../utils/geojson-loader/registry.js';

/** Opaque dataset id — apps register mounts (e.g. custom id) at bootstrap. */
export type LayerDatasetId = string;

export type LayerDatasetMode = 'viewport' | 'slugs';

export type LayerDatasetOptions = {
  /** Fetch origin override — app-defined (app-defined). */
  baseUrl?: string;
  getRequestInit?: () => RequestInit;
  init?: RequestInit;
  lineColor?: string;
  lineWidth?: number | unknown[];
  beforeLayerId?: string;
  minzoom?: number;
  interactive?: boolean;
  visible?: boolean;
  mode?: LayerDatasetMode;
  slugs?: string[];
  highlightSlug?: string | null;
  fillOpacity?: number;
  fillColor?: string;
  outlineColor?: string;
  /** App-specific attrs from gk-layer markup (app attrs, dark-variant, …). */
  attrs?: Record<string, string>;
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

const DATASET_ATTR_ALIASES: Record<string, string> = {
  place: 'city',
};

export function normalizeLayerDatasetId(
  value: string | null | undefined
): LayerDatasetId | null {
  const trimmed = value?.trim().toLowerCase();
  if (!trimmed) return null;
  return DATASET_ATTR_ALIASES[trimmed] ?? trimmed;
}

/** @deprecated use normalizeLayerDatasetId */
export function resolveLayerDatasetId(value: string | null | undefined): LayerDatasetId | null {
  return normalizeLayerDatasetId(value);
}

/** @deprecated use normalizeLayerDatasetId */
export function isLayerDatasetId(value: string | null | undefined): value is LayerDatasetId {
  return normalizeLayerDatasetId(value) !== null;
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
  const resolved = normalizeLayerDatasetId(ctx.dataset);
  if (!resolved) return null;
  const mount = resolveLayerDatasetMount(resolved);
  if (!mount) {
    console.warn(
      `[gk-layer] no dataset mount registered for "${resolved}" — call registerLayerDatasetMount() from your app bootstrap`
    );
    return null;
  }
  return mount({ ...ctx, dataset: resolved });
}

export function unmountLayerDataset(handle: LayerDatasetHandle | null | undefined): void {
  handle?.cleanup();
}

export {
  registerLayerDatasetMount,
  unregisterLayerDatasetMount,
  clearLayerDatasetMounts,
} from '../../../../utils/geojson-loader/registry.js';
