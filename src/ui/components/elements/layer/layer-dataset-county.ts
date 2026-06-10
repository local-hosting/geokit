/**
 * County outline preset — H3 cell bundles (`/cell/{cellId}.json`).
 */

import { createCellLayerLoader } from '../../../../cdn/cell-layers';
import { COUNTY_H3_MIN_ZOOM } from '../../../../cdn/county-h3-clusters';
import { countyFeaturesToCollection } from '../../../../cdn/county-viewport';
import { resolveGlobeCdnBaseUrl } from '../../../../cdn/config';
import { bindIncrementalViewportSync } from '../../../../cdn/viewport-shard-loader';
import {
  adminOutlinePreset,
  refreshAdminOutlineForPreset,
} from '../../../utils/admin-outline-preset';
import type {
  LayerDatasetContext,
  LayerDatasetHandle,
  LayerDatasetOptions,
} from './layer-datasets';
import {
  attachAdminOutlineLayers,
  buildAdminOutlineConfig,
  createAdminOutlineHandle,
  dispatchLayerShardEvent,
  loadCellLayerForViewport,
  mapDatasetZoom,
  resolveDatasetBeforeLayerId,
} from './layer-dataset-shared';
import type { AdminOutlineLayerConfig } from '../../../utils/admin-outline-layer';

export const COUNTY_DATASET_IDS = {
  polygonSourceId: 'gk-dataset-county',
  lineSourceId: 'gk-dataset-county-line-src',
  fillLayerId: 'gk-dataset-county-fill',
  lineLayerId: 'gk-dataset-county-line',
} as const;

const countyOutlineOps = adminOutlinePreset('county');

function countyConfig(options: LayerDatasetOptions): AdminOutlineLayerConfig {
  return buildAdminOutlineConfig(COUNTY_DATASET_IDS, options, {
    lineColor: 'rgba(255, 255, 255, 0.22)',
    lineWidth: 0.45,
    minzoom: options.minzoom ?? COUNTY_H3_MIN_ZOOM,
  });
}

export async function mountCountyDataset(
  ctx: LayerDatasetContext
): Promise<LayerDatasetHandle | null> {
  const { map, options, getRequestInit, element } = ctx;
  const config = countyConfig(options);
  const baseUrl = resolveGlobeCdnBaseUrl(options.cdnBase);
  const beforeLayerId = resolveDatasetBeforeLayerId(map, options);
  const cellLoader = createCellLayerLoader({ baseUrl, getRequestInit });
  const features = new Map<string, GeoJSON.Feature>();
  const loadedCellIds = new Set<string>();
  let viewportResolution: number | null = null;
  const empty: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };

  attachAdminOutlineLayers(map, empty, config, countyOutlineOps, beforeLayerId);

  const refreshFromTarget = () => {
    const collection = countyFeaturesToCollection(features);
    if (!collection.features.length) return collection;
    refreshAdminOutlineForPreset(map, collection, config);
    return collection;
  };

  const runViewportLoad = async () => {
    const zoom = mapDatasetZoom(map);
    const resolution = cellLoader.cellLayerResolutionForZoom(zoom, 'county');
    if (resolution == null) {
      features.clear();
      loadedCellIds.clear();
      viewportResolution = null;
      refreshAdminOutlineForPreset(map, empty, config);
      return null;
    }

    if (viewportResolution != null && viewportResolution !== resolution) {
      features.clear();
      loadedCellIds.clear();
    }
    viewportResolution = resolution;

    const result = await loadCellLayerForViewport({
      map,
      cellLoader,
      layer: 'county',
      target: features,
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
        dispatchLayerShardEvent(element, { cellId, featureCount, layer: 'county' }),
    });

    if (result && result.features > 0) {
      return refreshFromTarget();
    }
    return null;
  };

  const cleanupViewport = bindIncrementalViewportSync({
    map,
    load: async () => {
      await runViewportLoad();
    },
  });

  await runViewportLoad();

  return createAdminOutlineHandle(map, config, countyOutlineOps.remove, {
    hitLayerIds: options.interactive ? [config.fillLayerId] : undefined,
    cleanupExtra: cleanupViewport,
  });
}
