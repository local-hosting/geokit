/**
 * County outline preset — H3 cell bundles (`/cell/{cellId}.json`).
 */

import { createCellLayerLoader } from '../../../../cdn/cell-layers';
import { COUNTY_H3_MIN_ZOOM } from '../../../../cdn/county-h3-clusters';
import { countyFeaturesToCollection } from '../../../../cdn/county-viewport';
import { resolveGlobeCdnBaseUrl } from '../../../../cdn/config';
import { mapViewportBounds } from '../../../../utils/h3/map-viewport';
import { bindIncrementalViewportSync } from '../../../../cdn/viewport-shard-loader';
import {
  addCountyBoundaries,
  applyCountyLinePaint,
  refreshCountyBoundaries,
  removeCountyBoundaries,
  type CountyBoundaryConfig,
} from '../../../utils/county-boundaries';
import {
  findInsertBeforeLayer,
  stackGkOutlineLayersAboveDmaFill,
} from '../../../utils/layer-stack';
import type {
  LayerDatasetContext,
  LayerDatasetHandle,
  LayerDatasetOptions,
} from './layer-datasets';

export const COUNTY_DATASET_IDS = {
  polygonSourceId: 'gk-dataset-county',
  lineSourceId: 'gk-dataset-county-line-src',
  fillLayerId: 'gk-dataset-county-fill',
  lineLayerId: 'gk-dataset-county-line',
} as const;

type MapLike = NonNullable<LayerDatasetContext['map']>;

function findAnchorBeforeId(map: MapLike): string | undefined {
  return findInsertBeforeLayer(map, {
    matchLayer: (layer) => {
      const id = layer.id ?? '';
      return id.startsWith('gk-dataset-') || id.startsWith('venues') || id.startsWith('platform-');
    },
  });
}

function countyConfig(options: LayerDatasetOptions): CountyBoundaryConfig {
  const minzoom = options.minzoom ?? COUNTY_H3_MIN_ZOOM;
  return {
    ...COUNTY_DATASET_IDS,
    lineColor: options.lineColor ?? 'rgba(255, 255, 255, 0.22)',
    lineWidth: options.lineWidth ?? 0.45,
    minzoom,
    lineMinzoom: minzoom,
  };
}

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

export async function mountCountyDataset(
  ctx: LayerDatasetContext
): Promise<LayerDatasetHandle | null> {
  const { map, options, getRequestInit, element } = ctx;
  const config = countyConfig(options);
  const baseUrl = resolveGlobeCdnBaseUrl(options.cdnBase);
  const beforeLayerId = options.beforeLayerId ?? findAnchorBeforeId(map);
  const cellLoader = createCellLayerLoader({ baseUrl, getRequestInit });
  const features = new Map<string, GeoJSON.Feature>();
  const loadedCellIds = new Set<string>();
  let viewportResolution: number | null = null;
  const empty: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };

  addCountyBoundaries(map, empty, config, beforeLayerId);
  applyCountyLinePaint(map, config);
  stackGkOutlineLayersAboveDmaFill(map);

  const refreshFromTarget = () => {
    const collection = countyFeaturesToCollection(features);
    if (!collection.features.length) return collection;
    refreshCountyBoundaries(map, collection, config);
    return collection;
  };

  const onShard = (detail: { cellId?: string; featureCount: number; layer?: string }) => {
    element.dispatchEvent(new CustomEvent('gk-layer-shard', { detail, bubbles: true }));
  };

  const runViewportLoad = async () => {
    const viewport = mapViewportBounds(map) ?? (await waitForMapViewport(map));
    if (!viewport?.bounds) return null;

    const zoom = mapZoom(map);
    const resolution = cellLoader.cellLayerResolutionForZoom(zoom, 'county');
    if (resolution == null) {
      features.clear();
      loadedCellIds.clear();
      viewportResolution = null;
      refreshCountyBoundaries(map, empty, config);
      return null;
    }

    if (viewportResolution != null && viewportResolution !== resolution) {
      features.clear();
      loadedCellIds.clear();
    }
    viewportResolution = resolution;

    const result = await cellLoader.loadLayerForViewport({
      viewport: {
        bounds: viewport.bounds,
        centerLat: viewport.centerLat,
        centerLng: viewport.centerLng,
        zoom,
      },
      layer: 'county',
      target: features,
      replace: false,
      loadedCellIds,
      getFeatureId: (feature) => {
        const fips = String(
          (feature.properties as { fips?: string } | undefined)?.fips ?? feature.id ?? ''
        )
          .trim()
          .padStart(5, '0');
        return fips || null;
      },
      onShardMerged: ({ cellId, featureCount }) =>
        onShard({ cellId, featureCount, layer: 'county' }),
    });

    if (result.features > 0) {
      return refreshFromTarget();
    }
    return null;
  };

  let cleanupViewport: (() => void) | null = null;

  cleanupViewport = bindIncrementalViewportSync({
    map,
    load: async () => {
      await runViewportLoad();
    },
  });

  await runViewportLoad();

  return {
    sourceId: config.polygonSourceId,
    layerId: config.fillLayerId,
    hitLayerIds: options.interactive ? [config.fillLayerId] : undefined,
    cleanup: () => {
      cleanupViewport?.();
      removeCountyBoundaries(map, config);
    },
  };
}
