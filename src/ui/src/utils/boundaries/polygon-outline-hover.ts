/**
 * Polygon outline layers with optional feature-state hover.
 */
import { getFeatureId } from '@local-hosting/geokit/core/geojson';
import { BOUNDARY_LINE_GEOJSON_SOURCE_OPTIONS } from '../map-surface/geojson-source-options';
import {
  buildOpacityWithHoverExpression,
  createHoverStateHandlers,
  type MapWithFeatureState,
} from '../map-surface/feature-state-hover';

export const POLYGON_HOVER_PROMOTE_ID = 'gkHoverId';
export const POLYGON_HOVER_LABEL_KEY = 'gkHoverLabel';

const DEFAULT_ID_PROPERTIES = ['id', 'slug', 'fips', 'geoid', 'cellId', 'state', 'code', 'name'];
const DEFAULT_LABEL_PROPERTIES = ['name', 'slug', 'fips', 'geoid', 'cellId', 'state', 'code', 'id'];

export type PolygonOutlineHoverOptions = {
  sourceId: string;
  lineColor?: string;
  fillOpacity?: number;
  fillHoverOpacity?: number;
  lineOpacity?: number;
  lineHoverOpacity?: number;
  promoteId?: string;
  idProperties?: string[];
  labelProperties?: string[];
  hover?: boolean;
  tooltip?: boolean;
  sourceOptions?: Record<string, unknown>;
  beforeLayerId?: string;
};

type OutlineLayerIds = {
  sourceId: string;
  fillLayerId: string;
  lineLayerId: string;
};

const hoverTeardownByMap = new WeakMap<object, Map<string, () => void>>();
let tooltipEl: HTMLDivElement | null = null;

function outlineFillLayerId(sourceId: string): string {
  return `${sourceId}-fill`;
}

function outlineLineLayerId(sourceId: string): string {
  return `${sourceId}-line`;
}

function resolveFeatureLabel(
  properties: Record<string, unknown> | null | undefined,
  labelProperties: string[]
): string {
  if (!properties) return 'feature';
  for (const key of labelProperties) {
    const value = properties[key];
    if (value != null && String(value).trim()) return String(value).trim();
  }
  return 'feature';
}

export function preparePolygonOutlineGeoJson(
  geojson: GeoJSON.Feature | GeoJSON.FeatureCollection,
  options: Pick<PolygonOutlineHoverOptions, 'promoteId' | 'idProperties' | 'labelProperties'> = {}
): GeoJSON.FeatureCollection {
  const promoteId = options.promoteId ?? POLYGON_HOVER_PROMOTE_ID;
  const idProperties = options.idProperties ?? DEFAULT_ID_PROPERTIES;
  const labelProperties = options.labelProperties ?? DEFAULT_LABEL_PROPERTIES;
  const input =
    geojson.type === 'FeatureCollection'
      ? geojson
      : { type: 'FeatureCollection' as const, features: [geojson] };

  const features = (input.features ?? []).map((feature, index) => {
    const properties = feature.properties ?? {};
    const hoverId =
      properties[promoteId] != null
        ? String(properties[promoteId])
        : getFeatureId(feature as GeoJSON.Feature, idProperties) ?? `feature-${index}`;
    const hoverLabel = resolveFeatureLabel(properties, labelProperties);
    return {
      ...feature,
      properties: {
        ...properties,
        [promoteId]: hoverId,
        [POLYGON_HOVER_LABEL_KEY]: hoverLabel,
      },
    };
  });

  return { type: 'FeatureCollection', features };
}

function getTooltipElement(): HTMLDivElement {
  if (!tooltipEl) {
    tooltipEl = document.createElement('div');
    tooltipEl.className = 'gk-polygon-hover-tooltip';
    tooltipEl.hidden = true;
    document.body.appendChild(tooltipEl);
  }
  return tooltipEl;
}

function showTooltip(label: string, event: MouseEvent): void {
  const tooltip = getTooltipElement();
  tooltip.textContent = label;
  tooltip.hidden = false;
  moveTooltip(event);
}

function moveTooltip(event: MouseEvent): void {
  const tooltip = getTooltipElement();
  if (tooltip.hidden) return;
  tooltip.style.left = `${event.clientX + 12}px`;
  tooltip.style.top = `${event.clientY + 12}px`;
}

function hideTooltip(): void {
  if (!tooltipEl) return;
  tooltipEl.hidden = true;
}

export function wirePolygonOutlineHover(
  map: MapWithLayers,
  options: Pick<PolygonOutlineHoverOptions, 'sourceId' | 'promoteId' | 'tooltip' | 'hover'>
): () => void {
  const sourceId = options.sourceId;
  const promoteId = options.promoteId ?? POLYGON_HOVER_PROMOTE_ID;
  const fillId = outlineFillLayerId(sourceId);
  const enableHover = options.hover !== false;
  const enableTooltip = options.tooltip !== false && enableHover;

  if (!enableHover || !map.on || !map.off) {
    return () => {};
  }

  const bound = hoverTeardownByMap.get(map) ?? new Map<string, () => void>();
  bound.get(sourceId)?.();
  hoverTeardownByMap.set(map, bound);

  const handlers = createHoverStateHandlers({
    map,
    getSourceId: () => sourceId,
    getFeatureId: (event) => {
      const id = event.features?.[0]?.properties?.[promoteId];
      return id != null ? String(id) : null;
    },
  });

  const onEnter = (event: {
    features?: Array<{ properties?: Record<string, unknown> }>;
    originalEvent?: MouseEvent;
  }) => {
    handlers.onMouseEnter(event);
    if (!enableTooltip || !event.originalEvent) return;
    const label = event.features?.[0]?.properties?.[POLYGON_HOVER_LABEL_KEY];
    if (label != null) showTooltip(String(label), event.originalEvent);
  };

  const onMove = (event: { originalEvent?: MouseEvent }) => {
    if (event.originalEvent) moveTooltip(event.originalEvent);
  };

  const onLeave = () => {
    handlers.onMouseLeave();
    hideTooltip();
  };

  map.on('mouseenter', fillId, onEnter);
  map.on('mousemove', fillId, onMove);
  map.on('mouseleave', fillId, onLeave);

  const teardown = () => {
    map.off?.('mouseenter', fillId, onEnter);
    map.off?.('mousemove', fillId, onMove);
    map.off?.('mouseleave', fillId, onLeave);
    handlers.onMouseLeave();
    hideTooltip();
    bound.delete(sourceId);
  };

  bound.set(sourceId, teardown);
  return teardown;
}

