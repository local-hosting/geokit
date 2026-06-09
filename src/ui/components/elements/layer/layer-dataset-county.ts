/**
 * County outline preset — `/us/county/**` CDN namespace.
 */

import { fetchCountiesBulkGeoJson } from '../../../../cdn/bulk';
import { resolveGlobeCdnBaseUrl } from '../../../../cdn/config';
import {
  addCountyBoundaries,
  applyCountyLinePaint,
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

const COUNTY_MIN_ZOOM = 7;

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
  const minzoom = options.minzoom ?? COUNTY_MIN_ZOOM;
  return {
    ...COUNTY_DATASET_IDS,
    lineColor: options.lineColor ?? 'rgba(255, 255, 255, 0.22)',
    lineWidth: options.lineWidth ?? 0.45,
    minzoom,
    lineMinzoom: minzoom,
  };
}

export async function mountCountyDataset(
  ctx: LayerDatasetContext
): Promise<LayerDatasetHandle | null> {
  const { map, options, getRequestInit } = ctx;
  const config = countyConfig(options);
  const baseUrl = resolveGlobeCdnBaseUrl(options.cdnBase);
  const beforeLayerId = options.beforeLayerId ?? findAnchorBeforeId(map);

  const counties = await fetchCountiesBulkGeoJson({
    baseUrl,
    init: getRequestInit?.() ?? undefined,
  });
  if (!counties?.features?.length) return null;

  addCountyBoundaries(map, counties, config, beforeLayerId);
  applyCountyLinePaint(map, config);
  stackGkOutlineLayersAboveDmaFill(map);

  return {
    sourceId: config.polygonSourceId,
    layerId: config.fillLayerId,
    hitLayerIds: options.interactive ? [config.fillLayerId] : undefined,
    cleanup: () => {
      removeCountyBoundaries(map, config);
    },
  };
}
