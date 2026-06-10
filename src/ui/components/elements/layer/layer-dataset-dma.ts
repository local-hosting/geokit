/**
 * DMA CDN choropleth preset — `/cell/{cellId}.json` + per-market slugs.
 */

import { mergeDmaFeaturesBySlug, dmaFeaturesToCollection } from '../../../../cdn/dma-regions';
import { resolveGlobeCdnBaseUrl } from '../../../../cdn/config';
import { fetchGlobeCdnJson } from '../../../../cdn/fetch';
import { dmaMarketShapeUrl } from '../../../../cdn/paths';
import { mapViewportBounds } from '../../../../utils/h3/map-viewport';
import { bindIncrementalViewportSync } from '../../../../cdn/viewport-shard-loader';
import { createCellLayerLoader, fetchCellLayerCatalog } from '../../../../cdn/cell-layers';
import { buildChoroplethFillPaint } from '../../../utils/choropleth-fill-paint';
import { CHOROPLETH_BOUNDARY_GEOJSON_SOURCE_OPTIONS } from '../../../utils/geojson-source-options';
import {
  buildDmaFillOpacityExpression,
  buildDmaHighlightOutlineColorExpression,
  buildDmaLineOpacityExpression,
  buildDmaRegionColorExpression,
  buildDmaSlugColorExpression,
  type DmaMarketColorInput,
} from '../../../utils/dma-colors';
import {
  findInsertBeforeLayer,
  stackGkOutlineLayersAboveDmaFill,
} from '../../../utils/layer-stack';
import type { LayerDatasetContext, LayerDatasetHandle } from './layer-datasets';

const TRANSPARENT_OUTLINE = 'rgba(0, 0, 0, 0)';
const DEFAULT_FILL_OPACITY = 0.28;
const HIGHLIGHT_FILL_OPACITY = 0.38;
const UNASSIGNED_FILL_OPACITY = 0.06;
const DEFAULT_DMA_LINE_WIDTH: unknown[] = [
  'interpolate',
  ['linear'],
  ['zoom'],
  3,
  0.5,
  6,
  0.75,
  9,
  1,
];
const HIGHLIGHT_LINE_OPACITY = 0.85;

export const DMA_DATASET_IDS = {
  sourceId: 'gk-dataset-dma',
  fillLayerId: 'gk-dataset-dma-fill',
  lineLayerId: 'gk-dataset-dma-line',
} as const;

type MapLike = NonNullable<LayerDatasetContext['map']>;

function mapZoom(map: MapLike): number {
  return (map as { getZoom?: () => number }).getZoom?.() ?? 0;
}

function waitForMapViewport(
  map: MapLike,
  timeoutMs = 5000
): Promise<ReturnType<typeof mapViewportBounds>> {
  const immediate = mapViewportBounds(map);
  if (immediate) return Promise.resolve(immediate);

  return new Promise((resolve) => {
    let settled = false;
    const finish = (viewport: ReturnType<typeof mapViewportBounds>) => {
      if (settled) return;
      settled = true;
      map.off?.('idle', onIdle);
      map.off?.('render', onRender);
      clearTimeout(timer);
      resolve(viewport);
    };

    const tryViewport = () => {
      const viewport = mapViewportBounds(map);
      if (viewport) finish(viewport);
    };

    const onIdle = () => tryViewport();
    const onRender = () => tryViewport();

    map.once?.('idle', onIdle);
    map.on?.('render', onRender);

    const timer = setTimeout(() => finish(mapViewportBounds(map)), timeoutMs);
  });
}

function findAnchorBeforeId(map: MapLike): string | undefined {
  return findInsertBeforeLayer(map, {
    matchLayer: (layer) => {
      const id = layer.id ?? '';
      return id.startsWith('venues') || id.startsWith('platform-') || id.startsWith('gk-dataset-');
    },
  });
}

function slugFilterExpression(slugs: readonly string[] | undefined): unknown[] | undefined {
  if (!slugs?.length) return undefined;
  if (slugs.length === 1) return ['==', ['get', 'slug'], slugs[0]!];
  return ['in', ['get', 'slug'], ['literal', [...slugs]]];
}

function fillOpacityExpression(visible: boolean, assignedOpacity: number): unknown[] | number {
  return buildDmaFillOpacityExpression(visible, {
    assignedOpacity,
    highlightOpacity: HIGHLIGHT_FILL_OPACITY,
    unassignedOpacity: UNASSIGNED_FILL_OPACITY,
  });
}

