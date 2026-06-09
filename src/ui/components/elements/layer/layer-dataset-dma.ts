/**
 * DMA CDN choropleth preset for gk-layer dataset mode.
 */

import {
  createDmaRegionClusterLoader,
  dmaCatalogEntriesFromRegionIndex,
  dmaFeaturesToCollection,
  dmaRegionBySlugFromRegionIndex,
  resolveRegionIdsForSlugs,
  resolveRegionIdsForViewportBounds,
} from '../../../../cdn/dma-regions';
import { resolveGlobeCdnBaseUrl } from '../../../../cdn/config';
import { mapViewportBounds } from '../../../../utils/h3/map-viewport';
import { buildChoroplethFillPaint } from '../../../utils/choropleth-fill-paint';
import { CHOROPLETH_BOUNDARY_GEOJSON_SOURCE_OPTIONS } from '../../../utils/geojson-source-options';
import {
  buildDmaFillOpacityExpression,
  buildDmaHighlightOutlineColorExpression,
  buildDmaLineOpacityExpression,
  buildDmaSlugColorExpression,
  type DmaMarketColorInput,
} from '../../../utils/dma-colors';
import { findInsertBeforeLayer } from '../../../utils/layer-stack';
import type { LayerDatasetContext, LayerDatasetHandle } from './layer-datasets';

const TRANSPARENT_OUTLINE = 'rgba(0, 0, 0, 0)';
const VIEWPORT_SYNC_DEBOUNCE_MS = 400;
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

export async function mountDmaDataset(
  ctx: LayerDatasetContext
): Promise<LayerDatasetHandle | null> {
  const { map, options, getRequestInit, element } = ctx;
  const mode = options.mode ?? 'viewport';
  const slugs = options.slugs;
  const baseUrl = resolveGlobeCdnBaseUrl(options.cdnBase);
  const loader = createDmaRegionClusterLoader({
    baseUrl,
    getRequestInit,
  });

  const index = await loader.fetchIndex();
  if (!index?.entries?.length) return null;

  const regionBySlug = dmaRegionBySlugFromRegionIndex(index);
  const features = new Map<string, GeoJSON.Feature>();
  const { sourceId, fillLayerId, lineLayerId } = DMA_DATASET_IDS;

  const catalog: DmaMarketColorInput[] =
    slugs?.length && mode === 'slugs'
      ? slugs.map((slug) => ({
          slug: slug.trim().toLowerCase(),
          region: regionBySlug.get(slug.trim().toLowerCase()) ?? 'unknown',
        }))
      : dmaCatalogEntriesFromRegionIndex(index);

  const colorExpression = buildDmaSlugColorExpression(catalog);
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

  const loadOptions = {
    index,
    onRegionMerged: (detail: { regionId: string; featureCount: number }) => {
      flushFeatures();
      element.dispatchEvent(new CustomEvent('gk-layer-shard', { detail, bubbles: true }));
    },
  };

  const runRegionLoad = async (regionIds: readonly string[], filterSlugs?: readonly string[]) => {
    await loader.loadFeaturesForRegions(regionIds, features, {
      ...loadOptions,
      ...(filterSlugs ? { filterSlugs } : {}),
    });
    flushFeaturesNow();
  };

  if (mode === 'slugs' && slugs?.length) {
    const slugRegions = resolveRegionIdsForSlugs(index, slugs);
    await runRegionLoad(slugRegions, slugs);
  } else {
    const viewport = mapViewportBounds(map) ?? (await waitForMapViewport(map));
    const regionIds = viewport?.bounds
      ? resolveRegionIdsForViewportBounds(index, viewport.bounds)
      : [];
    const toLoad =
      regionIds.length > 0
        ? regionIds
        : [...new Set(index.entries.map((entry) => entry.regionId.toLowerCase()))];
    // Do not block gk-layer-ready — shards may already be prefetching during basemap load.
    void runRegionLoad(toLoad);
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

  let viewportSyncTimer: ReturnType<typeof setTimeout> | null = null;
  let cleanupViewport: (() => void) | null = null;

  if (mode === 'viewport') {
    const schedule = () => {
      if (viewportSyncTimer) clearTimeout(viewportSyncTimer);
      viewportSyncTimer = setTimeout(() => {
        viewportSyncTimer = null;
        void (async () => {
          const viewport = mapViewportBounds(map);
          if (!viewport) return;
          const regionIds = resolveRegionIdsForViewportBounds(index, viewport.bounds);
          if (regionIds.length === 0) return;
          await loader.loadFeaturesForRegions(regionIds, features, loadOptions);
        })();
      }, VIEWPORT_SYNC_DEBOUNCE_MS);
    };

    map.on?.('moveend', schedule);
    cleanupViewport = () => {
      if (viewportSyncTimer) clearTimeout(viewportSyncTimer);
      map.off?.('moveend', schedule);
    };
  }

  const handle: LayerDatasetHandle = {
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

  return handle;
}
