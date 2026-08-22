/**
 * Declarative map layer stacks — what to show on gk-map via gk-layer elements.
 * Dataset ids are opaque strings registered by the host app (e.g. territory, region).
 */

export type MapLayerDataset = string;

/** Default outline colors for dataviz-dark basemaps. */
export const MAP_STATE_LINE_COLOR = 'rgba(0, 0, 0, 0.08)';
export const MAP_COUNTY_LINE_COLOR = 'rgba(255, 255, 255, 0.22)';

export type MapLayerMode = 'viewport' | 'slugs';

export interface MapLayerSpec {
  dataset: MapLayerDataset;
  enabled?: boolean;
  interactive?: boolean;
  lineColor?: string;
  minzoom?: number;
  /** Place / city preset — admin code (e.g. two-letter state). */
  state?: string;
  mode?: MapLayerMode;
  slugs?: string;
  highlightSlug?: string;
  fillOpacity?: number;
  colorMode?: 'outline' | 'region' | 'dma';
  /** Passthrough region attr for slug-mode choropleth fills (gk-layer attribute). */
  region?: string;
}

export interface MapDisplaySpec {
  id: string;
  center: { lat: number; lng: number };
  zoom: number;
  minZoom?: number;
  maxZoom?: number;
  maxBearing?: number;
  layers: MapLayerSpec[];
}

export function enabledLayers(spec: MapDisplaySpec): MapLayerSpec[] {
  return spec.layers.filter((layer) => layer.enabled !== false);
}

export function enabledLayerSpecs(layers: MapLayerSpec[]): MapLayerSpec[] {
  return layers.filter((layer) => layer.enabled !== false);
}

export function displayUsesDataset(
  spec: MapDisplaySpec,
  dataset: MapLayerDataset
): boolean {
  return enabledLayers(spec).some((layer) => layer.dataset === dataset);
}

export function cardMapDisplay(options: {
  slug: string;
  center: { lat: number; lng: number };
  zoom?: number;
  dataset: MapLayerDataset;
  showDataset?: boolean;
  highlightSlug?: string | null;
  region?: string | null;
}): MapDisplaySpec {
  return {
    id: `card-${options.slug}`,
    center: options.center,
    zoom: options.zoom ?? 7,
    minZoom: 2,
    maxZoom: 22,
    maxBearing: 0,
    layers: cardMapLayers(options),
  };
}

export function cardMapLayers(options: {
  slug: string;
  dataset: MapLayerDataset;
  showDataset?: boolean;
  highlightSlug?: string | null;
  region?: string | null;
}): MapLayerSpec[] {
  const show = options.showDataset !== false;
  const region = options.region?.trim().toLowerCase();
  return [
    {
      dataset: options.dataset,
      mode: 'slugs',
      slugs: options.slug,
      highlightSlug: options.highlightSlug ?? undefined,
      fillOpacity: 0.28,
      region: region && region !== 'unknown' ? region : undefined,
      enabled: show,
    },
  ];
}

export function heroMapLayers(options: {
  dataset: MapLayerDataset;
  showDataset?: boolean;
  highlightSlug?: string | null;
  includeAdminOutlines?: boolean;
}): MapLayerSpec[] {
  const show = options.showDataset !== false;
  const admin: MapLayerSpec[] =
    options.includeAdminOutlines === false
      ? []
      : [
          {
            dataset: 'county',
            minzoom: 5,
            lineColor: MAP_COUNTY_LINE_COLOR,
          },
          {
            dataset: 'state',
            lineColor: MAP_STATE_LINE_COLOR,
            interactive: true,
          },
        ];
  return [
    ...admin,
    {
      dataset: options.dataset,
      mode: 'viewport',
      fillOpacity: 0.28,
      interactive: true,
      highlightSlug: options.highlightSlug ?? undefined,
      enabled: show,
    },
  ];
}

/** Map a layer spec to gk-layer HTML attributes (framework-agnostic). */
export function mapLayerSpecToGkLayerAttrs(spec: MapLayerSpec): Record<string, string | boolean | undefined> {
  return {
    'layer-dataset': spec.dataset,
    mode: spec.mode,
    slugs: spec.slugs,
    'highlight-slug': spec.highlightSlug,
    'fill-opacity': spec.fillOpacity != null ? String(spec.fillOpacity) : undefined,
    'line-color': spec.lineColor,
    'color-mode': spec.colorMode,
    minzoom: spec.minzoom != null ? String(spec.minzoom) : undefined,
    state: spec.state,
    region: spec.region,
    interactive: spec.interactive ? true : undefined,
  };
}