function dmaSlugId(feature: GeoJSON.Feature): string | null {
  const slug = String((feature.properties as { slug?: string })?.slug ?? feature.id ?? '')
    .trim()
    .toLowerCase();
  return slug || null;
}

async function loadDmaMarketShapes(
  slugs: readonly string[],
  target: Map<string, GeoJSON.Feature>,
  options: { cdnBase?: string; getRequestInit?: () => RequestInit }
): Promise<number> {
  let added = 0;
  await Promise.all(
    slugs.map(async (raw) => {
      const slug = raw.trim().toLowerCase();
      if (!slug) return;
      const url = dmaMarketShapeUrl(resolveGlobeCdnBaseUrl(options.cdnBase), slug);
      try {
        const payload = await fetchGlobeCdnJson<GeoJSON.Feature | GeoJSON.FeatureCollection>(url, {
          baseUrl: options.cdnBase,
          init: options.getRequestInit?.(),
        });
        if (!payload) return;
        if (payload.type === 'FeatureCollection') {
          added += mergeDmaFeaturesBySlug(target, payload);
          return;
        }
        if (payload.type === 'Feature') {
          added += mergeDmaFeaturesBySlug(target, {
            type: 'FeatureCollection',
            features: [payload],
          });
        }
      } catch {
        /* market shard unavailable */
      }
    })
  );
  return added;
}

