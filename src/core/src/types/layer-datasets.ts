/**
 * gk-layer dataset registry types. The loader lives in `@twinfile/geokit/ui/geojson-loader`.
 */

export type LayerDatasetId = string;

export type LayerDatasetMode = 'viewport' | 'slugs';

export type LayerDatasetOptions = {
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
  /** When set, highlighted DMA uses this color (e.g. selected venue dot). */
  highlightColor?: string | null;
  fillOpacity?: number;
  fillColor?: string;
  outlineColor?: string;
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
