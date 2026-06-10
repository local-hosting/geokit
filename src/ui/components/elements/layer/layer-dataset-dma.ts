/**
 * DMA CDN choropleth preset — `/cell/{cellId}.json` + per-market slugs.
 */

import { mergeDmaFeaturesBySlug, dmaFeaturesToCollection } from '../../../../cdn/dma-regions';
import { resolveGlobeCdnBaseUrl } from '../../../../cdn/config';
import { fetchGlobeCdnJson } from '../../../../cdn/fetch';
import { dmaMarketShapeUrl } from '../../../../cdn/paths';
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
import { stackGkOutlineLayersAboveDmaFill } from '../../../utils/layer-stack';
import type { LayerDatasetContext, LayerDatasetHandle } from './layer-datasets';
import {
  dispatchLayerShardEvent,
  findDatasetAnchorBeforeId,
  loadCellLayerForViewport,
} from './layer-dataset-shared';

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
  const beforeLayerId = options.beforeLayerId ?? findDatasetAnchorBeforeId(map);
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
    await loadCellLayerForViewport({
      map,
      cellLoader,
      layer: 'dma',
      target: features,
      loadedCellIds,
      getFeatureId: dmaSlugId,
      onShardMerged: ({ cellId, featureCount }) => {
        flushFeatures();
        dispatchLayerShardEvent(element, { cellId, featureCount, layer: 'dma' });
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