type MapWithLayers = MapWithFeatureState & {
  getSource?: (id: string) => { setData?: (data: GeoJSON.FeatureCollection) => void } | undefined;
  addSource?: (id: string, source: Record<string, unknown>) => void;
  addLayer?: (layer: Record<string, unknown>, before?: string) => void;
  getLayer?: (id: string) => unknown;
  on?: (event: string, layerId: string, handler: (...args: never[]) => void) => void;
  off?: (event: string, layerId: string, handler: (...args: never[]) => void) => void;
};

function addOutlineLayers(
  map: MapWithLayers,
  data: GeoJSON.FeatureCollection,
  options: Required<
    Pick<
      PolygonOutlineHoverOptions,
      | 'sourceId'
      | 'lineColor'
      | 'fillOpacity'
      | 'fillHoverOpacity'
      | 'lineOpacity'
      | 'lineHoverOpacity'
      | 'promoteId'
      | 'hover'
      | 'sourceOptions'
      | 'beforeLayerId'
    >
  >
): OutlineLayerIds {
  const ids = {
    sourceId: options.sourceId,
    fillLayerId: outlineFillLayerId(options.sourceId),
    lineLayerId: outlineLineLayerId(options.sourceId),
  };

  map.addSource?.(options.sourceId, {
    type: 'geojson',
    data,
    promoteId: options.promoteId,
    ...BOUNDARY_LINE_GEOJSON_SOURCE_OPTIONS,
    ...options.sourceOptions,
  });

  const before =
    options.beforeLayerId && map.getLayer?.(options.beforeLayerId)
      ? options.beforeLayerId
      : undefined;

  const lineWidth = options.hover
    ? [
        'interpolate',
        ['linear'],
        ['zoom'],
        3,
        ['case', ['boolean', ['feature-state', 'hover'], false], 1.5, 0.5],
        8,
        ['case', ['boolean', ['feature-state', 'hover'], false], 2.5, 1],
        12,
        ['case', ['boolean', ['feature-state', 'hover'], false], 3.5, 1.5],
      ]
    : ['interpolate', ['linear'], ['zoom'], 3, 0.5, 8, 1, 12, 1.5];

  const lineOpacity = options.hover
    ? buildOpacityWithHoverExpression(options.lineOpacity, options.lineHoverOpacity)
    : options.lineOpacity;

  const fillOpacity = options.hover
    ? buildOpacityWithHoverExpression(options.fillOpacity, options.fillHoverOpacity)
    : options.fillOpacity;

  map.addLayer?.(
    {
      id: ids.lineLayerId,
      type: 'line',
      source: options.sourceId,
      paint: {
        'line-color': options.lineColor,
        'line-width': lineWidth,
        'line-opacity': lineOpacity,
      },
    },
    before
  );

  map.addLayer?.(
    {
      id: ids.fillLayerId,
      type: 'fill',
      source: options.sourceId,
      paint: {
        'fill-color': options.lineColor,
        'fill-opacity': fillOpacity,
      },
    },
    before
  );

  return ids;
}

export function upsertPolygonOutlineLayer(
  map: MapWithLayers,
  geojson: GeoJSON.Feature | GeoJSON.FeatureCollection,
  options: PolygonOutlineHoverOptions
): OutlineLayerIds {
  const resolved = {
    sourceId: options.sourceId,
    lineColor: options.lineColor ?? '#000000',
    fillOpacity: options.fillOpacity ?? 0.04,
    fillHoverOpacity: options.fillHoverOpacity ?? 0.22,
    lineOpacity: options.lineOpacity ?? 0.65,
    lineHoverOpacity: options.lineHoverOpacity ?? 1,
    promoteId: options.promoteId ?? POLYGON_HOVER_PROMOTE_ID,
    hover: options.hover !== false,
    sourceOptions: options.sourceOptions ?? {},
    beforeLayerId: options.beforeLayerId ?? '',
  };

  const data = preparePolygonOutlineGeoJson(geojson, options);
  const existing = map.getSource?.(resolved.sourceId) as
    | { setData?: (next: GeoJSON.FeatureCollection) => void }
    | undefined;

  if (existing?.setData) {
    existing.setData(data);
    wirePolygonOutlineHover(map, {
      sourceId: resolved.sourceId,
      promoteId: resolved.promoteId,
      hover: resolved.hover,
      tooltip: options.tooltip,
    });
    return {
      sourceId: resolved.sourceId,
      fillLayerId: outlineFillLayerId(resolved.sourceId),
      lineLayerId: outlineLineLayerId(resolved.sourceId),
    };
  }

  const ids = addOutlineLayers(map, data, resolved);
  wirePolygonOutlineHover(map, {
    sourceId: resolved.sourceId,
    promoteId: resolved.promoteId,
    hover: resolved.hover,
    tooltip: options.tooltip,
  });
  return ids;
}