export async function mountDmaDataset(
  ctx: LayerDatasetContext
): Promise<LayerDatasetHandle | null> {
  const { map, options, getRequestInit, element } = ctx;
  const mode = options.mode ?? 'viewport';
  const slugs = options.slugs;
  const baseUrl = resolveGlobeCdnBaseUrl(options.cdnBase);
  const cellLoader = createCellLayerLoader({ baseUrl, getRequestInit });

  const cellCatalog = await fetchCellLayerCatalog({
    baseUrl: options.cdnBase,
    init: options.getRequestInit?.() ?? options.init,
  });
  const useCellLayers = cellCatalog != null && cellCatalog.count > 0;
  if (!useCellLayers && mode === 'viewport') return null;

  const features = new Map<string, GeoJSON.Feature>();
  const { sourceId, fillLayerId, lineLayerId } = DMA_DATASET_IDS;

  const catalog: DmaMarketColorInput[] =
    slugs?.length && mode === 'slugs'
      ? slugs.map((slug) => ({ slug: slug.trim().toLowerCase(), region: 'unknown' }))
      : [];

  const colorExpression =
    catalog.length > 0 ? buildDmaSlugColorExpression(catalog) : buildDmaRegionColorExpression();
  const lineColor = options.lineColor ?? colorExpression;
  const lineWidth = options.lineWidth ?? DEFAULT_DMA_LINE_WIDTH;
  const showAllOutlines = Boolean(options.lineColor);
  const lineOpacity = buildDmaLineOpacityExpression({
    showAllOutlines,
    highlightOpacity: HIGHLIGHT_LINE_OPACITY,
  });
  const fillOutlineColor = showAllOutlines
    ? TRANSPARENT_OUTLINE
    : buildDmaHighlightOutlineColorExpression(colorExpression);
  const beforeLayerId = options.beforeLayerId ?? findAnchorBeforeId(map);
  const slugFilter = mode === 'slugs' ? slugFilterExpression(slugs) : undefined;
  const assignedOpacity = options.fillOpacity ?? DEFAULT_FILL_OPACITY;
  const visible = options.visible !== false;

  if (map.getSource?.(sourceId)) {
    map.removeLayer?.(lineLayerId);
    map.removeLayer?.(fillLayerId);
    map.removeSource?.(sourceId);
  }

  let flushScheduled = false;
  const flushFeaturesNow = () => {
    map.getSource?.(sourceId)?.setData?.(dmaFeaturesToCollection(features));
  };
  const flushFeatures = () => {
    if (flushScheduled) return;
    flushScheduled = true;
    requestAnimationFrame(() => {
      flushScheduled = false;
      flushFeaturesNow();
    });
  };

  map.addSource?.(sourceId, {
    type: 'geojson',
    data: dmaFeaturesToCollection(features),
    promoteId: 'slug',
    ...CHOROPLETH_BOUNDARY_GEOJSON_SOURCE_OPTIONS,
  });

  const fillPaint = buildChoroplethFillPaint(
    map as Parameters<typeof buildChoroplethFillPaint>[0],
    {
      'fill-color': colorExpression,
      'fill-outline-color': fillOutlineColor,
      'fill-opacity': fillOpacityExpression(visible, assignedOpacity),
    }
  );

  const fillLayer: Record<string, unknown> = {
    id: fillLayerId,
    type: 'fill',
    source: sourceId,
    ...(slugFilter ? { filter: slugFilter } : {}),
    paint: fillPaint,
  };

  const lineLayer: Record<string, unknown> = {
    id: lineLayerId,
    type: 'line',
    source: sourceId,
    ...(slugFilter ? { filter: slugFilter } : {}),
    paint: {
      'line-color': lineColor,
      'line-width': lineWidth,
      'line-opacity': lineOpacity,
    },
  };

  if (beforeLayerId && map.getLayer?.(beforeLayerId)) {
    map.addLayer?.(fillLayer, beforeLayerId);
    if (showAllOutlines) {
      map.addLayer?.(lineLayer, beforeLayerId);
    }
  } else {
    map.addLayer?.(fillLayer);
    if (showAllOutlines) {
      map.addLayer?.(lineLayer);
    }
  }

  stackGkOutlineLayersAboveDmaFill(map);

  const loadedCellIds = new Set<string>();

  const loadViewportDma = async () => {
    const viewport = mapViewportBounds(map) ?? (await waitForMapViewport(map));
    if (!viewport?.bounds) return;

    const zoom = mapZoom(map);

    await cellLoader.loadLayerForViewport({
      viewport: {
        bounds: viewport.bounds,
        centerLat: viewport.centerLat,
        centerLng: viewport.centerLng,
        zoom,
      },
      layer: 'dma',
      target: features,
      getFeatureId: dmaSlugId,
      replace: false,
      loadedCellIds,
      onShardMerged: ({ cellId, featureCount }) => {
        flushFeatures();
        element.dispatchEvent(
          new CustomEvent('gk-layer-shard', {
            detail: { cellId, featureCount, layer: 'dma' as const },
            bubbles: true,
          })
        );
      },
    });
    flushFeaturesNow();
  };

  if (mode === 'slugs' && slugs?.length) {
    await loadDmaMarketShapes(slugs, features, { cdnBase: options.cdnBase, getRequestInit });
    flushFeaturesNow();
  } else {
    void loadViewportDma();
  }

  if (options.highlightSlug) {
    try {
      map.setFeatureState?.(
        { source: sourceId, id: options.highlightSlug.trim().toLowerCase() },
        { highlight: true }
      );
    } catch {
      /* feature may not exist yet */
    }
  }

  let cleanupViewport: (() => void) | null = null;

  if (mode === 'viewport') {
    cleanupViewport = bindIncrementalViewportSync({
      map,
      load: loadViewportDma,
    });
  }

  return {
    sourceId,
    layerId: fillLayerId,
    hitLayerIds: [fillLayerId],
    cleanup: () => {
      cleanupViewport?.();
      try {
        map.removeLayer?.(lineLayerId);
        map.removeLayer?.(fillLayerId);
        map.removeSource?.(sourceId);
      } catch {
        /* map torn down */
      }
    },
    update: (partial) => {
      if (partial.highlightSlug !== undefined) {
        try {
          map.removeFeatureState?.({ source: sourceId });
        } catch {
          /* ignore */
        }
        if (partial.highlightSlug) {
          try {
            map.setFeatureState?.(
              { source: sourceId, id: partial.highlightSlug.trim().toLowerCase() },
              { highlight: true }
            );
          } catch {
            /* ignore */
          }
        }
      }
      if (partial.visible !== undefined && map.getLayer?.(fillLayerId)) {
        map.setPaintProperty?.(
          fillLayerId,
          'fill-opacity',
          fillOpacityExpression(partial.visible, partial.fillOpacity ?? assignedOpacity)
        );
      }
      if (partial.slugs !== undefined && partial.mode === 'slugs') {
        const filter = slugFilterExpression(partial.slugs);
        if (map.getLayer?.(fillLayerId)) map.setFilter?.(fillLayerId, filter ?? null);
        if (showAllOutlines && map.getLayer?.(lineLayerId)) {
          map.setFilter?.(lineLayerId, filter ?? null);
        }
      }
    },
  };
}
