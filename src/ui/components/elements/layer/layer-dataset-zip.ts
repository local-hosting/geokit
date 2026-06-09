/**
 * ZIP outline preset — `/us/zip/{code}` CDN namespace.
 */

import { fetchZipFeatures } from '../../../../cdn/zip';
import { resolveGlobeCdnBaseUrl } from '../../../../cdn/config';
import {
  addAdminOutlineLayer,
  applyAdminOutlineLinePaint,
  removeAdminOutlineLayer,
} from '../../../utils/admin-outline-layer';
import {
  findInsertBeforeLayer,
  stackGkOutlineLayersAboveDmaFill,
} from '../../../utils/layer-stack';
import type {
  LayerDatasetContext,
  LayerDatasetHandle,
  LayerDatasetOptions,
} from './layer-datasets';

const ZIP_MIN_ZOOM = 10;

export const ZIP_DATASET_IDS = {
  polygonSourceId: 'gk-dataset-zip',
  lineSourceId: 'gk-dataset-zip-line-src',
  fillLayerId: 'gk-dataset-zip-fill',
  lineLayerId: 'gk-dataset-zip-line',
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

function zipConfig(options: LayerDatasetOptions) {
  const minzoom = options.minzoom ?? ZIP_MIN_ZOOM;
  return {
    ...ZIP_DATASET_IDS,
    lineColor: options.lineColor ?? 'rgba(255, 255, 255, 0.18)',
    lineWidth: options.lineWidth ?? 0.35,
    minzoom,
    lineMinzoom: minzoom,
  };
}

export async function mountZipDataset(
  ctx: LayerDatasetContext
): Promise<LayerDatasetHandle | null> {
  const { map, options, getRequestInit } = ctx;
  const zipSlugs = options.slugs;
  if (!zipSlugs?.length) {
    console.warn('[gk-layer] zip dataset requires slugs (comma-separated ZIP codes)');
    return null;
  }

  const config = zipConfig(options);
  const baseUrl = resolveGlobeCdnBaseUrl(options.cdnBase);
  const beforeLayerId = options.beforeLayerId ?? findAnchorBeforeId(map);

  const zips = await fetchZipFeatures(zipSlugs, {
    baseUrl,
    init: getRequestInit?.() ?? undefined,
  });
  if (!zips.features.length) return null;

  addAdminOutlineLayer(map, zips, config, beforeLayerId);
  applyAdminOutlineLinePaint(map, config);
  stackGkOutlineLayersAboveDmaFill(map);

  return {
    sourceId: config.polygonSourceId,
    layerId: config.fillLayerId,
    hitLayerIds: options.interactive ? [config.fillLayerId] : undefined,
    cleanup: () => {
      removeAdminOutlineLayer(map, config);
    },
  };
}
