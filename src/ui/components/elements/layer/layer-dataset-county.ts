/**
 * County outline preset for gk-layer — `/us/county/**` CDN namespace.
 */

import { fetchCountiesBulkGeoJson } from '../../../../cdn/bulk';
import { resolveGlobeCdnBaseUrl } from '../../../../cdn/config';
import {
  addCountyBoundaries,
  removeCountyBoundaries,
  type CountyBoundaryConfig,
} from '../../../utils/county-boundaries';
import { findInsertBeforeLayer } from '../../../utils/layer-stack';
import type {
  LayerDatasetContext,
  LayerDatasetHandle,
  LayerDatasetOptions,
} from './layer-datasets';

const COUNTY_MIN_ZOOM = 7;

export const COUNTY_DATASET_IDS = {
  sourceId: 'gk-dataset-county',
  layerId: 'gk-dataset-county-lines',
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
  return {
    sourceId: COUNTY_DATASET_IDS.sourceId,
    lineLayerId: COUNTY_DATASET_IDS.layerId,
    lineColor: options.lineColor ?? 'rgba(255, 255, 255, 0.10)',
    lineWidth: typeof options.lineWidth === 'number' ? options.lineWidth : 0.5,
  };
}

export async function mountCountyDataset(
  ctx: LayerDatasetContext
): Promise<LayerDatasetHandle | null> {
  const { map, options, getRequestInit } = ctx;
  const config = countyConfig(options);
  const baseUrl = resolveGlobeCdnBaseUrl(options.cdnBase);
  const minZoom = options.minzoom ?? COUNTY_MIN_ZOOM;
  const beforeLayerId = options.beforeLayerId ?? findAnchorBeforeId(map);
  let loaded = false;

  const fetchOpts = { baseUrl, init: getRequestInit?.() ?? undefined };

  const tryLoad = async (): Promise<boolean> => {
    if (loaded) return true;
    const zoom = map.getZoom?.() ?? 0;
    if (zoom < minZoom) return false;

    const counties = await fetchCountiesBulkGeoJson(fetchOpts);
    if (!counties?.features?.length) return false;
    if (map.getSource?.(config.sourceId)) {
      loaded = true;
      return true;
    }

    addCountyBoundaries(map, counties, config, beforeLayerId);
    loaded = true;
    return true;
  };

  const onZoom = () => {
    void tryLoad();
  };

  map.on?.('zoomend', onZoom);
  await tryLoad();

  return {
    sourceId: config.sourceId,
    layerId: config.lineLayerId,
    cleanup: () => {
      map.off?.('zoomend', onZoom);
      removeCountyBoundaries(map, config);
    },
  };
}
